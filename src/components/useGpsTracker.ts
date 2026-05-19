"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GPS_LOCK_DISTANCE_M,
  GPS_LOCK_INTERVAL_MS,
  GPS_MIN_DISTANCE_M,
  GPS_MIN_INTERVAL_MS,
  haversineMetres,
} from "@/lib/gps-config";

// State machine — see proposal §2.5 for the GPS lifecycle. The big constraint
// is iOS / macOS Safari: it refuses to honour geolocation permission unless
// watchPosition() is called from a direct user gesture (button click). Chrome
// accepts permission from useEffect; Safari does not. So the hook starts in
// `needsPermission` and waits for startTracking() to be invoked from a click
// handler. The tap counts as the user gesture, the OS / Safari prompt appears,
// permission gets granted, then watchPosition runs continuously.
export type GpsStatus =
  | { kind: "needsPermission" }
  | { kind: "requesting" }
  | { kind: "denied"; reason: string }
  | { kind: "running"; lastAt: number; sent: number; lastError: string | null };

type QueuedPoint = {
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
};

export type GpsMode = "background" | "lock";

export type LastPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: number;
};

export type UseGpsTrackerOptions = {
  // null = no trip yet (pre-Start). The hook still runs the geolocation
  // pipeline so the operator can be prompted for permission before Start is
  // enabled, but it skips the POST until a tripId arrives.
  tripId: string | null;
  // "background" = 30s / 200m gate (idle on the dispatch list)
  // "lock"       = 3s / no distance gate (operator is inside the lock screen)
  mode: GpsMode;
};

export type UseGpsTrackerReturn = {
  status: GpsStatus;
  // True once we have a fix from the OS, regardless of whether a tripId
  // exists yet. The Start button uses this to gate "begin task without GPS".
  hasFix: boolean;
  // Most recent successful position fix. Geofence components read this on
  // every render to decide whether to surface confirm buttons.
  lastPosition: LastPosition | null;
  startTracking: () => void;
  // Forces an immediate flush AND a fresh getCurrentPosition tagged into the
  // trip — used to pin the exact lat/lng at the moment of a status-advance
  // button click so admins can see where each transition happened.
  captureNow: () => Promise<LastPosition | null>;
};

export function useGpsTracker({ tripId, mode }: UseGpsTrackerOptions): UseGpsTrackerReturn {
  const [status, setStatus] = useState<GpsStatus>({ kind: "needsPermission" });
  const [hasFix, setHasFix] = useState(false);
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null);

  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const queueRef = useRef<QueuedPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tripIdRef = useRef(tripId);
  const modeRef = useRef(mode);
  tripIdRef.current = tripId;
  modeRef.current = mode;

  const flushNow = useCallback(async () => {
    flushTimerRef.current = null;
    const currentTripId = tripIdRef.current;
    if (!currentTripId) {
      queueRef.current.length = 0;
      return;
    }
    const batch = queueRef.current.splice(0, queueRef.current.length);
    if (batch.length === 0) return;
    try {
      const res = await fetch(`/api/trips/${currentTripId}/points`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: batch }),
        keepalive: true,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { accepted?: number };
      setStatus((s) =>
        s.kind === "running"
          ? { ...s, lastAt: Date.now(), sent: s.sent + (json.accepted ?? 0), lastError: null }
          : { kind: "running", lastAt: Date.now(), sent: json.accepted ?? 0, lastError: null },
      );
    } catch (e) {
      queueRef.current.unshift(...batch);
      setStatus((s) =>
        s.kind === "running"
          ? { ...s, lastError: e instanceof Error ? e.message : "Network error" }
          : s,
      );
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    const wait = modeRef.current === "lock" ? 1_000 : 2_000;
    flushTimerRef.current = setTimeout(flushNow, wait);
  }, [flushNow]);

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      setHasFix(true);
      const now = Date.now();
      setLastPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        recordedAt: now,
      });
      const last = lastSentRef.current;
      const intervalGate =
        modeRef.current === "lock" ? GPS_LOCK_INTERVAL_MS : GPS_MIN_INTERVAL_MS;
      const distanceGate =
        modeRef.current === "lock" ? GPS_LOCK_DISTANCE_M : GPS_MIN_DISTANCE_M;
      let send = false;
      if (!last) {
        send = true;
      } else {
        const elapsed = now - last.at;
        const dist = haversineMetres(
          last.lat,
          last.lng,
          pos.coords.latitude,
          pos.coords.longitude,
        );
        if (elapsed >= intervalGate || dist >= distanceGate) send = true;
      }
      if (!send) {
        setStatus((s) =>
          s.kind === "running"
            ? s
            : { kind: "running", lastAt: Date.now(), sent: 0, lastError: null },
        );
        return;
      }
      queueRef.current.push({
        recordedAt: new Date(now).toISOString(),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        speed: pos.coords.speed ?? null,
        heading: pos.coords.heading ?? null,
      });
      lastSentRef.current = { at: now, lat: pos.coords.latitude, lng: pos.coords.longitude };
      setStatus((s) =>
        s.kind === "running"
          ? s
          : { kind: "running", lastAt: Date.now(), sent: 0, lastError: null },
      );
      if (tripIdRef.current) scheduleFlush();
      else queueRef.current.length = 0;
    },
    [scheduleFlush],
  );

  const startTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({ kind: "denied", reason: "Geolocation not supported by this browser." });
      return;
    }
    if (watchRef.current !== null) return;

    setStatus({ kind: "requesting" });

    function onError(err: GeolocationPositionError) {
      const map: Record<number, string> = {
        1: "Location permission denied. Check Safari → Settings → Websites → Location (and macOS / iOS Privacy → Location Services → Safari).",
        2: "Location unavailable. GPS signal is weak or Location Services is off.",
        3: "Location request timed out.",
      };
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      setHasFix(false);
      setStatus({ kind: "denied", reason: map[err.code] ?? "Location error." });
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        watchRef.current = navigator.geolocation.watchPosition(handlePosition, onError, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30_000,
        });
      },
      onError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }, [handlePosition]);

  // Returns the captured position so callers (e.g. confirm-pickup tap) can
  // pass it to the server action that requires geofence validation.
  const captureNow = useCallback(async (): Promise<LastPosition | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    lastSentRef.current = null; // bypass interval/distance gate
    const pos = await new Promise<LastPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          handlePosition(p);
          resolve({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy ?? null,
            recordedAt: Date.now(),
          });
        },
        () => {
          // Fall back on whatever the last watchPosition fix was so the
          // server still gets coords to validate.
          resolve(lastPosition);
        },
        { enableHighAccuracy: true, maximumAge: 1_000, timeout: 4_000 },
      );
    });
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    await flushNow();
    return pos;
  }, [flushNow, handlePosition, lastPosition]);

  // Cleanup on unmount: stop the watch and best-effort flush remaining points
  // via sendBeacon (survives page unload, unlike fetch + keepalive on Safari).
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      const currentTripId = tripIdRef.current;
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (currentTripId && batch.length > 0 && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          `/api/trips/${currentTripId}/points`,
          new Blob([JSON.stringify({ points: batch })], { type: "application/json" }),
        );
      }
    };
  }, []);

  useEffect(() => {
    if (tripId && queueRef.current.length > 0) scheduleFlush();
  }, [tripId, scheduleFlush]);

  // Permissions API watcher: handles the "user granted permission in browser
  // settings but the page is stale" case. Without this, the operator would
  // have to reload before the GPS state caught up. Browsers that don't expose
  // navigator.permissions silently skip (Safari < 16 etc.) — those users
  // still tap "Try again" or hit reload.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    function onChange() {
      if (cancelled || !permStatus) return;
      if (permStatus.state === "granted" && watchRef.current === null) {
        // User flipped to allowed in settings — start tracking without
        // needing them to tap the button again.
        startTracking();
      } else if (permStatus.state === "denied" && watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        setHasFix(false);
        setStatus({ kind: "denied", reason: "Location permission was revoked." });
      }
    }

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((res) => {
        if (cancelled) return;
        permStatus = res;
        // If permission was already granted on mount, auto-start so the user
        // doesn't have to tap. Chrome respects this; Safari may still need
        // the gesture, in which case startTracking errors and we fall back
        // to the manual button.
        if (res.state === "granted") startTracking();
        res.addEventListener("change", onChange);
      })
      .catch(() => {
        /* permission API not available on this browser */
      });

    return () => {
      cancelled = true;
      if (permStatus) permStatus.removeEventListener("change", onChange);
    };
  }, [startTracking]);

  // Re-poll permission when the page becomes visible again. Mobile Safari
  // backgrounds the page when the user pops out to Settings to flip the
  // permission; on return we should pick up the change immediately.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((res) => {
          if (res.state === "granted" && watchRef.current === null) startTracking();
        })
        .catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [startTracking]);

  return { status, hasFix, lastPosition, startTracking, captureNow };
}

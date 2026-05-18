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
  startTracking: () => void;
  // Forces an immediate flush AND a fresh getCurrentPosition tagged into the
  // trip — used to pin the exact lat/lng at the moment of a status-advance
  // button click so admins can see where each transition happened.
  captureNow: () => Promise<void>;
};

export function useGpsTracker({ tripId, mode }: UseGpsTrackerOptions): UseGpsTrackerReturn {
  const [status, setStatus] = useState<GpsStatus>({ kind: "needsPermission" });
  const [hasFix, setHasFix] = useState(false);

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
    // No trip yet → drop queued samples (they were pre-Start permission probes).
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
      // Put samples back at the head; retry on the next flush trigger.
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
    // Lock mode flushes faster (1s debounce) so admins see near-live points.
    const wait = modeRef.current === "lock" ? 1_000 : 2_000;
    flushTimerRef.current = setTimeout(flushNow, wait);
  }, [flushNow]);

  // Shared per-position handler. Reads current mode for gating thresholds.
  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      setHasFix(true);
      const now = Date.now();
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
      // No tripId yet → don't bother flushing (flushNow will drop the queue).
      // We keep the state machine in "running" so the UI shows GPS is on.
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

  // Start the sampler from a user gesture (button click). MUST be called
  // synchronously inside the click handler for Safari to honour the prompt.
  const startTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({ kind: "denied", reason: "Geolocation not supported by this browser." });
      return;
    }
    // Already running? Don't restart.
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

    // Safari is happiest with a getCurrentPosition first — that's the call
    // that synchronously triggers the permission prompt from the user-gesture
    // stack. Once we have a fix, register the long-running watchPosition.
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

  // Forces an immediate fresh sample + flush. Used by status-advance buttons
  // so the trip's point trail has a pin at the exact click location/time.
  const captureNow = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    // Bypass the interval/distance gate by clearing lastSentRef so the new
    // sample is unconditionally queued.
    lastSentRef.current = null;
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePosition(pos);
          resolve();
        },
        // Don't fail the click on a timeout — admins will see the cluster of
        // background watchPosition samples around the click time regardless.
        () => resolve(),
        { enableHighAccuracy: true, maximumAge: 1_000, timeout: 4_000 },
      );
    });
    // Flush right away rather than waiting on the debounce.
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    await flushNow();
  }, [flushNow, handlePosition]);

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

  // When a trip starts (tripId transitions null → string) flush any samples
  // that piled up during the brief gap between Start and the server action
  // creating the Trip row.
  useEffect(() => {
    if (tripId && queueRef.current.length > 0) scheduleFlush();
  }, [tripId, scheduleFlush]);

  return { status, hasFix, startTracking, captureNow };
}

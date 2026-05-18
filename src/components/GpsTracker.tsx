"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_MIN_DISTANCE_M, GPS_MIN_INTERVAL_MS, haversineMetres } from "@/lib/gps-config";

type SamplerState =
  | { kind: "needsPermission" }                                       // waiting for a user-gesture tap
  | { kind: "requesting" }                                            // permission prompt is open
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

// Browser-side sampler. Mounts when a dispatch is in-progress (status in
// EN_ROUTE_TO_PICKUP / LOADING / EN_ROUTE_TO_DUMP). Unmounts on COMPLETED
// (or page unload) — that's the natural enforcement of proposal §2.5's
// "GPS only runs while the browser session is open".
//
// Safari note: iOS / macOS Safari refuses to honour geolocation permission
// unless watchPosition() is called from a direct user gesture (button
// click). Chrome accepts permission from useEffect; Safari does not. So
// the sampler waits for a tap on "Enable GPS tracking" before starting.
// The tap counts as the user gesture, the OS / Safari prompt appears,
// permission gets granted, then watchPosition runs continuously.
export function GpsTracker({ tripId }: { tripId: string }) {
  const [state, setState] = useState<SamplerState>({ kind: "needsPermission" });
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const queueRef = useRef<QueuedPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tripIdRef = useRef(tripId);
  tripIdRef.current = tripId;

  const flushNow = useCallback(async () => {
    flushTimerRef.current = null;
    const batch = queueRef.current.splice(0, queueRef.current.length);
    if (batch.length === 0) return;
    try {
      const res = await fetch(`/api/trips/${tripIdRef.current}/points`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: batch }),
        keepalive: true,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { accepted?: number };
      setState((s) =>
        s.kind === "running"
          ? { ...s, lastAt: Date.now(), sent: s.sent + (json.accepted ?? 0), lastError: null }
          : { kind: "running", lastAt: Date.now(), sent: json.accepted ?? 0, lastError: null },
      );
    } catch (e) {
      queueRef.current.unshift(...batch);
      setState((s) =>
        s.kind === "running"
          ? { ...s, lastError: e instanceof Error ? e.message : "Network error" }
          : s,
      );
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flushNow, 2_000);
  }, [flushNow]);

  // Start the sampler from a user gesture (button click). MUST be called
  // synchronously inside the click handler for Safari to honour the prompt.
  const startTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "denied", reason: "Geolocation not supported by this browser." });
      return;
    }
    setState({ kind: "requesting" });

    function onPosition(pos: GeolocationPosition) {
      const now = Date.now();
      const last = lastSentRef.current;
      let send = false;
      if (!last) {
        send = true;
      } else {
        const elapsed = now - last.at;
        const dist = haversineMetres(last.lat, last.lng, pos.coords.latitude, pos.coords.longitude);
        if (elapsed >= GPS_MIN_INTERVAL_MS || dist >= GPS_MIN_DISTANCE_M) send = true;
      }
      if (!send) {
        setState((s) => (s.kind === "running" ? s : { kind: "running", lastAt: Date.now(), sent: 0, lastError: null }));
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
      scheduleFlush();
    }

    function onError(err: GeolocationPositionError) {
      const map: Record<number, string> = {
        1: "Location permission denied. Check Safari → Settings → Websites → Location (and macOS / iOS Privacy → Location Services → Safari).",
        2: "Location unavailable. GPS signal is weak or Location Services is off.",
        3: "Location request timed out.",
      };
      // Stop the watch if it was registered before erroring.
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      setState({ kind: "denied", reason: map[err.code] ?? "Location error." });
    }

    // Safari is happiest with a getCurrentPosition first — that's the
    // call that synchronously triggers the permission prompt from the
    // user-gesture stack. Once we have a fix, we register the long-running
    // watchPosition for continuous updates.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPosition(pos);
        watchRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30_000,
        });
      },
      onError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }, [scheduleFlush]);

  // Cleanup on unmount: stop the watch and best-effort flush remaining points.
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (batch.length > 0 && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          `/api/trips/${tripIdRef.current}/points`,
          new Blob([JSON.stringify({ points: batch })], { type: "application/json" }),
        );
      }
    };
  }, []);

  if (state.kind === "needsPermission") {
    return (
      <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
        <div>📍 Tap below to start GPS tracking for this trip. Your browser will ask for location permission.</div>
        <button
          type="button"
          onClick={startTracking}
          className="inline-flex h-11 items-center rounded-md bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Enable GPS tracking
        </button>
      </div>
    );
  }

  if (state.kind === "requesting") {
    return (
      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        📍 Waiting for location permission… (check the browser prompt)
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        <div>⚠ {state.reason}</div>
        <div className="text-xs">
          The trip will still complete and you can submit the ticket — but
          admin won&apos;t see the route on the map.
        </div>
        <button
          type="button"
          onClick={startTracking}
          className="inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          Try again
        </button>
      </div>
    );
  }

  // running
  const samples = state.sent;
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
      </span>
      GPS tracking · {samples} sample{samples === 1 ? "" : "s"} sent
      {state.lastError ? (
        <span className="ml-1 text-amber-800">· retrying ({state.lastError})</span>
      ) : null}
    </div>
  );
}

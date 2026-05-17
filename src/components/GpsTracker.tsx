"use client";

import { useEffect, useRef, useState } from "react";
import { GPS_MIN_DISTANCE_M, GPS_MIN_INTERVAL_MS, haversineMetres } from "@/lib/gps-config";

type SamplerState =
  | { kind: "idle" }
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
export function GpsTracker({ tripId }: { tripId: string }) {
  const [state, setState] = useState<SamplerState>({ kind: "idle" });
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const queueRef = useRef<QueuedPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "denied", reason: "Geolocation not supported by this browser." });
      return;
    }

    function onPosition(pos: GeolocationPosition) {
      const now = Date.now();
      const last = lastSentRef.current;
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
        if (elapsed >= GPS_MIN_INTERVAL_MS || dist >= GPS_MIN_DISTANCE_M) {
          send = true;
        }
      }
      if (!send) {
        setState((s) => (s.kind === "running" ? { ...s, lastAt: s.lastAt } : s));
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
      lastSentRef.current = {
        at: now,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      scheduleFlush();
    }

    function onError(err: GeolocationPositionError) {
      const map: Record<number, string> = {
        1: "Location permission denied — admin can't see your route.",
        2: "Location unavailable.",
        3: "Location request timed out.",
      };
      setState({ kind: "denied", reason: map[err.code] ?? "Location error." });
    }

    function scheduleFlush() {
      if (flushTimerRef.current) return;
      // Coalesce rapid samples; flush ~2s after the latest queued point.
      flushTimerRef.current = setTimeout(flushNow, 2_000);
    }

    async function flushNow() {
      flushTimerRef.current = null;
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (batch.length === 0) return;
      try {
        const res = await fetch(`/api/trips/${tripId}/points`, {
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
        // Put points back at the head so we retry on the next sample.
        queueRef.current.unshift(...batch);
        setState((s) =>
          s.kind === "running"
            ? { ...s, lastError: e instanceof Error ? e.message : "Network error" }
            : { kind: "running", lastAt: Date.now(), sent: 0, lastError: e instanceof Error ? e.message : "Network error" },
        );
      }
    }

    setState({ kind: "running", lastAt: 0, sent: 0, lastError: null });
    watchRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30_000,
    });

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      // Best-effort flush on unmount; ignored if it fails.
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (batch.length > 0 && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          `/api/trips/${tripId}/points`,
          new Blob([JSON.stringify({ points: batch })], { type: "application/json" }),
        );
      }
    };
  }, [tripId]);

  if (state.kind === "denied") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        ⚠ {state.reason} The trip will still complete, but the route can&apos;t be replayed by admin.
      </div>
    );
  }

  if (state.kind === "running") {
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

  return null;
}

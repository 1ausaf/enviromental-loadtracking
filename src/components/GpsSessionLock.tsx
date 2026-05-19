"use client";

import { useEffect, useMemo } from "react";
import type { DispatchStatus } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/DispatchBadges";
import type { GpsStatus, LastPosition } from "@/components/useGpsTracker";
import { GEOFENCE_RADIUS_M, haversineMetres } from "@/lib/gps-config";

// Cycle state computed by the server from the DispatchLoad rows. UI mirrors
// the same enum so we don't drift.
export type CycleState = "AWAITING_PICKUP" | "AWAITING_DROPOFF" | "COMPLETED";

// Fullscreen lock shown while the operator is mid-haul. The screen replaces
// the normal app chrome with a single-purpose UI: geofence-aware pickup /
// drop confirmation buttons, load progress, big warning. Tries the
// Fullscreen API too — works on Chrome/Edge/desktop Safari, silently no-ops
// on iOS Safari (which blocks fullscreen on iPhone).

export function GpsSessionLock({
  status,
  dispatchStatus,
  cycleState,
  loadsCompleted,
  loadsAssigned,
  pickupCoord,
  dumpCoord,
  project,
  truck,
  lastPosition,
  onConfirmPickup,
  onConfirmDropoff,
  onOpenTicket,
  pending,
  error,
}: {
  status: GpsStatus;
  dispatchStatus: DispatchStatus;
  cycleState: CycleState;
  loadsCompleted: number;
  loadsAssigned: number;
  pickupCoord: { lat: number; lng: number } | null;
  dumpCoord: { lat: number; lng: number } | null;
  project: { name: string; client: string };
  truck: { licensePlate: string; colour: string };
  lastPosition: LastPosition | null;
  onConfirmPickup: () => void;
  onConfirmDropoff: () => void;
  onOpenTicket: () => void;
  pending: boolean;
  error: string | null;
}) {
  // Best-effort fullscreen on mount.
  useEffect(() => {
    const el = document.documentElement;
    const req =
      el.requestFullscreen ??
      (el as unknown as { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen;
    if (typeof req === "function") {
      try {
        const p = req.call(el);
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as Promise<void>).catch(() => {});
        }
      } catch {
        /* no-op */
      }
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Distance from operator to active target. The server has the final say,
  // but pre-emptively dimming the confirm button when out of range avoids
  // round-trips on obvious misfires.
  const distToTarget = useMemo<number | null>(() => {
    if (!lastPosition) return null;
    if (cycleState === "AWAITING_PICKUP" && pickupCoord) {
      return haversineMetres(
        pickupCoord.lat,
        pickupCoord.lng,
        lastPosition.latitude,
        lastPosition.longitude,
      );
    }
    if (cycleState === "AWAITING_DROPOFF" && dumpCoord) {
      return haversineMetres(
        dumpCoord.lat,
        dumpCoord.lng,
        lastPosition.latitude,
        lastPosition.longitude,
      );
    }
    return null;
  }, [cycleState, lastPosition, pickupCoord, dumpCoord]);

  const withinFence =
    distToTarget != null && distToTarget <= GEOFENCE_RADIUS_M;

  const samples = status.kind === "running" ? status.sent : 0;
  const lastError = status.kind === "running" ? status.lastError : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-emerald-900 via-emerald-950 to-black text-white">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-300" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wider text-emerald-200">
            GPS Tracking
          </span>
        </div>
        <StatusBadge value={dispatchStatus} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 text-center sm:gap-6 sm:px-8">
        <div>
          <div className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            DO NOT EXIT THIS BROWSER
          </div>
          <p className="mx-auto mt-3 max-w-md text-sm text-emerald-100 sm:text-base">
            Closing this tab or locking your phone will stop GPS tracking and
            halt load detection. Keep this screen open until the last load
            is complete.
          </p>
        </div>

        {/* Load progress meter */}
        <div className="w-full max-w-md">
          <div className="flex items-baseline justify-between text-xs uppercase tracking-wider text-emerald-200">
            <span>Loads</span>
            <span>
              {loadsCompleted} of {loadsAssigned}
            </span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{
                width: `${Math.min(100, Math.round((loadsCompleted / Math.max(1, loadsAssigned)) * 100))}%`,
              }}
            />
          </div>
          <div className="mt-2 text-sm text-emerald-100">
            {loadsAssigned - loadsCompleted > 0
              ? `${loadsAssigned - loadsCompleted} load${loadsAssigned - loadsCompleted === 1 ? "" : "s"} left to deliver.`
              : "All loads delivered!"}
          </div>
        </div>

        {/* Trip card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-emerald-200">
            Current haul
          </div>
          <div className="mt-1 text-lg font-semibold text-white sm:text-xl">
            {project.name}
          </div>
          <div className="text-sm text-emerald-100">{project.client}</div>
          <div className="mt-2 flex items-center justify-center gap-3 text-sm text-emerald-100">
            <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-white">
              {truck.licensePlate}
            </span>
            <span>{truck.colour}</span>
          </div>
        </div>

        {error ? (
          <div className="max-w-md rounded-md border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm text-red-50">
            {error}
          </div>
        ) : null}

        {status.kind === "denied" ? (
          <div className="max-w-md rounded-md border border-amber-300/40 bg-amber-500/20 px-4 py-3 text-sm text-amber-50">
            <strong className="font-semibold">GPS permission lost.</strong>{" "}
            {status.reason}
          </div>
        ) : null}
      </main>

      <footer className="border-t border-white/10 bg-black/30 px-5 pb-6 pt-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {cycleState === "AWAITING_PICKUP" ? (
            <PickupBlock
              distance={distToTarget}
              withinFence={withinFence}
              pending={pending}
              onConfirm={onConfirmPickup}
            />
          ) : null}

          {cycleState === "AWAITING_DROPOFF" ? (
            <DropoffBlock
              distance={distToTarget}
              withinFence={withinFence}
              pending={pending}
              onConfirm={onConfirmDropoff}
            />
          ) : null}

          {cycleState === "COMPLETED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={onOpenTicket}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-emerald-400 px-6 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {pending ? "Opening ticket…" : "Open ticket & sign off"}
            </button>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-emerald-200">
            <span>
              {samples} sample{samples === 1 ? "" : "s"} sent · every 3s
            </span>
            {lastError ? (
              <span className="text-amber-200">retrying ({lastError})</span>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}

function PickupBlock({
  distance,
  withinFence,
  pending,
  onConfirm,
}: {
  distance: number | null;
  withinFence: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-center text-sm text-emerald-100">
        {distance == null
          ? "Acquiring location…"
          : withinFence
            ? "📍 You're at the pickup point — tap to confirm."
            : `Drive to the pickup point — ${Math.round(distance)}m away.`}
      </div>
      <button
        type="button"
        disabled={pending || !withinFence}
        onClick={onConfirm}
        className={`inline-flex h-14 w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-lg transition disabled:cursor-not-allowed ${
          withinFence
            ? "bg-sky-500 text-white shadow-sky-900/30 hover:bg-sky-400 disabled:opacity-60"
            : "bg-white/10 text-emerald-100 shadow-none disabled:opacity-100"
        }`}
      >
        {pending ? "Recording…" : "🟢 PICK UP LOAD"}
      </button>
    </div>
  );
}

function DropoffBlock({
  distance,
  withinFence,
  pending,
  onConfirm,
}: {
  distance: number | null;
  withinFence: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-center text-sm text-emerald-100">
        {distance == null
          ? "Acquiring location…"
          : withinFence
            ? "🚛 You're at the dump point. Did you drop the load?"
            : `Drive to the dump point — ${Math.round(distance)}m away.`}
      </div>
      <button
        type="button"
        disabled={pending || !withinFence}
        onClick={onConfirm}
        className={`inline-flex h-14 w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-lg transition disabled:cursor-not-allowed ${
          withinFence
            ? "bg-amber-500 text-white shadow-amber-900/30 hover:bg-amber-400 disabled:opacity-60"
            : "bg-white/10 text-emerald-100 shadow-none disabled:opacity-100"
        }`}
      >
        {pending ? "Recording…" : "DID YOU DROP THE LOAD?"}
      </button>
    </div>
  );
}

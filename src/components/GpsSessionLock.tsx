"use client";

import { useEffect } from "react";
import type { DispatchStatus } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/DispatchBadges";
import type { GpsStatus } from "@/components/useGpsTracker";

// Fullscreen lock shown while the operator is mid-haul (proposal §2.5: GPS
// only runs while the browser session is open). The screen replaces the
// normal app chrome with a single-purpose UI: status, advance buttons, big
// warning. Tries the Fullscreen API too — works on Chrome/Edge/desktop
// Safari, silently no-ops on iOS Safari (which blocks fullscreen on iPhone).

export type LockAdvanceAction = {
  label: string;
  // Captures a GPS pin then runs the server action. Implementation lives in
  // the parent so it can call the hook's captureNow before the server action.
  onClick: () => void;
  tone: "primary" | "success";
};

export function GpsSessionLock({
  status,
  dispatchStatus,
  project,
  truck,
  advance,
  completeLoad,
  pending,
  error,
}: {
  status: GpsStatus;
  dispatchStatus: DispatchStatus;
  project: { name: string; client: string };
  truck: { licensePlate: string; colour: string };
  advance: LockAdvanceAction | null;
  completeLoad: LockAdvanceAction | null;
  pending: boolean;
  error: string | null;
}) {
  // Best-effort fullscreen on mount. Browsers require a user gesture; mount
  // is triggered by the Start button click, which counts as a gesture in
  // Chrome/Edge/Firefox/desktop Safari. iOS Safari refuses Fullscreen API on
  // iPhone — we swallow the rejection so it doesn't show as an error.
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
          (p as Promise<void>).catch(() => {
            /* no-op — iOS or user denied */
          });
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

  // Prevent body scroll while the lock is up so the warning + buttons stay
  // pinned no matter what the underlying card does.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const samples = status.kind === "running" ? status.sent : 0;
  const lastError = status.kind === "running" ? status.lastError : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-emerald-900 via-emerald-950 to-black text-white">
      {/* Top: live status pill */}
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

      {/* Middle: warning + trip info */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 text-center sm:px-8">
        <div>
          <div className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            DO NOT EXIT THIS BROWSER
          </div>
          <p className="mx-auto mt-3 max-w-md text-sm text-emerald-100 sm:text-base">
            Closing this tab or locking your phone will stop GPS tracking for
            this haul. Keep this screen open until you tap Complete Load.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-emerald-200">
            Current haul
          </div>
          <div className="mt-1 text-xl font-semibold text-white sm:text-2xl">
            {project.name}
          </div>
          <div className="text-sm text-emerald-100">{project.client}</div>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-emerald-100">
            <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-white">
              {truck.licensePlate}
            </span>
            <span>{truck.colour}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm text-red-100">
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

      {/* Bottom: advance buttons + sample counter */}
      <footer className="border-t border-white/10 bg-black/30 px-5 pb-6 pt-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {advance ? (
            <button
              type="button"
              disabled={pending}
              onClick={advance.onClick}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-sky-500 px-6 text-base font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {pending ? "Working…" : advance.label}
            </button>
          ) : null}
          {completeLoad ? (
            <button
              type="button"
              disabled={pending}
              onClick={completeLoad.onClick}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-emerald-400 px-6 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {pending ? "Opening ticket…" : completeLoad.label}
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

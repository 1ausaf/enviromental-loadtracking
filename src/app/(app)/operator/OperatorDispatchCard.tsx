"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DispatchAcceptance, DispatchStatus } from "@/generated/prisma/client";
import { AcceptanceBadge, StatusBadge } from "@/components/DispatchBadges";
import { GpsSessionLock, type CycleState } from "@/components/GpsSessionLock";
import { useGpsTracker } from "@/components/useGpsTracker";
import { fmtDateTime } from "@/lib/format";
import {
  acceptDispatchAction,
  confirmDropoffAction,
  confirmPickupAction,
  flagDispatchAction,
  startDispatchAction,
} from "./actions";
import { findTicketForCompletedDispatchAction } from "./tickets/actions";

type CardData = {
  id: string;
  scheduledFor: string;
  acceptance: DispatchAcceptance;
  status: DispatchStatus;
  flagReason: string | null;
  project: {
    name: string;
    client: string;
    pickupLat: number | null;
    pickupLng: number | null;
    dumpLat: number | null;
    dumpLng: number | null;
  };
  truck: { licensePlate: string; colour: string };
  pickupNote: string | null;
  dumpNote: string | null;
  notes: string | null;
  tripId: string | null; // present + active while haul is in progress
  loadsAssigned: number;
  loadsCompleted: number;
  cycleState: CycleState;
};

const TRIP_ACTIVE = new Set<DispatchStatus>([
  "EN_ROUTE_TO_PICKUP",
  "LOADING",
  "EN_ROUTE_TO_DUMP",
]);

// EN_ROUTE_TO_DUMP gets its own button (Complete Load) — the other two
// forward transitions share the generic advance label.

export function OperatorDispatchCard({ data }: { data: CardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isTripActive = TRIP_ACTIVE.has(data.status) && !!data.tripId;
  const gps = useGpsTracker({
    tripId: data.tripId,
    mode: isTripActive ? "lock" : "background",
  });

  const hasPins =
    data.project.pickupLat != null &&
    data.project.pickupLng != null &&
    data.project.dumpLat != null &&
    data.project.dumpLng != null;

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  // Wraps Start so the GPS pin captures the exact location at the moment of
  // tap (admins replaying the trip see a point at trip-start time).
  function startTrip() {
    setError(null);
    start(async () => {
      await gps.captureNow();
      const res = await startDispatchAction(data.id);
      if (res.error) setError(res.error);
    });
  }

  function confirmPickup() {
    setError(null);
    start(async () => {
      const pos = await gps.captureNow();
      if (!pos) {
        setError("Couldn't read your location — wait for GPS to settle and try again.");
        return;
      }
      const res = await confirmPickupAction(data.id, {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function confirmDropoff() {
    setError(null);
    start(async () => {
      const pos = await gps.captureNow();
      if (!pos) {
        setError("Couldn't read your location — wait for GPS to settle and try again.");
        return;
      }
      const res = await confirmDropoffAction(data.id, {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      // If that was the last load, the dispatch is now COMPLETED. Auto-open
      // the prefilled ticket so the operator finishes without an extra tap.
      if (res.complete) {
        const r = await findTicketForCompletedDispatchAction(data.id);
        if (r.ticketId) router.push(`/operator/tickets/${r.ticketId}`);
        else if (r.error) setError(r.error);
      }
    });
  }

  function openTicketAfterComplete() {
    setError(null);
    start(async () => {
      const r = await findTicketForCompletedDispatchAction(data.id);
      if (r.ticketId) router.push(`/operator/tickets/${r.ticketId}`);
      else if (r.error) setError(r.error);
    });
  }

  return (
    <>
      {isTripActive ? (
        <GpsSessionLock
          status={gps.status}
          dispatchStatus={data.status}
          cycleState={data.cycleState}
          loadsCompleted={data.loadsCompleted}
          loadsAssigned={data.loadsAssigned}
          pickupCoord={
            data.project.pickupLat != null && data.project.pickupLng != null
              ? { lat: data.project.pickupLat, lng: data.project.pickupLng }
              : null
          }
          dumpCoord={
            data.project.dumpLat != null && data.project.dumpLng != null
              ? { lat: data.project.dumpLat, lng: data.project.dumpLng }
              : null
          }
          project={{ name: data.project.name, client: data.project.client }}
          truck={data.truck}
          lastPosition={gps.lastPosition}
          onConfirmPickup={confirmPickup}
          onConfirmDropoff={confirmDropoff}
          onOpenTicket={openTicketAfterComplete}
          pending={pending}
          error={error}
        />
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-zinc-900">
              {data.project.name}
            </div>
            <div className="text-xs text-zinc-500">{data.project.client}</div>
            <div className="mt-1 text-sm text-zinc-700">
              {fmtDateTime(data.scheduledFor)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <AcceptanceBadge value={data.acceptance} />
            <StatusBadge value={data.status} />
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Info label="Truck" value={data.truck.licensePlate} mono />
          <Info label="Colour" value={data.truck.colour} />
          <Info label="Loads" value={`${data.loadsCompleted} / ${data.loadsAssigned}`} mono />
          <Info label="Status" value={cycleStateLabel(data.cycleState)} />
          <Info label="Pickup" value={data.pickupNote ?? "—"} />
          <Info label="Dump" value={data.dumpNote ?? "—"} />
        </dl>

        {data.notes ? (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700">
            {data.notes}
          </div>
        ) : null}

        {data.acceptance === "FLAGGED" && data.flagReason ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <strong className="font-semibold">Flagged:</strong> {data.flagReason}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!hasPins ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            ⚠ This project doesn&apos;t have pickup / dump pins set yet. Ask
            an admin to drop them on the project page before you can start.
          </div>
        ) : null}

        {/* GPS gate — required before Start. */}
        {data.acceptance === "ACCEPTED" && data.status === "IDLE" && hasPins ? (
          <GpsGate gps={gps} />
        ) : null}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.acceptance === "PENDING" && data.status === "IDLE" ? (
            <>
              <button
                type="button"
                disabled={pending || flagging}
                onClick={() => run(() => acceptDispatchAction(data.id))}
                className="inline-flex h-11 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setFlagging((v) => !v)}
                className="inline-flex h-11 items-center rounded-md border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60"
              >
                Flag an issue
              </button>
            </>
          ) : null}

          {data.acceptance === "ACCEPTED" && data.status === "IDLE" ? (
            <button
              type="button"
              disabled={pending || !gps.hasFix || !hasPins}
              onClick={startTrip}
              title={
                !hasPins
                  ? "This project has no pickup/dump pins yet."
                  : gps.hasFix
                    ? undefined
                    : "Enable GPS tracking before starting the haul."
              }
              className="inline-flex h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start
            </button>
          ) : null}

          {data.status === "COMPLETED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={openTicketAfterComplete}
              className="inline-flex h-11 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending ? "Opening ticket…" : "Open ticket"}
            </button>
          ) : null}
        </div>

        {flagging ? (
          <div className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <label htmlFor={`reason-${data.id}`} className="block text-sm font-medium text-amber-900">
              What&apos;s the issue?
            </label>
            <textarea
              id={`reason-${data.id}`}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. truck won't start, route blocked, wrong site address…"
              className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || reason.trim().length < 3}
                onClick={() =>
                  run(async () => {
                    const res = await flagDispatchAction(data.id, reason);
                    if (!res.error) {
                      setFlagging(false);
                      setReason("");
                    }
                    return res;
                  })
                }
                className="inline-flex h-10 items-center rounded-md bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send to admin"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlagging(false);
                  setReason("");
                }}
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function cycleStateLabel(s: CycleState): string {
  switch (s) {
    case "AWAITING_PICKUP":
      return "Heading to pickup";
    case "AWAITING_DROPOFF":
      return "Carrying load";
    case "COMPLETED":
      return "All loads delivered";
  }
}

function GpsGate({ gps }: { gps: ReturnType<typeof useGpsTracker> }) {
  const s = gps.status;
  if (s.kind === "running" && gps.hasFix) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        GPS ready — you can start the haul.
      </div>
    );
  }
  if (s.kind === "requesting") {
    return (
      <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        📍 Waiting for location permission… (check the browser prompt). The
        screen will refresh automatically once you allow.
      </div>
    );
  }
  if (s.kind === "denied") {
    return (
      <div className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        <div>⚠ {s.reason}</div>
        <div className="text-xs">
          GPS tracking is required before you can begin this haul. After
          allowing in your browser settings, this screen will pick it up
          automatically — no need to reload.
        </div>
        <button
          type="button"
          onClick={gps.startTracking}
          className="inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
      <div>📍 GPS tracking is required for this haul. Tap below to enable it.</div>
      <button
        type="button"
        onClick={gps.startTracking}
        className="inline-flex h-11 items-center rounded-md bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800"
      >
        Enable GPS tracking
      </button>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={mono ? "font-mono text-zinc-900" : "text-zinc-900"}>{value}</div>
    </div>
  );
}

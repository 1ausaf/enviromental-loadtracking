"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DispatchAcceptance, DispatchStatus } from "@/generated/prisma/client";
import { AcceptanceBadge, StatusBadge } from "@/components/DispatchBadges";
import { GpsSessionLock, type LockAdvanceAction } from "@/components/GpsSessionLock";
import { useGpsTracker } from "@/components/useGpsTracker";
import {
  acceptDispatchAction,
  advanceDispatchAction,
  flagDispatchAction,
  startDispatchAction,
} from "./actions";
import { completeLoadAction } from "./tickets/actions";

type CardData = {
  id: string;
  scheduledFor: string;
  acceptance: DispatchAcceptance;
  status: DispatchStatus;
  flagReason: string | null;
  project: { name: string; client: string };
  truck: { licensePlate: string; colour: string };
  pickupNote: string | null;
  dumpNote: string | null;
  notes: string | null;
  tripId: string | null; // present + active while haul is in progress
};

const TRIP_ACTIVE = new Set<DispatchStatus>([
  "EN_ROUTE_TO_PICKUP",
  "LOADING",
  "EN_ROUTE_TO_DUMP",
]);

const fullDtFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// EN_ROUTE_TO_DUMP gets its own button (Complete Load) — the other two
// forward transitions share the generic advance label.
const ADVANCE_LABEL: Partial<Record<DispatchStatus, string>> = {
  EN_ROUTE_TO_PICKUP: "Arrived at pickup",
  LOADING: "Loaded, en route to dump",
};

export function OperatorDispatchCard({ data }: { data: CardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // GPS lifts to the card so the Start button can gate on hasFix AND the
  // lock overlay shares the same hook instance once the trip starts.
  // Pre-Start there's no tripId — the hook still runs the permission flow
  // (so we can light up Start as soon as the OS reports a fix) but drops
  // any queued samples.
  const isTripActive = TRIP_ACTIVE.has(data.status) && !!data.tripId;
  const gps = useGpsTracker({
    tripId: data.tripId,
    mode: isTripActive ? "lock" : "background",
  });

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  // Wraps a server action so we capture the operator's exact lat/lng at the
  // moment of click into the trip's GPS trail. Admins replaying the trip see
  // a pin at the click instant for every status transition.
  function runWithPin(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      await gps.captureNow();
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  function completeLoad() {
    setError(null);
    start(async () => {
      await gps.captureNow();
      const res = await completeLoadAction(data.id);
      if (res.error) setError(res.error);
      else if (res.ticketId) router.push(`/operator/tickets/${res.ticketId}`);
    });
  }

  // While in an active trip, take over the viewport with the lock overlay.
  // The normal card still renders behind it (for layout continuity when the
  // trip ends) but it's hidden by the fixed-position overlay.
  const lockAdvance: LockAdvanceAction | null = ADVANCE_LABEL[data.status]
    ? {
        label: ADVANCE_LABEL[data.status]!,
        tone: "primary",
        onClick: () => runWithPin(() => advanceDispatchAction(data.id)),
      }
    : null;
  const lockCompleteLoad: LockAdvanceAction | null =
    data.status === "EN_ROUTE_TO_DUMP"
      ? {
          label: "Complete Load",
          tone: "success",
          onClick: completeLoad,
        }
      : null;

  return (
    <>
      {isTripActive ? (
        <GpsSessionLock
          status={gps.status}
          dispatchStatus={data.status}
          project={data.project}
          truck={data.truck}
          advance={lockAdvance}
          completeLoad={lockCompleteLoad}
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
              {fullDtFmt.format(new Date(data.scheduledFor))}
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

        {/* GPS gate — required before Start. Block all status advances until
            we have a live fix. Once the trip is active the lock overlay
            replaces this card so this section is hidden. */}
        {data.acceptance === "ACCEPTED" && data.status === "IDLE" ? (
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
              disabled={pending || !gps.hasFix}
              onClick={() => runWithPin(() => startDispatchAction(data.id))}
              title={gps.hasFix ? undefined : "Enable GPS tracking before starting the haul."}
              className="inline-flex h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start
            </button>
          ) : null}

          {data.status === "COMPLETED" ? (
            <span className="self-center text-xs text-emerald-700">
              Completed — finish the ticket in My tickets.
            </span>
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
        📍 Waiting for location permission… (check the browser prompt)
      </div>
    );
  }
  if (s.kind === "denied") {
    return (
      <div className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        <div>⚠ {s.reason}</div>
        <div className="text-xs">
          GPS tracking is required before you can begin this haul.
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
  // needsPermission (or running without fix yet)
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

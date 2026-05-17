"use client";

import { useState, useTransition } from "react";
import type { DispatchAcceptance, DispatchStatus } from "@/generated/prisma/client";
import { AcceptanceBadge, StatusBadge } from "@/components/DispatchBadges";
import {
  acceptDispatchAction,
  advanceDispatchAction,
  flagDispatchAction,
  startDispatchAction,
} from "./actions";

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
};

const fullDtFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const ADVANCE_LABEL: Partial<Record<DispatchStatus, string>> = {
  EN_ROUTE_TO_PICKUP: "Arrived at pickup",
  LOADING: "Loaded, en route to dump",
  EN_ROUTE_TO_DUMP: "Arrived at dump — complete",
};

export function OperatorDispatchCard({ data }: { data: CardData }) {
  const [pending, start] = useTransition();
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  return (
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
            disabled={pending}
            onClick={() => run(() => startDispatchAction(data.id))}
            className="inline-flex h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Start
          </button>
        ) : null}

        {ADVANCE_LABEL[data.status] ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => advanceDispatchAction(data.id))}
            className="inline-flex h-11 items-center rounded-md bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {ADVANCE_LABEL[data.status]}
          </button>
        ) : null}

        {data.status === "COMPLETED" ? (
          <span className="self-center text-xs text-emerald-700">
            Completed — eTicket flow lands in Phase 8.
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

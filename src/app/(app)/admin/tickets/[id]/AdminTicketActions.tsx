"use client";

import { useState, useTransition } from "react";
import type { TicketStatus } from "@/generated/prisma/client";
import { approveTicketAction, flagTicketAction } from "../actions";

export function AdminTicketActions({
  id,
  status,
}: {
  id: string;
  status: TicketStatus;
}) {
  const [pending, start] = useTransition();
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    start(async () => {
      const res = await approveTicketAction(id);
      if (res.error) setError(res.error);
    });
  }

  function submitFlag() {
    setError(null);
    start(async () => {
      const res = await flagTicketAction(id, reason);
      if (res.error) setError(res.error);
      else {
        setFlagging(false);
        setReason("");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "APPROVED" ? (
          <button
            type="button"
            onClick={approve}
            disabled={pending || flagging}
            className="inline-flex h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending ? "Working…" : status === "FLAGGED" ? "Override & approve" : "Approve"}
          </button>
        ) : null}
        {status !== "FLAGGED" ? (
          <button
            type="button"
            onClick={() => setFlagging((v) => !v)}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            {status === "APPROVED" ? "Reverse to flagged" : "Flag"}
          </button>
        ) : null}
      </div>

      {flagging ? (
        <div className="w-full max-w-md space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <label htmlFor="flag-reason" className="block text-sm font-medium text-amber-900">
            What&apos;s the issue?
          </label>
          <textarea
            id="flag-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-900"
            placeholder="e.g. missing load count, wrong delivery site, time discrepancy…"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitFlag}
              disabled={pending || reason.trim().length < 3}
              className="inline-flex h-9 items-center rounded-md bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Flag ticket"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFlagging(false);
                setReason("");
              }}
              className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}

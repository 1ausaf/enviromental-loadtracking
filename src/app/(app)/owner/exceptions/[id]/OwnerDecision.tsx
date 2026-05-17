"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExceptionType } from "@/generated/prisma/client";
import {
  approveExceptionAction,
  declineExceptionAction,
} from "../../exceptions/actions";

export function OwnerDecision({ id, type }: { id: string; type: ExceptionType }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    start(async () => {
      const res = await approveExceptionAction(id, note || null);
      if (res.error) setError(res.error);
      else {
        setNote("");
        router.refresh();
      }
    });
  }

  function decline() {
    setError(null);
    if (note.trim().length < 3) {
      setError("Add a short reason in the note before declining.");
      return;
    }
    start(async () => {
      const res = await declineExceptionAction(id, note);
      if (res.error) setError(res.error);
      else {
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Decision</h2>
      {type === "TICKET_FLAGGED" ? (
        <p className="mt-1 text-xs text-amber-800">
          Approving will <strong>override the admin&apos;s flag</strong> and
          mark the ticket as APPROVED.
        </p>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">
          Decision and timestamp are recorded for accountability. No automatic
          downstream action — the admin will see your call and proceed.
        </p>
      )}
      <label htmlFor="note" className="mt-3 mb-1 block text-sm font-medium text-zinc-900">
        Note (required for decline, optional for approve)
      </label>
      <textarea
        id="note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Brief reason or context."
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={pending}
          className="inline-flex h-11 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={pending}
          className="inline-flex h-11 items-center rounded-md border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? "Working…" : "Decline"}
        </button>
      </div>
    </div>
  );
}

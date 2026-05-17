"use client";

import { useTransition } from "react";
import type { DispatchStatus } from "@/generated/prisma/client";
import { cancelDispatchAction, deleteDispatchAction } from "../actions";

export function AdminDispatchActions({
  id,
  status,
  canEdit,
}: {
  id: string;
  status: DispatchStatus;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();

  async function onCancel() {
    if (
      !confirm(
        "Cancel this dispatch? The operator will see it as cancelled and " +
          "won't be able to act on it. The record stays for audit.",
      )
    )
      return;
    start(async () => {
      const res = await cancelDispatchAction(id);
      if (res.error) alert(res.error);
    });
  }

  async function onDelete() {
    if (!confirm("Permanently delete this dispatch? Use Cancel if you want an audit trail.")) return;
    start(async () => {
      const res = await deleteDispatchAction(id);
      if (res?.error) alert(res.error);
    });
  }

  const canCancel = status !== "COMPLETED" && status !== "CANCELLED";

  return (
    <div className="flex flex-wrap gap-2">
      {canCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md border border-amber-200 bg-white px-4 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
        >
          {pending ? "Working…" : "Cancel dispatch"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex h-10 items-center rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Working…" : "Delete"}
      </button>
      {!canEdit ? (
        <span className="self-center text-xs text-zinc-500">
          Read-only — trip has started.
        </span>
      ) : null}
    </div>
  );
}

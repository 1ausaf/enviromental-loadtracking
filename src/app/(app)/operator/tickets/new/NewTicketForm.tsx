"use client";

import { useActionState } from "react";
import { createTicketAction, type CreateTicketState } from "../actions";

const INITIAL: CreateTicketState = { status: "idle" };

export function NewTicketForm({ dispatches }: { dispatches: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState(createTicketAction, INITIAL);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="dispatchId" className="mb-1 block text-sm font-medium text-zinc-900">
          Pre-fill from a dispatch (optional)
        </label>
        <select
          id="dispatchId"
          name="dispatchId"
          defaultValue=""
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          <option value="">— Blank ticket —</option>
          {dispatches.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-zinc-900">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="equipmentType" className="mb-1 block text-sm font-medium text-zinc-900">
            Equipment type
          </label>
          <select
            id="equipmentType"
            name="equipmentType"
            defaultValue="TRI_AXLE"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="TRI_AXLE">Tri-Axle</option>
            <option value="END_DUMP">End Dump</option>
            <option value="LIVE_BOTTOM">Live Bottom</option>
            <option value="FLOAT">Float</option>
          </select>
        </div>
      </div>

      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

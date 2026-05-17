"use client";

import { useActionState } from "react";
import { createTruckAction, type CreateTruckState } from "../actions";

const INITIAL: CreateTruckState = { status: "idle" };

export function NewTruckForm() {
  const [state, action, pending] = useActionState(createTruckAction, INITIAL);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="licensePlate" label="License plate" required autoFocus />
        <Field id="colour" label="Colour / ID tag" required />
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-zinc-900">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue="TRI_AXLE"
            required
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="TRI_AXLE">Tri-Axle</option>
            <option value="END_DUMP">End Dump</option>
            <option value="LIVE_BOTTOM">Live Bottom</option>
            <option value="FLOAT">Float</option>
          </select>
        </div>
        <div>
          <label htmlFor="capacityTonnes" className="mb-1 block text-sm font-medium text-zinc-900">
            Capacity (tonnes)
          </label>
          <input
            id="capacityTonnes"
            name="capacityTonnes"
            type="number"
            step="0.1"
            min="0.1"
            required
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-zinc-900">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue="ACTIVE"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="ACTIVE">Active — available for dispatch</option>
            <option value="MAINTENANCE">Maintenance — excluded from dispatch</option>
            <option value="INACTIVE">Inactive — excluded from dispatch</option>
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
        {pending ? "Creating…" : "Create truck"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  autoFocus,
}: {
  id: string;
  label: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        required={required}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

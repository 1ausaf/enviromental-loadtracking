"use client";

import { useActionState, useTransition } from "react";
import type { TruckStatus, TruckType } from "@/generated/prisma/client";
import {
  deleteTruckAction,
  updateTruckAction,
  type EditTruckState,
} from "../actions";

const INITIAL: EditTruckState = { status: "idle" };

export function TruckEditForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    licensePlate: string;
    type: TruckType;
    capacityTonnes: number;
    colour: string;
    status: TruckStatus;
  };
}) {
  const [state, action, pending] = useActionState(
    updateTruckAction.bind(null, id),
    INITIAL,
  );
  const [removing, startRemove] = useTransition();

  async function remove() {
    if (
      !confirm(
        "Delete this truck? Its assignment history will be removed too. " +
          "Set status to Inactive instead if you want to keep the audit trail.",
      )
    ) {
      return;
    }
    startRemove(async () => {
      const res = await deleteTruckAction(id);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="licensePlate" label="License plate" defaultValue={initial.licensePlate} required />
        <Field id="colour" label="Colour / ID tag" defaultValue={initial.colour} required />
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-zinc-900">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={initial.type}
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
            defaultValue={initial.capacityTonnes}
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
            defaultValue={initial.status}
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
      {state.status === "saved" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Saved.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="inline-flex h-11 items-center rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {removing ? "Deleting…" : "Delete truck"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
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
        defaultValue={defaultValue}
        required={required}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

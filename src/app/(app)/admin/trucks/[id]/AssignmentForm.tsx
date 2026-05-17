"use client";

import { useState, useTransition } from "react";
import { assignTruckAction } from "../actions";

type OperatorOption = {
  id: string;
  name: string;
  employeeId: string | null;
  isActive: boolean;
};

export function AssignmentForm({
  truckId,
  currentOperatorId,
  operators,
}: {
  truckId: string;
  currentOperatorId: string | null;
  operators: OperatorOption[];
}) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string>(currentOperatorId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function apply(value: string | null) {
    setError(null);
    start(async () => {
      const res = await assignTruckAction(truckId, value);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="operator" className="mb-1 block text-sm font-medium text-zinc-900">
          Current operator
        </label>
        <select
          id="operator"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60"
        >
          <option value="">— Unassigned —</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id} disabled={!op.isActive}>
              {op.name}
              {op.employeeId ? ` · ${op.employeeId}` : ""}
              {op.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || selected === (currentOperatorId ?? "")}
          onClick={() => apply(selected || null)}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Updating…" : "Apply"}
        </button>
        {currentOperatorId ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setSelected("");
              apply(null);
            }}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
          >
            Release
          </button>
        ) : null}
      </div>
      <p className="text-xs text-zinc-500">
        Reassigning automatically releases the operator from any other truck.
      </p>
    </div>
  );
}

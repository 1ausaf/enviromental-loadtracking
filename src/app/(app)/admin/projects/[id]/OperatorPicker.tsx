"use client";

import { useState, useTransition } from "react";
import { setOperatorAssignmentAction } from "../actions";

type OpOption = {
  id: string;
  name: string;
  employeeId: string | null;
  isActive: boolean;
  currentTruckPlate: string | null;
};

export function OperatorPicker({
  projectId,
  assignedIds,
  all,
}: {
  projectId: string;
  assignedIds: string[];
  all: OpOption[];
}) {
  const [assigned, setAssigned] = useState(new Set(assignedIds));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(opId: string) {
    setError(null);
    const next = new Set(assigned);
    const attach = !next.has(opId);
    if (attach) next.add(opId);
    else next.delete(opId);
    setAssigned(next);
    start(async () => {
      const res = await setOperatorAssignmentAction(projectId, opId, attach);
      if (res.error) {
        setError(res.error);
        // roll back optimistic update
        const revert = new Set(assigned);
        setAssigned(revert);
      }
    });
  }

  if (all.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No operators in the system yet. Create one via the Users screen.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1">
        {all.map((op) => {
          const on = assigned.has(op.id);
          return (
            <label
              key={op.id}
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-zinc-50 ${
                op.isActive ? "" : "opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={pending || !op.isActive}
                onChange={() => toggle(op.id)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-zinc-900">{op.name}</div>
                <div className="truncate text-xs text-zinc-500">
                  {op.employeeId ?? "no ID"}
                  {op.currentTruckPlate ? ` · ${op.currentTruckPlate}` : ""}
                  {op.isActive ? "" : " · inactive"}
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}

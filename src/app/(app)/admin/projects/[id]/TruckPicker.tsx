"use client";

import { useState, useTransition } from "react";
import type { TruckStatus, TruckType } from "@/generated/prisma/client";
import { truckTypeLabel } from "@/components/TruckBadges";
import { setTruckAssignmentAction } from "../actions";

type TruckOption = {
  id: string;
  licensePlate: string;
  type: TruckType;
  status: TruckStatus;
};

export function TruckPicker({
  projectId,
  assignedIds,
  all,
}: {
  projectId: string;
  assignedIds: string[];
  all: TruckOption[];
}) {
  const [assigned, setAssigned] = useState(new Set(assignedIds));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setError(null);
    const next = new Set(assigned);
    const attach = !next.has(id);
    if (attach) next.add(id);
    else next.delete(id);
    setAssigned(next);
    start(async () => {
      const res = await setTruckAssignmentAction(projectId, id, attach);
      if (res.error) {
        setError(res.error);
        const revert = new Set(assigned);
        setAssigned(revert);
      }
    });
  }

  if (all.length === 0) {
    return <p className="text-sm text-zinc-500">No trucks in the system yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1">
        {all.map((t) => {
          const on = assigned.has(t.id);
          const dim = t.status !== "ACTIVE";
          return (
            <label
              key={t.id}
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-zinc-50 ${dim ? "opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={pending}
                onChange={() => toggle(t.id)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono font-semibold text-zinc-900">
                  {t.licensePlate}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {truckTypeLabel(t.type)}
                  {t.status === "ACTIVE" ? "" : ` · ${t.status.toLowerCase()}`}
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

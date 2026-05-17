"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { DispatchAcceptance, DispatchStatus } from "@/generated/prisma/client";

export function DispatchBoardFilters({
  initial,
  projects,
}: {
  initial: {
    status: DispatchStatus | "ALL";
    acceptance: DispatchAcceptance | "ALL";
    project: string;
    includeCancelled: boolean;
  };
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value === "ALL" || value === "" || value === "0") next.delete(key);
    else next.set(key, value);
    router.replace(`/admin/dispatch?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <select
        defaultValue={initial.status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All statuses</option>
        <option value="IDLE">Idle</option>
        <option value="EN_ROUTE_TO_PICKUP">En route to pickup</option>
        <option value="LOADING">Loading</option>
        <option value="EN_ROUTE_TO_DUMP">En route to dump</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <select
        defaultValue={initial.acceptance}
        onChange={(e) => setParam("acceptance", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">Any acceptance</option>
        <option value="PENDING">Pending</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="FLAGGED">Flagged</option>
      </select>
      <select
        defaultValue={initial.project}
        onChange={(e) => setParam("project", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          defaultChecked={initial.includeCancelled}
          onChange={(e) => setParam("includeCancelled", e.target.checked ? "1" : "0")}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        Include cancelled
      </label>
    </div>
  );
}

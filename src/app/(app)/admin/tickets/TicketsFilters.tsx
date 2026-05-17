"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { TicketStatus } from "@/generated/prisma/client";

export function TicketsFilters({
  initial,
  operators,
  projects,
}: {
  initial: {
    q: string;
    status: TicketStatus | "ALL";
    operator: string;
    project: string;
    from: string;
    to: string;
  };
  operators: Array<{ id: string; name: string; employeeId: string | null }>;
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q);

  useEffect(() => {
    const id = setTimeout(() => setParam("q", q), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value === "" || (key !== "status" && value === "ALL")) next.delete(key);
    else next.set(key, value);
    router.replace(`/admin/tickets?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search ticket #, broker, contract, pickup/dump…"
        className="h-10 flex-1 min-w-[200px] rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <select
        defaultValue={initial.status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="SUBMITTED">Submitted (review queue)</option>
        <option value="APPROVED">Approved</option>
        <option value="FLAGGED">Flagged</option>
      </select>
      <select
        defaultValue={initial.operator}
        onChange={(e) => setParam("operator", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All operators</option>
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.employeeId ? ` · ${o.employeeId}` : ""}
          </option>
        ))}
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
      <input
        type="date"
        defaultValue={initial.from}
        onChange={(e) => setParam("from", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        aria-label="From date"
      />
      <input
        type="date"
        defaultValue={initial.to}
        onChange={(e) => setParam("to", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        aria-label="To date"
      />
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ExceptionStatus, ExceptionType } from "@/generated/prisma/client";

export function ExceptionFilters({
  initial,
}: {
  initial: { q: string; status: ExceptionStatus | "ALL"; type: ExceptionType | "ALL" };
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
    router.replace(`/owner?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search summary, details, ticket #…"
        className="h-10 flex-1 min-w-[200px] rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <select
        defaultValue={initial.status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All statuses</option>
        <option value="PENDING">Pending (queue)</option>
        <option value="APPROVED">Approved</option>
        <option value="DECLINED">Declined</option>
      </select>
      <select
        defaultValue={initial.type}
        onChange={(e) => setParam("type", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All types</option>
        <option value="TICKET_FLAGGED">Flagged tickets</option>
        <option value="TICKET_LATE_SUBMISSION">Late submissions</option>
        <option value="ADMIN_OVERRIDE_REQUEST">Override requests</option>
      </select>
    </div>
  );
}

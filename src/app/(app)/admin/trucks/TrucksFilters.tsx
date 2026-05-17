"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { TruckStatus, TruckType } from "@/generated/prisma/client";

export function TrucksFilters({
  initial,
}: {
  initial: { q: string; status: TruckStatus | "ALL"; type: TruckType | "ALL" };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q);

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp);
      if (q) next.set("q", q);
      else next.delete("q");
      router.replace(`/admin/trucks?${next.toString()}`);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value === "ALL" || value === "") next.delete(key);
    else next.set(key, value);
    router.replace(`/admin/trucks?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search by plate or colour…"
        className="h-10 flex-1 min-w-[200px] rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <select
        defaultValue={initial.status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="MAINTENANCE">Maintenance</option>
        <option value="INACTIVE">Inactive</option>
      </select>
      <select
        defaultValue={initial.type}
        onChange={(e) => setParam("type", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All types</option>
        <option value="TRI_AXLE">Tri-Axle</option>
        <option value="END_DUMP">End Dump</option>
        <option value="LIVE_BOTTOM">Live Bottom</option>
        <option value="FLOAT">Float</option>
      </select>
    </div>
  );
}

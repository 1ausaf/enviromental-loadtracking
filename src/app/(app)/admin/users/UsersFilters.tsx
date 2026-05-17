"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role } from "@/lib/roles";

export function UsersFilters({
  initial,
}: {
  initial: { q: string; role: Role | "ALL"; status: "ALL" | "ACTIVE" | "INACTIVE" };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q);

  // Debounce text search so we don't spam navigations on each keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp);
      if (q) next.set("q", q);
      else next.delete("q");
      router.replace(`/admin/users?${next.toString()}`);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value === "ALL" || value === "") next.delete(key);
    else next.set(key, value);
    router.replace(`/admin/users?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search name, email, or employee ID…"
        className="h-10 flex-1 min-w-[200px] rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <select
        defaultValue={initial.role}
        onChange={(e) => setParam("role", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All roles</option>
        <option value="OWNER">Owner</option>
        <option value="ADMIN">Admin</option>
        <option value="OPERATOR">Operator</option>
      </select>
      <select
        defaultValue={initial.status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="ALL">All status</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Deactivated</option>
      </select>
    </div>
  );
}

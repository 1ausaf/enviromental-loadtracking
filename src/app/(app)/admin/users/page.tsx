import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { isRole, type Role } from "@/lib/roles";
import { UserRow } from "./UserRow";
import { UsersFilters } from "./UsersFilters";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  role?: string;
  status?: string;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser("ADMIN");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const roleFilter: Role | "ALL" =
    params.role && isRole(params.role) ? (params.role as Role) : "ALL";
  const statusFilter =
    params.status === "ACTIVE" || params.status === "INACTIVE"
      ? params.status
      : "ALL";

  const users = await listUsers({
    query,
    role: roleFilter,
    status: statusFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Users
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {users.length}
            {users.length === 100 ? "+" : ""} result{users.length === 1 ? "" : "s"} &middot;
            create, deactivate, or delete accounts.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + New user
        </Link>
      </div>

      <UsersFilters initial={{ q: query, role: roleFilter, status: statusFilter }} />

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3 hidden md:table-cell">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden lg:table-cell">Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map((u) => <UserRow key={u.id} user={u} actor={actor} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

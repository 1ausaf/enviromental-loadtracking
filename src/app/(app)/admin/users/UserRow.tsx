"use client";

import { useTransition } from "react";
import { hasAccess, type Role } from "@/lib/roles";
import { RoleBadge } from "@/components/RoleBadge";
import { deleteUserAction, setActiveAction } from "./actions";

type Actor = { id: string; role: Role };
type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  isActive: boolean;
  createdAt: Date;
};

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function UserRow({ user, actor }: { user: UserSummary; actor: Actor }) {
  const [pending, start] = useTransition();
  const isSelf = user.id === actor.id;
  const canManage = !isSelf && hasAccess(user.role, actor.role);

  async function toggle() {
    start(async () => {
      try {
        await setActiveAction(user.id, !user.isActive);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  async function remove() {
    if (
      !confirm(
        `Permanently delete ${user.name} (${user.email})? This wipes the account ` +
          `and all login history. Choose Deactivate instead to keep the audit trail.`,
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteUserAction(user.id);
      if (res.error) alert(res.error);
    });
  }

  return (
    <tr className={user.isActive ? "" : "bg-zinc-50/60"}>
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-900">{user.name}</div>
        <div className="text-xs text-zinc-500">
          {user.employeeId ?? <span className="italic text-zinc-400">no ID</span>}
          {isSelf ? <span className="ml-1 text-zinc-400">· you</span> : null}
        </div>
        <div className="mt-0.5 text-xs text-zinc-600 md:hidden">{user.email}</div>
      </td>
      <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">{user.email}</td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3">
        {user.isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300">
            Deactivated
          </span>
        )}
      </td>
      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
        {dateFmt.format(user.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage ? (
          <div className="inline-flex gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={toggle}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
            >
              {user.isActive ? "Deactivate" : "Reactivate"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        ) : (
          <span className="text-xs italic text-zinc-400">
            {isSelf ? "—" : "above your role"}
          </span>
        )}
      </td>
    </tr>
  );
}

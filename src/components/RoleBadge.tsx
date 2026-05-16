import type { Role } from "@/lib/roles";

const COLORS: Record<Role, string> = {
  OWNER: "bg-amber-100 text-amber-900 ring-amber-200",
  ADMIN: "bg-sky-100 text-sky-900 ring-sky-200",
  OPERATOR: "bg-emerald-100 text-emerald-900 ring-emerald-200",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COLORS[role]}`}
    >
      {role}
    </span>
  );
}

import type { DispatchAcceptance, DispatchStatus } from "@/generated/prisma/client";

const ACCEPTANCE: Record<DispatchAcceptance, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-amber-100 text-amber-900 ring-amber-200" },
  ACCEPTED: { label: "Accepted", cls: "bg-emerald-100 text-emerald-900 ring-emerald-200" },
  FLAGGED: { label: "Flagged", cls: "bg-red-100 text-red-900 ring-red-200" },
};

const STATUS: Record<DispatchStatus, { label: string; cls: string }> = {
  IDLE: { label: "Idle", cls: "bg-zinc-200 text-zinc-700 ring-zinc-300" },
  EN_ROUTE_TO_PICKUP: { label: "En route to pickup", cls: "bg-sky-100 text-sky-900 ring-sky-200" },
  LOADING: { label: "Loading", cls: "bg-violet-100 text-violet-900 ring-violet-200" },
  EN_ROUTE_TO_DUMP: { label: "En route to dump", cls: "bg-sky-100 text-sky-900 ring-sky-200" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-100 text-emerald-900 ring-emerald-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-zinc-200 text-zinc-700 ring-zinc-300" },
};

export function AcceptanceBadge({ value }: { value: DispatchAcceptance }) {
  const { label, cls } = ACCEPTANCE[value];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ value }: { value: DispatchStatus }) {
  const { label, cls } = STATUS[value];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [k, v.label]),
) as Record<DispatchStatus, string>;

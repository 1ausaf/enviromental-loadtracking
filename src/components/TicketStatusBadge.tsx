import type { TicketStatus } from "@/generated/prisma/client";

const STYLES: Record<TicketStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-zinc-200 text-zinc-700 ring-zinc-300" },
  SUBMITTED: { label: "Submitted", cls: "bg-amber-100 text-amber-900 ring-amber-200" },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-900 ring-emerald-200" },
  FLAGGED: { label: "Flagged", cls: "bg-red-100 text-red-900 ring-red-200" },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { label, cls } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

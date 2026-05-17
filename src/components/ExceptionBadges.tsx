import type { ExceptionStatus, ExceptionType } from "@/generated/prisma/client";

const STATUS: Record<ExceptionStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-amber-100 text-amber-900 ring-amber-200" },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-900 ring-emerald-200" },
  DECLINED: { label: "Declined", cls: "bg-red-100 text-red-900 ring-red-200" },
};

const TYPE_LABEL: Record<ExceptionType, string> = {
  TICKET_LATE_SUBMISSION: "Late submission",
  TICKET_FLAGGED: "Flagged ticket",
  ADMIN_OVERRIDE_REQUEST: "Override request",
};

const TYPE_CLS: Record<ExceptionType, string> = {
  TICKET_LATE_SUBMISSION: "bg-sky-100 text-sky-900 ring-sky-200",
  TICKET_FLAGGED: "bg-red-100 text-red-900 ring-red-200",
  ADMIN_OVERRIDE_REQUEST: "bg-purple-100 text-purple-900 ring-purple-200",
};

export function ExceptionStatusBadge({ status }: { status: ExceptionStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function ExceptionTypeBadge({ type }: { type: ExceptionType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TYPE_CLS[type]}`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

export function exceptionTypeLabel(t: ExceptionType): string {
  return TYPE_LABEL[t];
}

import type {
  ExceptionStatus,
  ExceptionType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export class ExceptionError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE",
    message: string,
  ) {
    super(message);
  }
}

// Tunable thresholds for system-raised exceptions. HK can adjust without
// touching application logic.
export const LATE_SUBMISSION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// --- Auto-raise hooks ---------------------------------------------------

// Internal helper used by lib/tickets.ts when a flag, late submit, or
// override is detected. Caller is expected to have already validated the
// underlying state machine.
export async function raiseException(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    type: ExceptionType;
    summary: string;
    details?: string | null;
    ticketId?: string | null;
    dispatchId?: string | null;
    createdById?: string | null;
  },
) {
  return tx.exception.create({
    data: {
      type: input.type,
      summary: input.summary.slice(0, 250),
      details: input.details?.trim() || null,
      ticketId: input.ticketId ?? null,
      dispatchId: input.dispatchId ?? null,
      createdById: input.createdById ?? null,
    },
  });
}

// Called when an admin themselves overrides a flag (Phase 7 approveTicket
// on a previously-FLAGGED ticket). Any PENDING TICKET_FLAGGED exception
// for that ticket gets auto-decided so the Owner queue doesn't show stale
// items.
export async function autoResolvePendingForApprovedTicket(
  tx: Prisma.TransactionClient | typeof prisma,
  ticketId: string,
): Promise<void> {
  await tx.exception.updateMany({
    where: {
      ticketId,
      type: "TICKET_FLAGGED",
      status: "PENDING",
    },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      decisionNote: "Auto-resolved: admin overrode the flag and approved the ticket.",
    },
  });
}

// --- Owner decisions ----------------------------------------------------

async function loadPending(id: string) {
  const e = await prisma.exception.findUnique({ where: { id } });
  if (!e) throw new ExceptionError("NOT_FOUND", "Exception not found.");
  if (e.status !== "PENDING") {
    throw new ExceptionError(
      "INVALID_STATE",
      "Already decided. Exceptions can be decided exactly once.",
    );
  }
  return e;
}

// Owner approves the exception. For TICKET_FLAGGED, this also overrides the
// flag and APPROVES the underlying ticket (Owner says "the admin's flag
// doesn't stand, push it through"). For other types the decision is purely
// recorded — the admin then takes any concrete action.
export async function approveException(
  ownerId: string,
  id: string,
  note: string | null,
): Promise<void> {
  const e = await loadPending(id);
  await prisma.$transaction(async (tx) => {
    await tx.exception.update({
      where: { id },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decidedById: ownerId,
        decisionNote: note?.trim().slice(0, 500) || null,
      },
    });

    if (e.type === "TICKET_FLAGGED" && e.ticketId) {
      const t = await tx.ticket.findUnique({ where: { id: e.ticketId } });
      if (t && t.status !== "APPROVED") {
        // Flip directly here (avoids importing lib/tickets.ts which would
        // create a circular dependency). Mirrors approveTicket() semantics.
        await tx.ticket.update({
          where: { id: e.ticketId },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedById: ownerId,
            flagReason: null,
            flaggedAt: null,
            flaggedById: null,
          },
        });
      }
    }
  });
}

// Owner declines the exception. No automatic action on the related entity.
export async function declineException(
  ownerId: string,
  id: string,
  note: string | null,
): Promise<void> {
  if (!note?.trim()) {
    throw new ExceptionError("BAD_REQUEST", "A reason is required to decline.");
  }
  await loadPending(id);
  await prisma.exception.update({
    where: { id },
    data: {
      status: "DECLINED",
      decidedAt: new Date(),
      decidedById: ownerId,
      decisionNote: note.trim().slice(0, 500),
    },
  });
}

// Admin-initiated request for Owner sign-off on something out-of-band.
// Stored as ADMIN_OVERRIDE_REQUEST so the Owner queue surfaces it.
export async function requestOverride(
  actorUserId: string,
  input: {
    ticketId?: string | null;
    dispatchId?: string | null;
    summary: string;
    details: string;
  },
) {
  if (!input.summary?.trim()) {
    throw new ExceptionError("BAD_REQUEST", "A short summary is required.");
  }
  if (!input.details?.trim()) {
    throw new ExceptionError("BAD_REQUEST", "Explain what you need approved.");
  }
  return raiseException(prisma, {
    type: "ADMIN_OVERRIDE_REQUEST",
    summary: input.summary,
    details: input.details,
    ticketId: input.ticketId ?? null,
    dispatchId: input.dispatchId ?? null,
    createdById: actorUserId,
  });
}

// --- Queries ------------------------------------------------------------

export type ListExceptionsFilters = {
  query?: string;
  status?: ExceptionStatus | "ALL";
  type?: ExceptionType | "ALL";
  fromDate?: Date;
  toDate?: Date;
};

export async function listExceptions(filters: ListExceptionsFilters = {}) {
  const where: Prisma.ExceptionWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.type && filters.type !== "ALL") where.type = filters.type;
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) (where.createdAt as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.createdAt as { lte?: Date }).lte = filters.toDate;
  }
  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { details: { contains: q, mode: "insensitive" } },
      { ticket: { ticketNumber: { contains: q, mode: "insensitive" } } },
    ];
  }
  return prisma.exception.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: exceptionInclude,
    take: 200,
  });
}

export async function getException(id: string) {
  const e = await prisma.exception.findUnique({
    where: { id },
    include: {
      ...exceptionInclude,
      ticket: {
        select: {
          id: true,
          ticketNumber: true,
          date: true,
          status: true,
          operatorId: true,
          operator: { include: { user: { select: { name: true, employeeId: true } } } },
          project: { select: { id: true, name: true, client: true } },
        },
      },
    },
  });
  if (!e) throw new ExceptionError("NOT_FOUND", "Exception not found.");
  return e;
}

export async function countPendingExceptions(): Promise<number> {
  return prisma.exception.count({ where: { status: "PENDING" } });
}

export const exceptionInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  decidedBy: { select: { id: true, name: true, email: true } },
} as const;

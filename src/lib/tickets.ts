import type { Prisma, TicketStatus, TruckType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export class TicketError extends Error {
  constructor(
    public code:
      | "BAD_REQUEST"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_STATE",
    message: string,
  ) {
    super(message);
  }
}

// ---- Ticket number allocator -------------------------------------------
// Atomic via the SystemCounter row seeded by the Phase 7 migration. Same
// shape as employee IDs (Phase 2). Format: T-100001, T-100002, …
export async function nextTicketNumber(): Promise<string> {
  const row = await prisma.systemCounter.update({
    where: { key: "ticketNumber" },
    data: { value: { increment: 1 } },
  });
  return formatTicketNumber(row.value);
}
export function formatTicketNumber(n: number): string {
  return `T-${String(n).padStart(6, "0")}`;
}

// ---- Inputs ------------------------------------------------------------

export type CreateTicketInput = {
  date?: Date;                      // defaults to today
  dispatchId?: string | null;
  projectId?: string | null;
  truckId?: string | null;
  equipmentType?: TruckType;        // when no dispatch/truck pre-fill
};

export type DraftPatch = Partial<{
  date: Date;
  brokerName: string | null;
  truckNumber: string | null;
  licensePlate: string | null;
  companyHaulingFor: string | null;
  jobContractNumber: string | null;
  pickupLocation: string | null;
  deliveryLocation: string | null;
  equipmentType: TruckType;
  used407ETR: boolean;
  startTime: Date | null;
  endTime: Date | null;
  comments: string | null;
  projectId: string | null;
  truckId: string | null;
}>;

export type LoadEntryInput = {
  loadNumber: number;
  loadTime: Date | null;
  notes: string | null;
};

// ---- Helpers -----------------------------------------------------------

async function loadOwnDraft(operatorId: string, ticketId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!t) throw new TicketError("NOT_FOUND", "Ticket not found.");
  if (t.operatorId !== operatorId) {
    throw new TicketError("FORBIDDEN", "Only the ticket's operator can edit it.");
  }
  if (t.status !== "DRAFT") {
    throw new TicketError("INVALID_STATE", "Submitted tickets are locked and can't be edited.");
  }
  return t;
}

function computeTotalHours(start: Date | null | undefined, end: Date | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  return Math.round((ms / 3_600_000) * 100) / 100; // 2 decimal places
}

// ---- Create / edit / delete (operator) ---------------------------------

export async function createDraft(operatorId: string, input: CreateTicketInput) {
  // Pre-fill from dispatch if linked: copies project / truck / equipment /
  // pickup+delivery / start time. Tickets without a dispatch are allowed.
  let prefill: Prisma.TicketCreateInput | null = null;
  if (input.dispatchId) {
    const d = await prisma.dispatch.findUnique({
      where: { id: input.dispatchId },
      include: { truck: true, project: true, trip: true },
    });
    if (!d) throw new TicketError("NOT_FOUND", "Dispatch not found.");
    if (d.operatorId !== operatorId) {
      throw new TicketError("FORBIDDEN", "That dispatch isn't yours.");
    }
    const existing = await prisma.ticket.findUnique({ where: { dispatchId: d.id } });
    if (existing) {
      throw new TicketError("INVALID_STATE", "A ticket already exists for that dispatch.");
    }
    prefill = {
      ticketNumber: "PENDING", // overwritten below
      date: d.scheduledFor,
      truckNumber: null,
      licensePlate: d.truck.licensePlate,
      pickupLocation: d.pickupNote,
      deliveryLocation: d.dumpNote,
      equipmentType: d.truck.type,
      startTime: d.trip?.startedAt ?? d.startedAt ?? null,
      endTime: d.trip?.endedAt ?? d.completedAt ?? null,
      operator: { connect: { id: operatorId } },
      project: { connect: { id: d.projectId } },
      truck: { connect: { id: d.truckId } },
      dispatch: { connect: { id: d.id } },
    };
  }

  const ticketNumber = await nextTicketNumber();
  const baseDate = input.date ?? new Date();

  const data: Prisma.TicketCreateInput = prefill ?? {
    ticketNumber,
    date: baseDate,
    equipmentType: input.equipmentType ?? "TRI_AXLE",
    operator: { connect: { id: operatorId } },
    ...(input.projectId ? { project: { connect: { id: input.projectId } } } : {}),
    ...(input.truckId ? { truck: { connect: { id: input.truckId } } } : {}),
  };
  data.ticketNumber = ticketNumber;

  return prisma.ticket.create({ data });
}

export async function updateDraft(
  operatorId: string,
  ticketId: string,
  patch: DraftPatch,
) {
  await loadOwnDraft(operatorId, ticketId);
  const data: Prisma.TicketUpdateInput = {};
  if (patch.date !== undefined) data.date = patch.date;
  if (patch.brokerName !== undefined) data.brokerName = patch.brokerName?.trim() || null;
  if (patch.truckNumber !== undefined) data.truckNumber = patch.truckNumber?.trim() || null;
  if (patch.licensePlate !== undefined) data.licensePlate = patch.licensePlate?.trim() || null;
  if (patch.companyHaulingFor !== undefined) data.companyHaulingFor = patch.companyHaulingFor?.trim() || null;
  if (patch.jobContractNumber !== undefined) data.jobContractNumber = patch.jobContractNumber?.trim() || null;
  if (patch.pickupLocation !== undefined) data.pickupLocation = patch.pickupLocation?.trim() || null;
  if (patch.deliveryLocation !== undefined) data.deliveryLocation = patch.deliveryLocation?.trim() || null;
  if (patch.equipmentType !== undefined) data.equipmentType = patch.equipmentType;
  if (patch.used407ETR !== undefined) data.used407ETR = patch.used407ETR;
  if (patch.startTime !== undefined) data.startTime = patch.startTime;
  if (patch.endTime !== undefined) data.endTime = patch.endTime;
  if (patch.comments !== undefined) data.comments = patch.comments?.trim() || null;
  if (patch.projectId !== undefined) {
    data.project = patch.projectId ? { connect: { id: patch.projectId } } : { disconnect: true };
  }
  if (patch.truckId !== undefined) {
    data.truck = patch.truckId ? { connect: { id: patch.truckId } } : { disconnect: true };
  }
  return prisma.ticket.update({ where: { id: ticketId }, data });
}

export async function replaceLoadEntries(
  operatorId: string,
  ticketId: string,
  entries: LoadEntryInput[],
): Promise<void> {
  await loadOwnDraft(operatorId, ticketId);
  // Validate entries
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isInteger(e.loadNumber) || e.loadNumber < 1) {
      throw new TicketError("BAD_REQUEST", "Load numbers must be positive integers.");
    }
    if (seen.has(e.loadNumber)) {
      throw new TicketError("BAD_REQUEST", `Duplicate load number ${e.loadNumber}.`);
    }
    seen.add(e.loadNumber);
  }
  await prisma.$transaction([
    prisma.ticketLoadEntry.deleteMany({ where: { ticketId } }),
    prisma.ticketLoadEntry.createMany({
      data: entries.map((e) => ({
        ticketId,
        loadNumber: e.loadNumber,
        loadTime: e.loadTime,
        notes: e.notes?.trim() || null,
      })),
    }),
  ]);
}

// Drafts are deletable by their owning operator. Once SUBMITTED, the
// archive contract (§2.2) means no delete path exists in the lib.
export async function deleteDraft(operatorId: string, ticketId: string): Promise<void> {
  await loadOwnDraft(operatorId, ticketId);
  await prisma.ticket.delete({ where: { id: ticketId } });
}

// ---- Sign + submit -----------------------------------------------------

const SIG_MAX_BYTES = 200 * 1024; // 200 KB — plenty for a small canvas PNG

export async function signAndSubmit(
  operatorId: string,
  ticketId: string,
  signatureDataUrl: string,
): Promise<void> {
  const t = await loadOwnDraft(operatorId, ticketId);

  if (!signatureDataUrl?.startsWith("data:image/png;base64,")) {
    throw new TicketError("BAD_REQUEST", "Signature is required (PNG data URL).");
  }
  const approxBytes = Math.floor(((signatureDataUrl.length - "data:image/png;base64,".length) * 3) / 4);
  if (approxBytes > SIG_MAX_BYTES) {
    throw new TicketError("BAD_REQUEST", "Signature is too large (max 200 KB).");
  }

  // Basic completeness check — these are the fields a ticket must have to
  // be useful. Anything else can stay null per the paper-form reality.
  if (!t.date) throw new TicketError("BAD_REQUEST", "Date is required.");
  if (!t.startTime || !t.endTime) {
    throw new TicketError("BAD_REQUEST", "Start time and end time are required.");
  }
  if (t.endTime <= t.startTime) {
    throw new TicketError("BAD_REQUEST", "End time must be after start time.");
  }

  const totalHours = computeTotalHours(t.startTime, t.endTime);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "SUBMITTED",
      signatureDataUrl,
      submittedAt: new Date(),
      totalHours,
    },
  });
}

// ---- Admin actions -----------------------------------------------------

export async function approveTicket(actorUserId: string, ticketId: string): Promise<void> {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!t) throw new TicketError("NOT_FOUND", "Ticket not found.");
  if (t.status === "APPROVED") return; // idempotent
  if (t.status === "DRAFT") {
    throw new TicketError("INVALID_STATE", "Operator hasn't submitted the ticket yet.");
  }
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: actorUserId,
      flagReason: null,
      flaggedAt: null,
      flaggedById: null,
    },
  });
}

export async function flagTicket(
  actorUserId: string,
  ticketId: string,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new TicketError("BAD_REQUEST", "Flag reason is required (3+ chars).");
  }
  const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!t) throw new TicketError("NOT_FOUND", "Ticket not found.");
  if (t.status === "DRAFT") {
    throw new TicketError("INVALID_STATE", "Can't flag an unsubmitted draft.");
  }
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "FLAGGED",
      flagReason: trimmed.slice(0, 500),
      flaggedAt: new Date(),
      flaggedById: actorUserId,
      approvedAt: null,
      approvedById: null,
    },
  });
}

// ---- Queries -----------------------------------------------------------

export type ListTicketsFilters = {
  query?: string;             // ticket number / broker / contract / pickup / dump
  status?: TicketStatus | "ALL";
  operatorId?: string;
  projectId?: string;
  truckId?: string;
  fromDate?: Date;
  toDate?: Date;
  draftsOnly?: boolean;
};

export async function listTickets(filters: ListTicketsFilters = {}) {
  const where: Prisma.TicketWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.operatorId) where.operatorId = filters.operatorId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.truckId) where.truckId = filters.truckId;
  if (filters.draftsOnly) where.status = "DRAFT";
  if (filters.fromDate || filters.toDate) {
    where.date = {};
    if (filters.fromDate) (where.date as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.date as { lte?: Date }).lte = filters.toDate;
  }
  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { ticketNumber: { contains: q, mode: "insensitive" } },
      { brokerName: { contains: q, mode: "insensitive" } },
      { jobContractNumber: { contains: q, mode: "insensitive" } },
      { pickupLocation: { contains: q, mode: "insensitive" } },
      { deliveryLocation: { contains: q, mode: "insensitive" } },
      { licensePlate: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.ticket.findMany({
    where,
    orderBy: [{ status: "asc" }, { date: "desc" }],
    include: ticketInclude,
    take: 200,
  });
}

export async function listTicketsForOperator(operatorId: string) {
  return prisma.ticket.findMany({
    where: { operatorId },
    orderBy: [{ status: "asc" }, { date: "desc" }, { createdAt: "desc" }],
    include: ticketInclude,
    take: 100,
  });
}

export async function getTicket(id: string) {
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      ...ticketInclude,
      loadEntries: { orderBy: { loadNumber: "asc" } },
      approvedBy: { select: { id: true, name: true, email: true } },
      flaggedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!t) throw new TicketError("NOT_FOUND", "Ticket not found.");
  return t;
}

export const ticketInclude = {
  operator: {
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  },
  truck: { select: { id: true, licensePlate: true, type: true } },
  project: { select: { id: true, name: true, client: true } },
  dispatch: { select: { id: true, scheduledFor: true } },
} as const;

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma, TicketStatus, TruckType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  autoResolvePendingForApprovedTicket,
  LATE_SUBMISSION_THRESHOLD_MS,
  raiseException,
} from "@/lib/exceptions";

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
  materialType: string | null;       // Phase 8
  issuesNote: string | null;         // Phase 8
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
  // pickup+delivery / start time, AND auto-populates the load entries from
  // DispatchLoad rows recorded by the geofence flow. Tickets without a
  // dispatch (manual ones) are still allowed.
  let prefill: Prisma.TicketCreateInput | null = null;
  let prefilledLoadEntries: Array<{ loadNumber: number; loadTime: Date | null }> = [];
  if (input.dispatchId) {
    const d = await prisma.dispatch.findUnique({
      where: { id: input.dispatchId },
      include: { truck: true, project: true, trip: true, loads: { orderBy: { loadNumber: "asc" } } },
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
    // Each completed DispatchLoad becomes a load entry. Pickup time wins
    // over dropoff for the "loadTime" column to match what an operator
    // would have written down at the pickup.
    prefilledLoadEntries = d.loads
      .filter((l) => l.dropoffAt != null)
      .map((l) => ({
        loadNumber: l.loadNumber,
        loadTime: l.pickupAt ?? l.dropoffAt,
      }));
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
  if (prefilledLoadEntries.length > 0) {
    data.loadEntries = {
      create: prefilledLoadEntries.map((e) => ({
        loadNumber: e.loadNumber,
        loadTime: e.loadTime,
      })),
    };
  }

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
  if (patch.materialType !== undefined) data.materialType = patch.materialType?.trim() || null;
  if (patch.issuesNote !== undefined) data.issuesNote = patch.issuesNote?.trim() || null;
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
  const draft = await loadOwnDraft(operatorId, ticketId);
  // Tickets linked to a dispatch get their load entries from the geofence
  // flow's DispatchLoad rows — clients can only update notes, not the
  // count / timing. Silently ignore the request if it tries to mutate
  // anything besides notes for an already-recorded entry.
  if (draft.dispatchId) {
    const existing = await prisma.ticketLoadEntry.findMany({
      where: { ticketId },
      orderBy: { loadNumber: "asc" },
    });
    // Only allow notes updates on matching loadNumber rows; ignore anything
    // else (UI shouldn't send it, but guard server-side anyway).
    const updates = entries
      .map((e) => {
        const match = existing.find((x) => x.loadNumber === e.loadNumber);
        if (!match) return null;
        return { id: match.id, notes: e.notes?.trim() || null };
      })
      .filter((u): u is { id: string; notes: string | null } => u !== null);
    await prisma.$transaction(
      updates.map((u) =>
        prisma.ticketLoadEntry.update({ where: { id: u.id }, data: { notes: u.notes } }),
      ),
    );
    return;
  }
  // Validate entries (manual tickets only)
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

// Phase 8: the "Complete Load" path. Idempotent — if the operator taps
// Complete Load twice (or returns later via the URL), they land on the
// existing draft rather than creating a duplicate.
export async function findOrCreateDraftForDispatch(
  operatorId: string,
  dispatchId: string,
) {
  const existing = await prisma.ticket.findUnique({ where: { dispatchId } });
  if (existing) {
    if (existing.operatorId !== operatorId) {
      throw new TicketError("FORBIDDEN", "That dispatch isn't yours.");
    }
    return existing;
  }
  return createDraft(operatorId, { dispatchId });
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
  const submittedAt = new Date();
  const lateBy = submittedAt.getTime() - t.date.getTime();

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: "SUBMITTED",
        signatureDataUrl,
        submittedAt,
        totalHours,
      },
    });

    // Auto-raise Owner exception when submitted past the configured window
    // (proposal §2.8 — "tickets submitted outside the expected window").
    if (lateBy > LATE_SUBMISSION_THRESHOLD_MS) {
      const hours = Math.round(lateBy / (60 * 60 * 1000));
      await raiseException(tx, {
        type: "TICKET_LATE_SUBMISSION",
        summary: `Ticket ${t.ticketNumber} submitted ${hours}h after haul date`,
        details:
          `Haul date: ${t.date.toISOString()}\n` +
          `Submitted: ${submittedAt.toISOString()}\n` +
          `Threshold: ${Math.round(LATE_SUBMISSION_THRESHOLD_MS / 3_600_000)}h`,
        ticketId,
      });
    }
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
  const wasFlagged = t.status === "FLAGGED";
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
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
    // If admin themselves overrode their flag, any PENDING TICKET_FLAGGED
    // exception for this ticket is now stale — auto-resolve so the Owner
    // queue stays clean (proposal §2.8 accountability).
    if (wasFlagged) {
      await autoResolvePendingForApprovedTicket(tx, ticketId);
    }
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
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
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
    // Dedupe: only raise a new TICKET_FLAGGED Exception if there isn't
    // already a PENDING one for this ticket (admin re-flagging the same
    // ticket shouldn't spam the Owner's queue).
    const existing = await tx.exception.findFirst({
      where: { ticketId, type: "TICKET_FLAGGED", status: "PENDING" },
      select: { id: true },
    });
    if (!existing) {
      await raiseException(tx, {
        type: "TICKET_FLAGGED",
        summary: `Ticket ${t.ticketNumber} flagged by admin`,
        details: trimmed,
        ticketId,
        createdById: actorUserId,
      });
    }
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
      photos: { orderBy: { uploadedAt: "asc" } },
      approvedBy: { select: { id: true, name: true, email: true } },
      flaggedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!t) throw new TicketError("NOT_FOUND", "Ticket not found.");
  return t;
}

// --- Photo upload (Phase 8) ---------------------------------------------

const PHOTO_DIR = (ticketId: string) =>
  path.join(process.cwd(), "public", "uploads", "tickets", ticketId);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function addTicketPhoto(
  operatorId: string,
  ticketId: string,
  buf: Buffer,
  originalName: string,
  mimeType: string,
) {
  await loadOwnDraft(operatorId, ticketId);

  const ext = ALLOWED_PHOTO_MIME[mimeType.toLowerCase()];
  if (!ext) {
    throw new TicketError("BAD_REQUEST", "Photo must be a JPEG, PNG, or WebP image.");
  }
  if (buf.byteLength > PHOTO_MAX_BYTES) {
    throw new TicketError("BAD_REQUEST", "Photo must be 5 MB or smaller.");
  }

  await fs.mkdir(PHOTO_DIR(ticketId), { recursive: true });
  const id = `c${crypto.randomBytes(12).toString("hex")}`;
  const filename = `${id}.${ext}`;
  await fs.writeFile(path.join(PHOTO_DIR(ticketId), filename), buf);

  return prisma.ticketPhoto.create({
    data: {
      id,
      ticketId,
      filename,
      originalName: originalName.slice(0, 200),
      mimeType,
      byteSize: buf.byteLength,
    },
  });
}

export async function deleteTicketPhoto(
  operatorId: string,
  ticketId: string,
  photoId: string,
): Promise<void> {
  await loadOwnDraft(operatorId, ticketId);
  const photo = await prisma.ticketPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.ticketId !== ticketId) {
    throw new TicketError("NOT_FOUND", "Photo not found.");
  }
  await fs.rm(path.join(PHOTO_DIR(ticketId), photo.filename), { force: true });
  await prisma.ticketPhoto.delete({ where: { id: photoId } });
}

export function ticketPhotoPublicUrl(ticketId: string, filename: string): string {
  return `/uploads/tickets/${ticketId}/${filename}`;
}

export const ticketInclude = {
  operator: {
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  },
  truck: { select: { id: true, licensePlate: true, type: true } },
  project: { select: { id: true, name: true, client: true } },
  dispatch: { select: { id: true, scheduledFor: true } },
} as const;

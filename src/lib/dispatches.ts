import type {
  DispatchAcceptance,
  DispatchStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export class DispatchError extends Error {
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

export type CreateDispatchInput = {
  projectId: string;
  operatorId: string;
  truckId: string;
  scheduledFor: Date;
  pickupNote?: string | null;
  dumpNote?: string | null;
  notes?: string | null;
};

export async function createDispatch(
  createdById: string,
  input: CreateDispatchInput,
) {
  if (input.scheduledFor.getTime() < Date.now() - 12 * 60 * 60 * 1000) {
    // Can backdate a few hours (e.g. early morning scheduling for "today")
    // but not arbitrarily into the past.
    throw new DispatchError(
      "BAD_REQUEST",
      "Scheduled time can't be more than 12 hours in the past.",
    );
  }

  // Sanity: project / operator / truck must exist; truck must not be
  // INACTIVE or MAINTENANCE (proposal §2.3).
  const [project, operator, truck] = await Promise.all([
    prisma.project.findUnique({ where: { id: input.projectId } }),
    prisma.operator.findUnique({
      where: { id: input.operatorId },
      include: { user: { select: { isActive: true } } },
    }),
    prisma.truck.findUnique({ where: { id: input.truckId } }),
  ]);
  if (!project) throw new DispatchError("NOT_FOUND", "Project not found.");
  if (!operator) throw new DispatchError("NOT_FOUND", "Operator not found.");
  if (!truck) throw new DispatchError("NOT_FOUND", "Truck not found.");
  if (project.status !== "ACTIVE") {
    throw new DispatchError("BAD_REQUEST", "Project is not active.");
  }
  if (!operator.user.isActive) {
    throw new DispatchError("BAD_REQUEST", "Operator account is deactivated.");
  }
  if (truck.status !== "ACTIVE") {
    throw new DispatchError(
      "BAD_REQUEST",
      `Truck status is ${truck.status} — only ACTIVE trucks can be dispatched.`,
    );
  }

  return prisma.dispatch.create({
    data: {
      projectId: input.projectId,
      operatorId: input.operatorId,
      truckId: input.truckId,
      scheduledFor: input.scheduledFor,
      pickupNote: input.pickupNote?.trim() || null,
      dumpNote: input.dumpNote?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById,
    },
  });
}

export type UpdateDispatchInput = Partial<{
  projectId: string;
  operatorId: string;
  truckId: string;
  scheduledFor: Date;
  pickupNote: string | null;
  dumpNote: string | null;
  notes: string | null;
}>;

export async function updateDispatch(id: string, input: UpdateDispatchInput) {
  const current = await prisma.dispatch.findUnique({ where: { id } });
  if (!current) throw new DispatchError("NOT_FOUND", "Dispatch not found.");
  if (current.status !== "IDLE") {
    throw new DispatchError(
      "INVALID_STATE",
      "Can only edit dispatches before the operator starts the trip.",
    );
  }
  const data: Prisma.DispatchUpdateInput = {};
  if (input.projectId !== undefined) data.project = { connect: { id: input.projectId } };
  if (input.operatorId !== undefined) data.operator = { connect: { id: input.operatorId } };
  if (input.truckId !== undefined) data.truck = { connect: { id: input.truckId } };
  if (input.scheduledFor !== undefined) data.scheduledFor = input.scheduledFor;
  if (input.pickupNote !== undefined) data.pickupNote = input.pickupNote?.trim() || null;
  if (input.dumpNote !== undefined) data.dumpNote = input.dumpNote?.trim() || null;
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  return prisma.dispatch.update({ where: { id }, data });
}

export async function deleteDispatch(id: string): Promise<void> {
  try {
    await prisma.dispatch.delete({ where: { id } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      throw new DispatchError("NOT_FOUND", "Dispatch not found.");
    }
    throw e;
  }
}

export async function cancelDispatch(id: string): Promise<void> {
  const current = await prisma.dispatch.findUnique({ where: { id } });
  if (!current) throw new DispatchError("NOT_FOUND", "Dispatch not found.");
  if (current.status === "COMPLETED") {
    throw new DispatchError("INVALID_STATE", "Already completed — can't cancel.");
  }
  if (current.status === "CANCELLED") return;
  await prisma.dispatch.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

// --- Operator actions -----------------------------------------------------

async function loadOwnDispatch(operatorId: string, dispatchId: string) {
  const d = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
  if (!d) throw new DispatchError("NOT_FOUND", "Dispatch not found.");
  if (d.operatorId !== operatorId) {
    throw new DispatchError(
      "FORBIDDEN",
      "Only the assigned operator can act on this dispatch.",
    );
  }
  return d;
}

export async function acceptDispatch(operatorId: string, dispatchId: string): Promise<void> {
  const d = await loadOwnDispatch(operatorId, dispatchId);
  if (d.status === "CANCELLED") {
    throw new DispatchError("INVALID_STATE", "This dispatch was cancelled.");
  }
  if (d.acceptance === "ACCEPTED") return; // idempotent
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { acceptance: "ACCEPTED", acceptedAt: new Date(), flagReason: null, flaggedAt: null },
  });
}

export async function flagDispatch(
  operatorId: string,
  dispatchId: string,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new DispatchError("BAD_REQUEST", "Tell us briefly what the issue is.");
  }
  const d = await loadOwnDispatch(operatorId, dispatchId);
  if (d.status === "CANCELLED") {
    throw new DispatchError("INVALID_STATE", "This dispatch was cancelled.");
  }
  if (d.status !== "IDLE") {
    throw new DispatchError(
      "INVALID_STATE",
      "Can't flag an issue once the trip has started — contact your admin.",
    );
  }
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      acceptance: "FLAGGED",
      flagReason: trimmed.slice(0, 500),
      flaggedAt: new Date(),
      acceptedAt: null,
    },
  });
}

// Operator "Start" — transitions to EN_ROUTE_TO_PICKUP.
// Phase 6 will hook GPS trip-tracking onto the same call site.
export async function startDispatch(operatorId: string, dispatchId: string): Promise<void> {
  const d = await loadOwnDispatch(operatorId, dispatchId);
  if (d.acceptance !== "ACCEPTED") {
    throw new DispatchError("INVALID_STATE", "Accept the dispatch first.");
  }
  if (d.status !== "IDLE") {
    throw new DispatchError("INVALID_STATE", "Trip already started.");
  }
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { status: "EN_ROUTE_TO_PICKUP", startedAt: new Date() },
  });
  // TODO Phase 6: kick off Trip + first GPS sample here.
}

// Operator forward-state transition.
const FORWARD: Partial<Record<DispatchStatus, DispatchStatus>> = {
  EN_ROUTE_TO_PICKUP: "LOADING",
  LOADING: "EN_ROUTE_TO_DUMP",
  EN_ROUTE_TO_DUMP: "COMPLETED",
};

export async function advanceDispatch(operatorId: string, dispatchId: string): Promise<DispatchStatus> {
  const d = await loadOwnDispatch(operatorId, dispatchId);
  const next = FORWARD[d.status];
  if (!next) {
    throw new DispatchError(
      "INVALID_STATE",
      `Can't advance from ${d.status}.`,
    );
  }
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      status: next,
      ...(next === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
  // TODO Phase 8: when next === "COMPLETED", trigger the eTicket submission flow.
  return next;
}

// --- Queries --------------------------------------------------------------

export type ListDispatchesFilters = {
  status?: DispatchStatus | "ALL";
  acceptance?: DispatchAcceptance | "ALL";
  projectId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeCancelled?: boolean;
};

export async function listDispatches(filters: ListDispatchesFilters = {}) {
  const where: Prisma.DispatchWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.acceptance && filters.acceptance !== "ALL") where.acceptance = filters.acceptance;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.fromDate || filters.toDate) {
    where.scheduledFor = {};
    if (filters.fromDate) (where.scheduledFor as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.scheduledFor as { lte?: Date }).lte = filters.toDate;
  }
  if (!filters.includeCancelled && (!filters.status || filters.status === "ALL")) {
    where.status = { not: "CANCELLED" };
  }

  return prisma.dispatch.findMany({
    where,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    include: dispatchInclude,
    take: 500,
  });
}

export async function listDispatchesForOperator(operatorId: string) {
  // Operator's view: upcoming + in-progress, excluding cancelled.
  // Include completed jobs from the last 24h so the operator has context.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.dispatch.findMany({
    where: {
      operatorId,
      status: { not: "CANCELLED" },
      OR: [
        { status: { notIn: ["COMPLETED"] } },
        { completedAt: { gte: yesterday } },
      ],
    },
    orderBy: [
      // PENDING/in-progress first, COMPLETED last; within each by date asc.
      { status: "asc" },
      { scheduledFor: "asc" },
    ],
    include: dispatchInclude,
    take: 50,
  });
}

export async function getDispatch(id: string) {
  const d = await prisma.dispatch.findUnique({
    where: { id },
    include: dispatchInclude,
  });
  if (!d) throw new DispatchError("NOT_FOUND", "Dispatch not found.");
  return d;
}

export const dispatchInclude = {
  project: { select: { id: true, name: true, client: true, address: true, status: true } },
  operator: {
    include: {
      user: { select: { id: true, name: true, employeeId: true, isActive: true } },
    },
  },
  truck: { select: { id: true, licensePlate: true, type: true, status: true, colour: true } },
} as const;

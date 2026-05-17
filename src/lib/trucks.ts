import type { Prisma, TruckStatus, TruckType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type CreateTruckInput = {
  licensePlate: string;
  type: TruckType;
  capacityTonnes: number;
  colour: string;
  status?: TruckStatus;
};

export type UpdateTruckInput = Partial<CreateTruckInput>;

export class TruckError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

function normalisePlate(p: string): string {
  return p.trim().toUpperCase().replace(/\s+/g, "");
}

function validate(input: CreateTruckInput | UpdateTruckInput): void {
  if (input.licensePlate !== undefined && input.licensePlate.trim().length < 2) {
    throw new TruckError("BAD_REQUEST", "License plate is required.");
  }
  if (input.capacityTonnes !== undefined && input.capacityTonnes <= 0) {
    throw new TruckError("BAD_REQUEST", "Capacity must be greater than zero.");
  }
  if (input.colour !== undefined && input.colour.trim().length === 0) {
    throw new TruckError("BAD_REQUEST", "Colour / ID tag is required.");
  }
}

export async function createTruck(input: CreateTruckInput) {
  validate(input);
  const licensePlate = normalisePlate(input.licensePlate);
  try {
    return await prisma.truck.create({
      data: {
        licensePlate,
        type: input.type,
        capacityTonnes: input.capacityTonnes,
        colour: input.colour.trim(),
        status: input.status ?? "ACTIVE",
      },
    });
  } catch (e) {
    if (isUniqueViolation(e, "licensePlate")) {
      throw new TruckError("CONFLICT", "A truck with that license plate already exists.");
    }
    throw e;
  }
}

export async function updateTruck(id: string, input: UpdateTruckInput) {
  validate(input);
  const data: Prisma.TruckUpdateInput = {};
  if (input.licensePlate !== undefined) data.licensePlate = normalisePlate(input.licensePlate);
  if (input.type !== undefined) data.type = input.type;
  if (input.capacityTonnes !== undefined) data.capacityTonnes = input.capacityTonnes;
  if (input.colour !== undefined) data.colour = input.colour.trim();
  if (input.status !== undefined) data.status = input.status;

  try {
    return await prisma.truck.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueViolation(e, "licensePlate")) {
      throw new TruckError("CONFLICT", "A truck with that license plate already exists.");
    }
    if (isRecordNotFound(e)) throw new TruckError("NOT_FOUND", "Truck not found.");
    throw e;
  }
}

export async function deleteTruck(id: string): Promise<void> {
  try {
    await prisma.truck.delete({ where: { id } });
  } catch (e) {
    if (isRecordNotFound(e)) throw new TruckError("NOT_FOUND", "Truck not found.");
    throw e;
  }
}

// Move truck → operator (or null to unassign). Closes prior assignment events
// on both sides in a single transaction so the audit trail and the
// `Truck.assignedOperatorId` denormalisation never diverge.
export async function assignTruck(
  truckId: string,
  operatorId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const truck = await tx.truck.findUnique({ where: { id: truckId } });
    if (!truck) throw new TruckError("NOT_FOUND", "Truck not found.");

    // Same assignment as before — no-op.
    if (truck.assignedOperatorId === operatorId) return;

    // Close any open event for the truck's prior operator (if any).
    if (truck.assignedOperatorId) {
      await tx.truckAssignmentEvent.updateMany({
        where: { truckId, releasedAt: null },
        data: { releasedAt: new Date() },
      });
    }

    if (operatorId) {
      // If the operator was driving a different truck, release that link too.
      const otherTruck = await tx.truck.findFirst({
        where: { assignedOperatorId: operatorId, NOT: { id: truckId } },
      });
      if (otherTruck) {
        await tx.truck.update({
          where: { id: otherTruck.id },
          data: { assignedOperatorId: null },
        });
        await tx.truckAssignmentEvent.updateMany({
          where: { truckId: otherTruck.id, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }

      await tx.truck.update({
        where: { id: truckId },
        data: { assignedOperatorId: operatorId },
      });
      await tx.truckAssignmentEvent.create({
        data: { truckId, operatorId, assignedAt: new Date() },
      });
    } else {
      await tx.truck.update({
        where: { id: truckId },
        data: { assignedOperatorId: null },
      });
    }
  });
}

export type ListTrucksFilters = {
  query?: string;
  status?: TruckStatus | "ALL";
  type?: TruckType | "ALL";
};

export async function listTrucks(filters: ListTrucksFilters = {}) {
  const where: Prisma.TruckWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.type && filters.type !== "ALL") where.type = filters.type;
  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { licensePlate: { contains: q, mode: "insensitive" } },
      { colour: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.truck.findMany({
    where,
    orderBy: [{ status: "asc" }, { licensePlate: "asc" }],
    include: {
      assignedOperator: { include: { user: { select: { name: true, employeeId: true } } } },
    },
    take: 200,
  });
}

// Trucks eligible for dispatch picker — required by proposal §2.3 ("trucks in
// those states are automatically excluded from dispatch"). Phase 5 wires the
// dispatch UI to this.
export function listAssignableTrucks() {
  return prisma.truck.findMany({
    where: { status: "ACTIVE" },
    orderBy: { licensePlate: "asc" },
    include: {
      assignedOperator: { include: { user: { select: { name: true, employeeId: true } } } },
    },
  });
}

export async function getTruck(id: string) {
  const truck = await prisma.truck.findUnique({
    where: { id },
    include: {
      assignedOperator: { include: { user: { select: { id: true, name: true, employeeId: true } } } },
    },
  });
  if (!truck) throw new TruckError("NOT_FOUND", "Truck not found.");
  return truck;
}

function isUniqueViolation(e: unknown, fieldName?: string): boolean {
  // Prisma 7 + PG adapter nests the constraint info under
  // meta.driverAdapterError.cause. Field names come back quoted ("licensePlate").
  // Fall back to the legacy meta.target shape for forward-compat.
  if (!e || typeof e !== "object") return false;
  const obj = e as {
    code?: string;
    meta?: {
      target?: string | string[];
      driverAdapterError?: { cause?: { kind?: string; constraint?: { fields?: string[] } } };
    };
  };
  const adapterCause = obj.meta?.driverAdapterError?.cause;
  const isUnique =
    obj.code === "P2002" || adapterCause?.kind === "UniqueConstraintViolation";
  if (!isUnique) return false;
  if (!fieldName) return true;

  const norm = (s: string) => s.replace(/^"|"$/g, "");
  const fields = (adapterCause?.constraint?.fields ?? []).map(norm);
  if (fields.includes(fieldName)) return true;

  const target = obj.meta?.target;
  if (Array.isArray(target)) return target.map(norm).includes(fieldName);
  return typeof target === "string" && norm(target) === fieldName;
}

function isRecordNotFound(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  return (e as { code?: string }).code === "P2025";
}

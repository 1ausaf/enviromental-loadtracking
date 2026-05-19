import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { GEOFENCE_RADIUS_M, haversineMetres } from "@/lib/gps-config";

export class DispatchLoadError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE",
    message: string,
  ) {
    super(message);
  }
}

// The operator's pickup/drop cycle is a strict state machine driven by the
// DispatchLoad table:
//   AWAITING_PICKUP — no incomplete row (last row is dropped, or none yet).
//                     Next action: enter pickup geofence, tap PICK UP LOAD.
//   AWAITING_DROPOFF — latest row has pickupAt set but no dropoffAt.
//                      Next action: enter drop geofence, tap DROP CONFIRMED.
//   COMPLETED       — loadsCompleted >= loadsAssigned.
//
// Determined by reading the latest row + counting completed rows. We don't
// store a separate "cycleState" column because that would be derivable
// state and we'd risk it drifting from the row data.
export type CycleState = "AWAITING_PICKUP" | "AWAITING_DROPOFF" | "COMPLETED";

export async function getDispatchLoadState(
  dispatchId: string,
): Promise<{
  state: CycleState;
  loadsCompleted: number;
  loadsAssigned: number;
  currentLoadNumber: number | null;
}> {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: {
      loadsAssigned: true,
      loadsCompleted: true,
      loads: {
        orderBy: { loadNumber: "desc" },
        take: 1,
      },
    },
  });
  if (!dispatch) {
    throw new DispatchLoadError("NOT_FOUND", "Dispatch not found.");
  }
  const latest = dispatch.loads[0] ?? null;
  if (dispatch.loadsCompleted >= dispatch.loadsAssigned) {
    return {
      state: "COMPLETED",
      loadsCompleted: dispatch.loadsCompleted,
      loadsAssigned: dispatch.loadsAssigned,
      currentLoadNumber: null,
    };
  }
  if (latest && latest.pickupAt && !latest.dropoffAt) {
    return {
      state: "AWAITING_DROPOFF",
      loadsCompleted: dispatch.loadsCompleted,
      loadsAssigned: dispatch.loadsAssigned,
      currentLoadNumber: latest.loadNumber,
    };
  }
  return {
    state: "AWAITING_PICKUP",
    loadsCompleted: dispatch.loadsCompleted,
    loadsAssigned: dispatch.loadsAssigned,
    currentLoadNumber: null,
  };
}

// Operator confirms pickup. Validates: dispatch belongs to operator, state
// is AWAITING_PICKUP, position is within the project's pickup geofence.
// Creates a new DispatchLoad row with pickupAt + coords. Idempotent at the
// "already in AWAITING_DROPOFF on this load" level (returns silently).
export async function confirmPickup(
  operatorId: string,
  dispatchId: string,
  pos: { latitude: number; longitude: number; accuracy: number | null },
): Promise<void> {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: {
      project: {
        select: { pickupLatitude: true, pickupLongitude: true },
      },
      loads: { orderBy: { loadNumber: "desc" }, take: 1 },
    },
  });
  if (!dispatch) {
    throw new DispatchLoadError("NOT_FOUND", "Dispatch not found.");
  }
  if (dispatch.operatorId !== operatorId) {
    throw new DispatchLoadError(
      "FORBIDDEN",
      "Only the assigned operator can confirm loads.",
    );
  }
  if (dispatch.status !== "EN_ROUTE_TO_PICKUP" && dispatch.status !== "EN_ROUTE_TO_DUMP") {
    throw new DispatchLoadError(
      "INVALID_STATE",
      "Start the haul before recording pickups.",
    );
  }
  if (dispatch.loadsCompleted >= dispatch.loadsAssigned) {
    throw new DispatchLoadError(
      "INVALID_STATE",
      "All loads on this dispatch are already complete.",
    );
  }
  const latest = dispatch.loads[0] ?? null;
  if (latest && latest.pickupAt && !latest.dropoffAt) {
    // Already at AWAITING_DROPOFF — the operator double-tapped.
    return;
  }
  const { pickupLatitude, pickupLongitude } = dispatch.project;
  if (pickupLatitude == null || pickupLongitude == null) {
    throw new DispatchLoadError(
      "BAD_REQUEST",
      "This project has no pickup location set. Ask an admin to drop a pin on the project page.",
    );
  }
  const distance = haversineMetres(
    pickupLatitude,
    pickupLongitude,
    pos.latitude,
    pos.longitude,
  );
  if (distance > GEOFENCE_RADIUS_M) {
    throw new DispatchLoadError(
      "INVALID_STATE",
      `You're ${Math.round(distance)}m from the pickup point — move within ${GEOFENCE_RADIUS_M}m to confirm.`,
    );
  }
  const nextLoadNumber = (latest?.loadNumber ?? 0) + 1;
  await prisma.$transaction(async (tx) => {
    await tx.dispatchLoad.create({
      data: {
        dispatchId,
        loadNumber: nextLoadNumber,
        pickupAt: new Date(),
        pickupLatitude: pos.latitude,
        pickupLongitude: pos.longitude,
        pickupAccuracy: pos.accuracy,
      },
    });
    // While in mid-cycle the dispatch status reflects "carrying" so the
    // admin board reads sensibly.
    await tx.dispatch.update({
      where: { id: dispatchId },
      data: { status: "EN_ROUTE_TO_DUMP" },
    });
  });
}

// Operator confirms drop-off. Validates geofence at the project's dump
// location, closes the in-flight DispatchLoad row, increments
// loadsCompleted, and if all loads are done flips dispatch → COMPLETED
// (and ends the GPS trip).
export async function confirmDropoff(
  operatorId: string,
  dispatchId: string,
  pos: { latitude: number; longitude: number; accuracy: number | null },
): Promise<{ loadsCompleted: number; loadsAssigned: number; complete: boolean }> {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: {
      project: {
        select: { dumpLatitude: true, dumpLongitude: true },
      },
      loads: { orderBy: { loadNumber: "desc" }, take: 1 },
    },
  });
  if (!dispatch) {
    throw new DispatchLoadError("NOT_FOUND", "Dispatch not found.");
  }
  if (dispatch.operatorId !== operatorId) {
    throw new DispatchLoadError(
      "FORBIDDEN",
      "Only the assigned operator can confirm loads.",
    );
  }
  const latest = dispatch.loads[0] ?? null;
  if (!latest || !latest.pickupAt) {
    throw new DispatchLoadError(
      "INVALID_STATE",
      "Confirm pickup before confirming drop-off.",
    );
  }
  if (latest.dropoffAt) {
    // Already dropped — idempotent.
    return {
      loadsCompleted: dispatch.loadsCompleted,
      loadsAssigned: dispatch.loadsAssigned,
      complete: dispatch.loadsCompleted >= dispatch.loadsAssigned,
    };
  }
  const { dumpLatitude, dumpLongitude } = dispatch.project;
  if (dumpLatitude == null || dumpLongitude == null) {
    throw new DispatchLoadError(
      "BAD_REQUEST",
      "This project has no dump location set. Ask an admin to drop a pin on the project page.",
    );
  }
  const distance = haversineMetres(
    dumpLatitude,
    dumpLongitude,
    pos.latitude,
    pos.longitude,
  );
  if (distance > GEOFENCE_RADIUS_M) {
    throw new DispatchLoadError(
      "INVALID_STATE",
      `You're ${Math.round(distance)}m from the dump point — move within ${GEOFENCE_RADIUS_M}m to confirm.`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.dispatchLoad.update({
      where: { id: latest.id },
      data: {
        dropoffAt: new Date(),
        dropoffLatitude: pos.latitude,
        dropoffLongitude: pos.longitude,
        dropoffAccuracy: pos.accuracy,
      },
    });
    const updated = await tx.dispatch.update({
      where: { id: dispatchId },
      data: {
        loadsCompleted: { increment: 1 },
        // Until proven otherwise we're heading back to pickup. If this drop
        // was the final load, the next branch flips to COMPLETED.
        status: "EN_ROUTE_TO_PICKUP",
      },
      select: { loadsCompleted: true, loadsAssigned: true },
    });
    if (updated.loadsCompleted >= updated.loadsAssigned) {
      await tx.dispatch.update({
        where: { id: dispatchId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      // Close the trip so late GPS samples are dropped.
      await tx.trip.updateMany({
        where: { dispatchId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
    return updated;
  });

  return {
    loadsCompleted: result.loadsCompleted,
    loadsAssigned: result.loadsAssigned,
    complete: result.loadsCompleted >= result.loadsAssigned,
  };
}

// Admin-only safety valve. If the geofence misfires (bad GPS, broken phone)
// and the operator can't trigger a confirmation, an admin can record the
// load manually. Records the geofence skip in the row's accuracy field as a
// sentinel (-1) so audits can tell apart machine vs human entries.
export async function adminRecordLoad(
  dispatchId: string,
  loadNumber: number,
  pickupAt: Date,
  dropoffAt: Date,
): Promise<void> {
  if (dropoffAt < pickupAt) {
    throw new DispatchLoadError("BAD_REQUEST", "Drop-off must be after pickup.");
  }
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: { loadsAssigned: true, loadsCompleted: true },
  });
  if (!dispatch) throw new DispatchLoadError("NOT_FOUND", "Dispatch not found.");
  if (loadNumber < 1 || loadNumber > dispatch.loadsAssigned) {
    throw new DispatchLoadError(
      "BAD_REQUEST",
      `Load number must be between 1 and ${dispatch.loadsAssigned}.`,
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.dispatchLoad.upsert({
      where: { dispatchId_loadNumber: { dispatchId, loadNumber } },
      create: {
        dispatchId,
        loadNumber,
        pickupAt,
        pickupAccuracy: -1,
        dropoffAt,
        dropoffAccuracy: -1,
      },
      update: {
        pickupAt,
        pickupAccuracy: -1,
        dropoffAt,
        dropoffAccuracy: -1,
      },
    });
    const count = await tx.dispatchLoad.count({
      where: { dispatchId, dropoffAt: { not: null } },
    });
    await tx.dispatch.update({
      where: { id: dispatchId },
      data: {
        loadsCompleted: count,
        ...(count >= dispatch.loadsAssigned
          ? { status: "COMPLETED", completedAt: new Date() }
          : {}),
      },
    });
    if (count >= dispatch.loadsAssigned) {
      await tx.trip.updateMany({
        where: { dispatchId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
  });
}

// Live aggregates for the project page. Includes how much of the pool is
// still unassigned so admins can quickly see "30 loads left to dispatch".
export async function getProjectLoadPool(projectId: string): Promise<{
  totalLoads: number;
  loadsAssigned: number;
  loadsCompleted: number;
  loadsUnassigned: number;
  perDispatch: Array<{
    dispatchId: string;
    operatorName: string;
    loadsAssigned: number;
    loadsCompleted: number;
  }>;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { loadTarget: true },
  });
  if (!project) {
    return {
      totalLoads: 0,
      loadsAssigned: 0,
      loadsCompleted: 0,
      loadsUnassigned: 0,
      perDispatch: [],
    };
  }
  const dispatches = await prisma.dispatch.findMany({
    where: { projectId, status: { not: "CANCELLED" } },
    select: {
      id: true,
      loadsAssigned: true,
      loadsCompleted: true,
      operator: { include: { user: { select: { name: true } } } },
    },
    orderBy: { scheduledFor: "asc" },
  });
  const loadsAssigned = dispatches.reduce((sum, d) => sum + d.loadsAssigned, 0);
  const loadsCompleted = dispatches.reduce((sum, d) => sum + d.loadsCompleted, 0);
  return {
    totalLoads: project.loadTarget,
    loadsAssigned,
    loadsCompleted,
    loadsUnassigned: Math.max(0, project.loadTarget - loadsAssigned),
    perDispatch: dispatches.map((d) => ({
      dispatchId: d.id,
      operatorName: d.operator.user.name,
      loadsAssigned: d.loadsAssigned,
      loadsCompleted: d.loadsCompleted,
    })),
  };
}

// Used by ticket prefill — returns the sequence of completed loads with
// their pickup/drop timestamps, sorted by loadNumber.
export async function getCompletedLoads(
  dispatchId: string,
): Promise<
  Array<{
    loadNumber: number;
    pickupAt: Date | null;
    dropoffAt: Date | null;
  }>
> {
  const rows = await prisma.dispatchLoad.findMany({
    where: { dispatchId },
    orderBy: { loadNumber: "asc" },
    select: { loadNumber: true, pickupAt: true, dropoffAt: true },
  });
  return rows;
}

// Convenience helper for the operator card — counts how much of the pool
// is already eaten by other dispatches on the same project so the
// loadsAssigned field can validate "X loads still available".
export async function projectRemainingForDispatch(
  projectId: string,
  excludeDispatchId: string | null = null,
): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { loadTarget: true },
  });
  if (!project) return 0;
  const where: Prisma.DispatchWhereInput = {
    projectId,
    status: { not: "CANCELLED" },
  };
  if (excludeDispatchId) where.id = { not: excludeDispatchId };
  const agg = await prisma.dispatch.aggregate({
    where,
    _sum: { loadsAssigned: true },
  });
  return Math.max(0, project.loadTarget - (agg._sum.loadsAssigned ?? 0));
}

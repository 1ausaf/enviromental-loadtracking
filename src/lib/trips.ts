import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { haversineMetres } from "@/lib/gps-config";

export class TripError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

// Create the trip row when the operator taps Start on a dispatch.
// Called from src/lib/dispatches.ts#startDispatch as a single transaction
// alongside the dispatch state flip.
export async function startTripForDispatch(
  tx: Prisma.TransactionClient,
  dispatch: {
    id: string;
    operatorId: string;
    truckId: string;
    projectId: string;
    pickupNote: string | null;
    dumpNote: string | null;
  },
) {
  return tx.trip.create({
    data: {
      dispatchId: dispatch.id,
      operatorId: dispatch.operatorId,
      truckId: dispatch.truckId,
      projectId: dispatch.projectId,
      pickupNote: dispatch.pickupNote,
      dumpNote: dispatch.dumpNote,
    },
  });
}

// Close out the trip when the operator marks the dispatch COMPLETED.
export async function endTripForDispatch(
  tx: Prisma.TransactionClient,
  dispatchId: string,
) {
  await tx.trip.updateMany({
    where: { dispatchId, endedAt: null },
    data: { endedAt: new Date() },
  });
}

export type GpsPoint = {
  recordedAt: Date;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
};

// Append a batch of GPS samples to a trip and refresh its derived stats.
// The browser is throttled to ~30s / ~200m so a "batch" is usually 1-5 points.
export async function appendPoints(
  tripId: string,
  operatorId: string,
  points: GpsPoint[],
): Promise<{ accepted: number }> {
  if (points.length === 0) return { accepted: 0 };

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new TripError("NOT_FOUND", "Trip not found.");
  if (trip.operatorId !== operatorId) {
    throw new TripError("FORBIDDEN", "Only the trip's operator can post GPS samples.");
  }
  if (trip.endedAt) {
    // Trip is closed — silently drop late samples rather than error.
    return { accepted: 0 };
  }

  const sorted = [...points]
    .filter(validPoint)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  if (sorted.length === 0) return { accepted: 0 };

  await prisma.$transaction(async (tx) => {
    await tx.tripPoint.createMany({
      data: sorted.map((p) => ({
        tripId,
        recordedAt: p.recordedAt,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy ?? null,
        speed: p.speed ?? null,
        heading: p.heading ?? null,
      })),
    });

    // Compute new aggregates: starting from current trip state, add the new
    // distances by walking from the previous endpoint through each new point.
    const last = sorted[sorted.length - 1]!;
    let totalDistance = trip.totalDistanceM ?? 0;
    let prevLat = trip.endLatitude;
    let prevLng = trip.endLongitude;
    for (const p of sorted) {
      if (prevLat !== null && prevLng !== null) {
        totalDistance += haversineMetres(prevLat, prevLng, p.latitude, p.longitude);
      }
      prevLat = p.latitude;
      prevLng = p.longitude;
    }

    await tx.trip.update({
      where: { id: tripId },
      data: {
        pointCount: { increment: sorted.length },
        endLatitude: last.latitude,
        endLongitude: last.longitude,
        totalDistanceM: totalDistance,
        ...(trip.startLatitude === null
          ? {
              startLatitude: sorted[0]!.latitude,
              startLongitude: sorted[0]!.longitude,
            }
          : {}),
      },
    });
  });

  return { accepted: sorted.length };
}

function validPoint(p: GpsPoint): boolean {
  return (
    Number.isFinite(p.latitude) &&
    p.latitude >= -90 &&
    p.latitude <= 90 &&
    Number.isFinite(p.longitude) &&
    p.longitude >= -180 &&
    p.longitude <= 180 &&
    p.recordedAt instanceof Date &&
    !isNaN(p.recordedAt.getTime())
  );
}

// --- Queries -------------------------------------------------------------

export type TripsFilters = {
  operatorId?: string;
  projectId?: string;
  truckId?: string;
  fromDate?: Date;
  toDate?: Date;
  query?: string;
  activeOnly?: boolean;
};

export async function listTrips(filters: TripsFilters = {}) {
  const where: Prisma.TripWhereInput = {};
  if (filters.operatorId) where.operatorId = filters.operatorId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.truckId) where.truckId = filters.truckId;
  if (filters.activeOnly) where.endedAt = null;
  if (filters.fromDate || filters.toDate) {
    where.startedAt = {};
    if (filters.fromDate) (where.startedAt as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.startedAt as { lte?: Date }).lte = filters.toDate;
  }
  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { pickupNote: { contains: q, mode: "insensitive" } },
      { dumpNote: { contains: q, mode: "insensitive" } },
      { operator: { user: { name: { contains: q, mode: "insensitive" } } } },
      { truck: { licensePlate: { contains: q, mode: "insensitive" } } },
      { project: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  return prisma.trip.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: tripInclude,
    take: 200,
  });
}

export async function getTrip(id: string) {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      ...tripInclude,
      points: {
        orderBy: { recordedAt: "asc" },
      },
    },
  });
  if (!trip) throw new TripError("NOT_FOUND", "Trip not found.");
  return trip;
}

// Trip-count analytics — group by (pickup, dump, project) per proposal §2.5
// ("count of trips between Site A and Site B per shift or project").
// "Per shift" needs a shift concept we don't have yet; we group by day.
export async function listRouteCounts(filters: TripsFilters = {}) {
  const where: Prisma.TripWhereInput = { endedAt: { not: null } };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.fromDate || filters.toDate) {
    where.startedAt = {};
    if (filters.fromDate) (where.startedAt as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.startedAt as { lte?: Date }).lte = filters.toDate;
  }
  const rows = await prisma.trip.groupBy({
    by: ["pickupNote", "dumpNote", "projectId"],
    where,
    _count: { _all: true },
    orderBy: { _count: { dispatchId: "desc" } },
    take: 50,
  });
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const projects =
    projectIds.length === 0
      ? []
      : await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        });
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    pickup: r.pickupNote ?? "(unspecified)",
    dump: r.dumpNote ?? "(unspecified)",
    projectId: r.projectId,
    projectName: nameById.get(r.projectId) ?? "(deleted project)",
    count: r._count._all,
  }));
}

export const tripInclude = {
  operator: {
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  },
  truck: { select: { id: true, licensePlate: true, type: true, colour: true } },
  project: { select: { id: true, name: true, client: true } },
  dispatch: { select: { id: true, scheduledFor: true, status: true } },
} as const;

import { prisma } from "@/lib/db";

// Per-truck and per-operator stats per proposal §2.3.
// Now backed by real Ticket data (Phase 7). "Loads" = APPROVED tickets;
// SUBMITTED tickets are still pending admin review so they're not counted
// toward the official totals.

export type TruckStats = {
  totalLoads: number;
  activeHours: number;
};

export type OperatorLoadCounts = {
  daily: number;
  weekly: number;
  perProject: Array<{ projectId: string; projectName: string; count: number }>;
};

export async function getTruckStats(truckId: string): Promise<TruckStats> {
  const [count, agg] = await Promise.all([
    prisma.ticket.count({ where: { truckId, status: "APPROVED" } }),
    prisma.ticket.aggregate({
      where: { truckId, status: "APPROVED" },
      _sum: { totalHours: true },
    }),
  ]);
  return {
    totalLoads: count,
    activeHours: Math.round((agg._sum.totalHours ?? 0) * 10) / 10,
  };
}

export async function getOperatorLoadCounts(
  operatorId: string,
): Promise<OperatorLoadCounts> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // ISO week starts Monday.
  const weekStart = new Date(todayStart);
  const day = weekStart.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // 0 if Monday
  weekStart.setDate(weekStart.getDate() - diff);

  const [daily, weekly, perProjectRows] = await Promise.all([
    prisma.ticket.count({
      where: { operatorId, status: "APPROVED", date: { gte: todayStart } },
    }),
    prisma.ticket.count({
      where: { operatorId, status: "APPROVED", date: { gte: weekStart } },
    }),
    prisma.ticket.groupBy({
      by: ["projectId"],
      where: { operatorId, status: "APPROVED", projectId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const projectIds = perProjectRows
    .map((r) => r.projectId)
    .filter((id): id is string => !!id);
  const projects =
    projectIds.length === 0
      ? []
      : await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        });
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  return {
    daily,
    weekly,
    perProject: perProjectRows
      .filter((r) => r.projectId !== null)
      .map((r) => ({
        projectId: r.projectId!,
        projectName: nameById.get(r.projectId!) ?? "(deleted project)",
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

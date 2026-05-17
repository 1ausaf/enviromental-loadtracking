// Per-truck and per-operator stats per proposal §2.3.
// Ticket and Trip models land in Phases 6 and 7 — until then these helpers
// return zeros so the UI structure is real but the numbers are placeholders.
// When Phases 6/7 ship, replace the bodies with the actual aggregations.

export type TruckStats = {
  totalLoads: number;
  activeHours: number;
};

export type OperatorLoadCounts = {
  daily: number;
  weekly: number;
  perProject: Array<{ projectId: string; projectName: string; count: number }>;
};

export async function getTruckStats(_truckId: string): Promise<TruckStats> {
  // Phase 7: count Ticket rows where truckId = _truckId.
  // Phase 6: sum (trip.endedAt - trip.startedAt) where truckId = _truckId.
  return { totalLoads: 0, activeHours: 0 };
}

export async function getOperatorLoadCounts(
  _operatorId: string,
): Promise<OperatorLoadCounts> {
  // Phase 7: count Ticket rows by operator, bucketed by createdAt (today /
  // current ISO week) and grouped by projectId.
  return { daily: 0, weekly: 0, perProject: [] };
}

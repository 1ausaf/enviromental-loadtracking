import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listDispatchesForOperator } from "@/lib/dispatches";
import { AutoRefresh } from "@/components/AutoRefresh";
import type { CycleState } from "@/components/GpsSessionLock";
import { OperatorDispatchCard } from "./OperatorDispatchCard";

export const dynamic = "force-dynamic";

// Derive the cycle state from the dispatch row + its latest load. Kept
// inline here (rather than dispatch-loads.ts) so the operator page can do
// it in-memory off the listDispatchesForOperator result without N+1 round
// trips.
function deriveCycleState(d: {
  loadsAssigned: number;
  loadsCompleted: number;
  loads: { pickupAt: Date | null; dropoffAt: Date | null }[];
}): CycleState {
  if (d.loadsCompleted >= d.loadsAssigned) return "COMPLETED";
  const latest = d.loads[0] ?? null;
  if (latest && latest.pickupAt && !latest.dropoffAt) return "AWAITING_DROPOFF";
  return "AWAITING_PICKUP";
}

export default async function OperatorPage() {
  const user = await requireUser("OPERATOR");

  // Find this user's Operator profile. Admins/Owners can view this page too
  // but they're not operators — show an empty state if so.
  const op = await prisma.operator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!op) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Only operator accounts have dispatches. Sign in as an operator to use
        this screen.
      </div>
    );
  }

  const dispatches = await listDispatchesForOperator(op.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            My dispatches
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {dispatches.length} upcoming or in progress. Accept new ones, flag
            issues, and tap Start when you&apos;re ready to roll.
          </p>
        </div>
        <AutoRefresh intervalMs={8000} label="Refreshing" />
      </div>

      {dispatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No dispatches right now. New assignments show up here automatically.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {dispatches.map((d) => (
            <OperatorDispatchCard
              key={d.id}
              data={{
                id: d.id,
                scheduledFor: d.scheduledFor.toISOString(),
                acceptance: d.acceptance,
                status: d.status,
                flagReason: d.flagReason,
                project: {
                  name: d.project.name,
                  client: d.project.client,
                  pickupLat: d.project.pickupLatitude,
                  pickupLng: d.project.pickupLongitude,
                  dumpLat: d.project.dumpLatitude,
                  dumpLng: d.project.dumpLongitude,
                },
                truck: { licensePlate: d.truck.licensePlate, colour: d.truck.colour },
                pickupNote: d.pickupNote,
                dumpNote: d.dumpNote,
                notes: d.notes,
                tripId: d.trip?.endedAt ? null : d.trip?.id ?? null,
                loadsAssigned: d.loadsAssigned,
                loadsCompleted: d.loadsCompleted,
                cycleState: deriveCycleState(d),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

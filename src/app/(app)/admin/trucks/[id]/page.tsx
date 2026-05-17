import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getTruck, TruckError } from "@/lib/trucks";
import { listOperators } from "@/lib/operators";
import { getTruckStats } from "@/lib/stats";
import { notFound } from "next/navigation";
import { TruckEditForm } from "./TruckEditForm";
import { AssignmentForm } from "./AssignmentForm";
import { TruckStatusBadge, truckTypeLabel } from "@/components/TruckBadges";

export const dynamic = "force-dynamic";

export default async function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;

  let truck;
  try {
    truck = await getTruck(id);
  } catch (e) {
    if (e instanceof TruckError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const [operators, stats] = await Promise.all([
    listOperators(),
    getTruckStats(id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/trucks"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to trucks
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {truck.licensePlate}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {truckTypeLabel(truck.type)} &middot; {truck.capacityTonnes} t
              &middot; {truck.colour}
            </p>
          </div>
          <TruckStatusBadge status={truck.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Stats</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Phase 7 wires these to live tickets &amp; trips.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Total loads" value={stats.totalLoads.toLocaleString()} />
            <Stat label="Active hours" value={stats.activeHours.toLocaleString()} />
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Operator assignment</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Reassignable any time. Auto-released when the truck is deleted.
          </p>
          <div className="mt-4">
            <AssignmentForm
              truckId={truck.id}
              currentOperatorId={truck.assignedOperatorId}
              operators={operators.map((o) => ({
                id: o.id,
                name: o.user.name,
                employeeId: o.user.employeeId,
                isActive: o.user.isActive,
              }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-900">Edit truck</h2>
        <div className="mt-4">
          <TruckEditForm
            id={truck.id}
            initial={{
              licensePlate: truck.licensePlate,
              type: truck.type,
              capacityTonnes: truck.capacityTonnes,
              colour: truck.colour,
              status: truck.status,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}

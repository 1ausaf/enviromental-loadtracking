import Link from "next/link";
import type { TruckStatus, TruckType } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { listTrucks } from "@/lib/trucks";
import { TrucksFilters } from "./TrucksFilters";
import { TruckStatusBadge, truckTypeLabel } from "@/components/TruckBadges";

export const dynamic = "force-dynamic";

const TYPES: TruckType[] = ["TRI_AXLE", "END_DUMP", "LIVE_BOTTOM", "FLOAT"];
const STATUSES: TruckStatus[] = ["ACTIVE", "MAINTENANCE", "INACTIVE"];

export default async function TrucksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  await requireUser("ADMIN");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status: TruckStatus | "ALL" =
    params.status && (STATUSES as string[]).includes(params.status)
      ? (params.status as TruckStatus)
      : "ALL";
  const type: TruckType | "ALL" =
    params.type && (TYPES as string[]).includes(params.type)
      ? (params.type as TruckType)
      : "ALL";

  const trucks = await listTrucks({ query, status, type });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Trucks
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {trucks.length} result{trucks.length === 1 ? "" : "s"} &middot; create,
            assign, retire equipment.
          </p>
        </div>
        <Link
          href="/admin/trucks/new"
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + New truck
        </Link>
      </div>

      <TrucksFilters initial={{ q: query, status, type }} />

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Plate</th>
              <th className="px-4 py-3 hidden sm:table-cell">Type</th>
              <th className="px-4 py-3 hidden md:table-cell">Capacity</th>
              <th className="px-4 py-3 hidden lg:table-cell">Colour / ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden md:table-cell">Operator</th>
              <th className="px-4 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {trucks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No trucks match these filters.
                </td>
              </tr>
            ) : (
              trucks.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                    {t.licensePlate}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 sm:table-cell">
                    {truckTypeLabel(t.type)}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                    {t.capacityTonnes} t
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 lg:table-cell">
                    {t.colour}
                  </td>
                  <td className="px-4 py-3">
                    <TruckStatusBadge status={t.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                    {t.assignedOperator?.user ? (
                      <>
                        <div>{t.assignedOperator.user.name}</div>
                        {t.assignedOperator.user.employeeId ? (
                          <div className="text-xs text-zinc-500">
                            {t.assignedOperator.user.employeeId}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs italic text-zinc-400">unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/trucks/${t.id}`}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

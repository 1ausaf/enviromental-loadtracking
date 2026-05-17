import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listOperators } from "@/lib/operators";
import { listProjects } from "@/lib/projects";
import { listTrips, listRouteCounts } from "@/lib/trips";
import { GpsFilters } from "./GpsFilters";
import { ExportButtons } from "@/components/ExportButtons";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const durFmt = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });

export default async function GpsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    operator?: string;
    project?: string;
    from?: string;
    to?: string;
    activeOnly?: string;
  }>;
}) {
  await requireUser("ADMIN");
  const sp = await searchParams;
  const operatorId = sp.operator || undefined;
  const projectId = sp.project || undefined;
  const query = sp.q?.trim() || undefined;
  const fromDate = parseDate(sp.from);
  const toDate = parseDate(sp.to);
  const activeOnly = sp.activeOnly === "1";

  const [trips, operators, projects, routes] = await Promise.all([
    listTrips({ operatorId, projectId, fromDate, toDate, query, activeOnly }),
    listOperators(),
    listProjects({ status: "ALL" }),
    listRouteCounts({ projectId, fromDate, toDate }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            GPS history
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {trips.length} trip{trips.length === 1 ? "" : "s"} match. Click any row
            to replay the full route on a map.
          </p>
        </div>
        <ExportButtons basePath="/api/exports/trips" />
      </div>

      <GpsFilters
        initial={{
          q: query ?? "",
          operator: operatorId ?? "ALL",
          project: projectId ?? "ALL",
          from: sp.from ?? "",
          to: sp.to ?? "",
          activeOnly,
        }}
        operators={operators.map((o) => ({
          id: o.id,
          name: o.user.name,
          employeeId: o.user.employeeId,
        }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3 hidden sm:table-cell">Truck</th>
              <th className="px-4 py-3 hidden md:table-cell">Project</th>
              <th className="px-4 py-3 hidden lg:table-cell">Route</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden sm:table-cell">Points</th>
              <th className="px-4 py-3 hidden lg:table-cell">Distance</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {trips.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No trips match these filters.
                </td>
              </tr>
            ) : (
              trips.map((t) => {
                const elapsed = t.endedAt
                  ? Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60000)
                  : null;
                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                      {dtFmt.format(t.startedAt)}
                      {elapsed !== null ? (
                        <div className="text-xs text-zinc-500">{durFmt.format(elapsed)} min</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div>{t.operator.user.name}</div>
                      {t.operator.user.employeeId ? (
                        <div className="text-xs text-zinc-500">{t.operator.user.employeeId}</div>
                      ) : null}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-zinc-700 sm:table-cell">
                      {t.truck.licensePlate}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                      {t.project.name}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-zinc-600 lg:table-cell">
                      {t.pickupNote ?? "—"}
                      <div className="text-zinc-400">↓</div>
                      {t.dumpNote ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.endedAt ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200">
                          Ended
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-inset ring-sky-200">
                          Live
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-zinc-700 sm:table-cell">
                      {t.pointCount.toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-zinc-700 lg:table-cell">
                      {t.totalDistanceM === null
                        ? "—"
                        : `${(t.totalDistanceM / 1000).toFixed(1)} km`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/gps/${t.id}`}
                        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Replay
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Top routes</h2>
        <p className="text-xs text-zinc-500">
          Pickup → dump frequency, completed trips only. Date filter above applies.
        </p>
        {routes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No completed trips yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 text-sm">
            {routes.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span className="min-w-0 truncate">
                  <strong className="text-zinc-900">{r.pickup}</strong>
                  <span className="mx-2 text-zinc-400">→</span>
                  <strong className="text-zinc-900">{r.dump}</strong>
                  <span className="ml-2 text-xs text-zinc-500">({r.projectName})</span>
                </span>
                <span className="ml-2 font-mono text-sm text-zinc-700">
                  {r.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

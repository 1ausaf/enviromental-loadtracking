import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listDispatches } from "@/lib/dispatches";
import { listProjects } from "@/lib/projects";
import type { DispatchAcceptance, DispatchStatus } from "@/generated/prisma/client";
import { AutoRefresh } from "@/components/AutoRefresh";
import { AcceptanceBadge, StatusBadge } from "@/components/DispatchBadges";
import { fmtDateTime } from "@/lib/format";
import { DispatchBoardFilters } from "./DispatchBoardFilters";

export const dynamic = "force-dynamic";

const ACCEPT_VALUES: DispatchAcceptance[] = ["PENDING", "ACCEPTED", "FLAGGED"];
const STATUS_VALUES: DispatchStatus[] = [
  "IDLE",
  "EN_ROUTE_TO_PICKUP",
  "LOADING",
  "EN_ROUTE_TO_DUMP",
  "COMPLETED",
  "CANCELLED",
];

export default async function DispatchBoardPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    acceptance?: string;
    project?: string;
    includeCancelled?: string;
  }>;
}) {
  await requireUser("ADMIN");
  const params = await searchParams;
  const status: DispatchStatus | "ALL" =
    params.status && (STATUS_VALUES as string[]).includes(params.status)
      ? (params.status as DispatchStatus)
      : "ALL";
  const acceptance: DispatchAcceptance | "ALL" =
    params.acceptance && (ACCEPT_VALUES as string[]).includes(params.acceptance)
      ? (params.acceptance as DispatchAcceptance)
      : "ALL";
  const projectId = params.project || undefined;
  const includeCancelled = params.includeCancelled === "1";

  const [dispatches, projects] = await Promise.all([
    listDispatches({ status, acceptance, projectId, includeCancelled }),
    listProjects({ status: "ALL" }),
  ]);

  const counts = {
    pending: dispatches.filter((d) => d.acceptance === "PENDING" && d.status !== "CANCELLED").length,
    flagged: dispatches.filter((d) => d.acceptance === "FLAGGED").length,
    inProgress: dispatches.filter(
      (d) => d.status !== "IDLE" && d.status !== "COMPLETED" && d.status !== "CANCELLED",
    ).length,
    completed: dispatches.filter((d) => d.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Dispatch board
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Live haul status across the operation. Updates pull in automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh intervalMs={5000} label="Refreshing" />
          <Link
            href="/admin/dispatch/new"
            className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + New dispatch
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Pending acceptance" value={counts.pending} tone={counts.pending > 0 ? "warn" : undefined} />
        <StatTile label="Flagged" value={counts.flagged} tone={counts.flagged > 0 ? "alert" : undefined} />
        <StatTile label="In progress" value={counts.inProgress} />
        <StatTile label="Completed" value={counts.completed} />
      </div>

      <DispatchBoardFilters
        initial={{
          status,
          acceptance,
          project: projectId ?? "ALL",
          includeCancelled,
        }}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3 hidden md:table-cell">Truck</th>
              <th className="px-4 py-3 text-right">Loads</th>
              <th className="px-4 py-3">Acceptance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {dispatches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No dispatches match these filters.{" "}
                  <Link href="/admin/dispatch/new" className="underline hover:text-zinc-900">
                    Schedule one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              dispatches.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                    {fmtDateTime(d.scheduledFor)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{d.project.name}</div>
                    <div className="text-xs text-zinc-500">{d.project.client}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <div>{d.operator.user.name}</div>
                    {d.operator.user.employeeId ? (
                      <div className="text-xs text-zinc-500">{d.operator.user.employeeId}</div>
                    ) : null}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-zinc-700 md:table-cell">
                    {d.truck.licensePlate}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                    {d.loadsCompleted} / {d.loadsAssigned}
                  </td>
                  <td className="px-4 py-3">
                    <AcceptanceBadge value={d.acceptance} />
                    {d.acceptance === "FLAGGED" && d.flagReason ? (
                      <div className="mt-1 max-w-[200px] truncate text-xs text-red-700" title={d.flagReason}>
                        {d.flagReason}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={d.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/dispatch/${d.id}`}
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

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "alert";
}) {
  const valueClass =
    tone === "alert" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-zinc-900";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

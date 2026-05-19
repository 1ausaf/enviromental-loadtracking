import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getProject,
  getProjectProgress,
  getFlaggedIssueCount,
  ProjectError,
} from "@/lib/projects";
import { getProjectLoadPool } from "@/lib/dispatch-loads";
import { listOperators } from "@/lib/operators";
import { listTrucks } from "@/lib/trucks";
import { ProgressBar } from "@/components/ProgressBar";
import { ExportButtons } from "@/components/ExportButtons";
import { fmtDate } from "@/lib/format";
import { ProjectForm } from "../ProjectForm";
import { OperatorPicker } from "./OperatorPicker";
import { TruckPicker } from "./TruckPicker";
import { DocumentsPanel } from "./DocumentsPanel";

export const dynamic = "force-dynamic";

const moneyFmt = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;

  let project;
  try {
    project = await getProject(id);
  } catch (e) {
    if (e instanceof ProjectError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const [progress, issueCount, allOperators, allTrucks, pool] = await Promise.all([
    getProjectProgress(id, project.loadTarget),
    getFlaggedIssueCount(id),
    listOperators(),
    listTrucks({ status: "ALL" }),
    getProjectLoadPool(id),
  ]);

  const assignedOpIds = new Set(project.operators.map((o) => o.operatorId));
  const assignedTruckIds = new Set(project.trucks.map((t) => t.truckId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/projects"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to projects
        </Link>
        <ExportButtons basePath={`/api/exports/projects/${project.id}`} forwardFilters={false} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{project.client}</p>
            <p className="text-sm text-zinc-500">{project.address}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
              project.status === "ACTIVE"
                ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
                : "bg-zinc-200 text-zinc-700 ring-zinc-300"
            }`}
          >
            {project.status === "ACTIVE" ? "Active" : "Completed"}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-700 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Start</dt>
            <dd>{fmtDate(project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">End</dt>
            <dd>
              {project.endDate ? (
                fmtDate(project.endDate)
              ) : (
                <span className="italic text-zinc-400">open-ended</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Budget</dt>
            <dd className="font-mono">{moneyFmt.format(project.materialBudget)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Target</dt>
            <dd className="font-mono">{project.loadTarget.toLocaleString()} loads</dd>
          </div>
        </dl>
        <div className="mt-6">
          <ProgressBar completed={progress.completedLoads} target={project.loadTarget} />
        </div>

        {/* Load pool breakdown — sum across all non-cancelled dispatches.
            Helps admins see how much of the project's load target is still
            unassigned vs already in flight. */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm sm:grid-cols-4">
          <PoolStat label="Total" value={pool.totalLoads.toLocaleString()} tone="zinc" />
          <PoolStat label="Assigned" value={pool.loadsAssigned.toLocaleString()} tone="sky" />
          <PoolStat label="Completed" value={pool.loadsCompleted.toLocaleString()} tone="emerald" />
          <PoolStat
            label="Still to assign"
            value={pool.loadsUnassigned.toLocaleString()}
            tone={pool.loadsUnassigned > 0 ? "amber" : "zinc"}
          />
        </div>

        {pool.perDispatch.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Per-operator breakdown
            </div>
            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Operator</th>
                    <th className="px-3 py-2 text-right font-medium">Assigned</th>
                    <th className="px-3 py-2 text-right font-medium">Completed</th>
                    <th className="px-3 py-2 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {pool.perDispatch.map((row) => (
                    <tr key={row.dispatchId}>
                      <td className="px-3 py-2 text-zinc-900">{row.operatorName}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-900">{row.loadsAssigned}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">{row.loadsCompleted}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600">
                        {row.loadsAssigned - row.loadsCompleted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {project.pickupLatitude == null || project.dumpLatitude == null ? (
          <p className="mt-4 text-sm text-amber-800">
            ⚠ Pickup or dump location not set yet. Drop pins below — operators
            can&apos;t start a haul on this project until both are placed.
          </p>
        ) : null}
        {issueCount > 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            ⚠ {issueCount} flagged issue{issueCount === 1 ? "" : "s"} — review in the
            ticket queue when Phase 7 ships.
          </p>
        ) : null}
        {project.scheduleNotes ? (
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700">
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Schedule</div>
            {project.scheduleNotes}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Operators</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {project.operators.length} assigned. Phase 5 dispatch picker will filter
            to this list.
          </p>
          <div className="mt-4">
            <OperatorPicker
              projectId={project.id}
              assignedIds={[...assignedOpIds]}
              all={allOperators.map((o) => ({
                id: o.id,
                name: o.user.name,
                employeeId: o.user.employeeId,
                isActive: o.user.isActive,
                currentTruckPlate: o.currentTruck?.licensePlate ?? null,
              }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Trucks</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {project.trucks.length} assigned. Inactive / maintenance trucks are shown
            but greyed.
          </p>
          <div className="mt-4">
            <TruckPicker
              projectId={project.id}
              assignedIds={[...assignedTruckIds]}
              all={allTrucks.map((t) => ({
                id: t.id,
                licensePlate: t.licensePlate,
                type: t.type,
                status: t.status,
              }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-900">Document vault</h2>
        <p className="mt-1 text-xs text-zinc-500">
          PDFs, Office docs, images, CSV, ZIP — up to 25 MB each. Permanent
          storage per proposal §2.4.
        </p>
        <div className="mt-4">
          <DocumentsPanel
            projectId={project.id}
            documents={project.documents.map((d) => ({
              id: d.id,
              filename: d.filename,
              originalName: d.originalName,
              byteSize: d.byteSize,
              mimeType: d.mimeType,
              uploadedAt: d.uploadedAt.toISOString(),
            }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-900">Edit project</h2>
        <div className="mt-4">
          <ProjectForm
            mode="edit"
            id={project.id}
            initial={{
              name: project.name,
              client: project.client,
              address: project.address,
              startDate: project.startDate,
              endDate: project.endDate,
              materialBudget: project.materialBudget,
              loadTarget: project.loadTarget,
              scheduleNotes: project.scheduleNotes,
              status: project.status,
              pickupLatitude: project.pickupLatitude,
              pickupLongitude: project.pickupLongitude,
              dumpLatitude: project.dumpLatitude,
              dumpLongitude: project.dumpLongitude,
            }}
          />
        </div>
        <div className="mt-6 border-t border-zinc-200 pt-4">
          <DeleteProjectButton id={project.id} />
        </div>
      </div>
    </div>
  );
}

import { DeleteProjectButton } from "./DeleteProjectButton";

function PoolStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "zinc" | "sky" | "emerald" | "amber";
}) {
  const toneClass = {
    zinc: "text-zinc-900",
    sky: "text-sky-800",
    emerald: "text-emerald-800",
    amber: "text-amber-900",
  }[tone];
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`font-mono text-lg ${toneClass}`}>{value}</div>
    </div>
  );
}

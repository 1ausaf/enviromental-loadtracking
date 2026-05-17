import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getProject,
  getProjectProgress,
  getFlaggedIssueCount,
  ProjectError,
} from "@/lib/projects";
import { listOperators } from "@/lib/operators";
import { listTrucks } from "@/lib/trucks";
import { ProgressBar } from "@/components/ProgressBar";
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
const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
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

  const [progress, issueCount, allOperators, allTrucks] = await Promise.all([
    getProjectProgress(id, project.loadTarget),
    getFlaggedIssueCount(id),
    listOperators(),
    listTrucks({ status: "ALL" }),
  ]);

  const assignedOpIds = new Set(project.operators.map((o) => o.operatorId));
  const assignedTruckIds = new Set(project.trucks.map((t) => t.truckId));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/projects"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to projects
        </Link>
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
            <dd>{dateFmt.format(project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">End</dt>
            <dd>
              {project.endDate ? (
                dateFmt.format(project.endDate)
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

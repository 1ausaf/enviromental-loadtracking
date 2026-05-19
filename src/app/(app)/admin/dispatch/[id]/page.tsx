import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { DispatchError, getDispatch } from "@/lib/dispatches";
import { listOperators } from "@/lib/operators";
import { listAssignableTrucks } from "@/lib/trucks";
import { listProjects } from "@/lib/projects";
import { projectRemainingForDispatch } from "@/lib/dispatch-loads";
import { AutoRefresh } from "@/components/AutoRefresh";
import { AcceptanceBadge, StatusBadge } from "@/components/DispatchBadges";
import { fmtDateTime } from "@/lib/format";
import { DispatchForm } from "../DispatchForm";
import { AdminDispatchActions } from "./AdminDispatchActions";

export const dynamic = "force-dynamic";

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;
  let d;
  try {
    d = await getDispatch(id);
  } catch (e) {
    if (e instanceof DispatchError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const [projects, operators, trucks] = await Promise.all([
    listProjects({ status: "ALL" }),
    listOperators(),
    listAssignableTrucks(),
  ]);
  // Compute per-project remaining pool excluding this dispatch — the form
  // adds this dispatch's own allocation back so the operator can keep their
  // current loadsAssigned or raise it without false errors.
  const projectsWithRemaining = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
      remaining: await projectRemainingForDispatch(p.id, d.id),
      hasPins: p.pickupLatitude != null && p.dumpLatitude != null,
    })),
  );

  // Include the currently-assigned truck even if it's no longer ACTIVE — so
  // the edit form's <select> can render the current choice.
  const truckOptions = trucks.some((t) => t.id === d.truckId)
    ? trucks
    : [...trucks, { id: d.truck.id, licensePlate: d.truck.licensePlate, type: d.truck.type }];

  const editable = d.status === "IDLE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Link
          href="/admin/dispatch"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to dispatch board
        </Link>
        <AutoRefresh intervalMs={5000} label="Refreshing" />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {d.project.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {fmtDateTime(d.scheduledFor)} &middot; {d.project.client}
            </p>
            {d.project.address ? (
              <p className="text-sm text-zinc-500">{d.project.address}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <AcceptanceBadge value={d.acceptance} />
            <StatusBadge value={d.status} />
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Operator" value={d.operator.user.name} sub={d.operator.user.employeeId ?? undefined} />
          <Info label="Truck" value={d.truck.licensePlate} mono sub={d.truck.colour} />
          <Info
            label="Loads"
            value={`${d.loadsCompleted} / ${d.loadsAssigned}`}
            mono
            sub={d.loadsCompleted >= d.loadsAssigned ? "all done" : `${d.loadsAssigned - d.loadsCompleted} left`}
          />
          <Info label="Pickup" value={d.pickupNote ?? "—"} />
          <Info label="Dump" value={d.dumpNote ?? "—"} />
        </dl>
        {d.notes ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700">
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Notes</div>
            {d.notes}
          </div>
        ) : null}
        {d.acceptance === "FLAGGED" && d.flagReason ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <strong className="font-semibold">Operator flagged this:</strong> {d.flagReason}
          </div>
        ) : null}
        <div className="mt-6">
          <AdminDispatchActions
            id={d.id}
            status={d.status}
            canEdit={editable}
          />
        </div>
      </div>

      {editable ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900">Edit dispatch</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Edits are only allowed before the operator starts the trip.
          </p>
          <div className="mt-4">
            <DispatchForm
              mode="edit"
              id={d.id}
              initial={{
                projectId: d.projectId,
                operatorId: d.operatorId,
                truckId: d.truckId,
                scheduledFor: d.scheduledFor,
                pickupNote: d.pickupNote,
                dumpNote: d.dumpNote,
                notes: d.notes,
                loadsAssigned: d.loadsAssigned,
              }}
              projects={projectsWithRemaining}
              operators={operators.map((o) => ({
                id: o.id,
                name: o.user.name,
                employeeId: o.user.employeeId,
                isActive: o.user.isActive,
              }))}
              trucks={truckOptions}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({
  label,
  value,
  sub,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={mono ? "font-mono text-zinc-900" : "text-zinc-900"}>{value}</dd>
      {sub ? <dd className="text-xs text-zinc-500">{sub}</dd> : null}
    </div>
  );
}

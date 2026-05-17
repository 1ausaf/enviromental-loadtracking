import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOperator, OperatorError } from "@/lib/operators";
import { getOperatorLoadCounts } from "@/lib/stats";
import { RoleBadge } from "@/components/RoleBadge";
import { TruckStatusBadge, truckTypeLabel } from "@/components/TruckBadges";
import { OperatorEditForm } from "./OperatorEditForm";
import { PhotoUpload } from "./PhotoUpload";

export const dynamic = "force-dynamic";

export default async function OperatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;

  let op;
  try {
    op = await getOperator(id);
  } catch (e) {
    if (e instanceof OperatorError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const counts = await getOperatorLoadCounts(id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/operators"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to operators
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start gap-6">
          <PhotoUpload operatorId={op.id} initialSrc={op.photoPath} name={op.user.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                {op.user.name}
              </h1>
              <RoleBadge role={op.user.role} />
              {op.user.isActive ? null : (
                <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300">
                  Deactivated
                </span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Employee ID</dt>
                <dd className="font-mono">{op.user.employeeId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
                <dd className="truncate">{op.user.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Phone</dt>
                <dd>{op.phone ?? <span className="italic text-zinc-400">—</span>}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Licence</dt>
                <dd>{op.licenceClass ?? <span className="italic text-zinc-400">—</span>}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Assigned truck</h2>
          {op.currentTruck ? (
            <div className="mt-3 flex items-center justify-between">
              <div>
                <Link
                  href={`/admin/trucks/${op.currentTruck.id}`}
                  className="font-mono text-lg font-semibold text-zinc-900 hover:underline"
                >
                  {op.currentTruck.licensePlate}
                </Link>
                <div className="text-xs text-zinc-500">
                  {truckTypeLabel(op.currentTruck.type)} &middot; {op.currentTruck.colour}
                </div>
              </div>
              <TruckStatusBadge status={op.currentTruck.status} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Not currently driving a truck. Assign one from the{" "}
              <Link href="/admin/trucks" className="underline hover:text-zinc-900">
                truck list
              </Link>
              .
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Load counts</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Counts of APPROVED tickets — daily, this week, by project.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Today" value={counts.daily.toLocaleString()} />
            <Stat label="This week" value={counts.weekly.toLocaleString()} />
          </dl>
          {counts.perProject.length === 0 ? null : (
            <ul className="mt-3 space-y-1 text-sm text-zinc-700">
              {counts.perProject.map((row) => (
                <li key={row.projectId} className="flex justify-between">
                  <span>{row.projectName}</span>
                  <span className="font-mono">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-900">Edit operator profile</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Account-level fields (name, email, role, status) live on the{" "}
          <Link href="/admin/users" className="underline hover:text-zinc-900">
            Users
          </Link>{" "}
          screen.
        </p>
        <div className="mt-4">
          <OperatorEditForm
            id={op.id}
            initial={{ phone: op.phone, licenceClass: op.licenceClass }}
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

import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/lib/projects";
import { listOperators } from "@/lib/operators";
import { listAssignableTrucks } from "@/lib/trucks";
import { DispatchForm } from "../DispatchForm";

export const dynamic = "force-dynamic";

export default async function NewDispatchPage() {
  await requireUser("ADMIN");
  const [projects, operators, trucks] = await Promise.all([
    listProjects({ status: "ACTIVE" }),
    listOperators(),
    listAssignableTrucks(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href="/admin/dispatch"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to dispatch board
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          New dispatch
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Default time is tomorrow morning — adjust as needed. The operator will
          see this on their /operator screen and can Accept or Flag an issue.
        </p>
        <div className="mt-6">
          {projects.length === 0 || operators.filter((o) => o.user.isActive).length === 0 || trucks.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You need at least one active project, one active operator, and one
              ACTIVE truck to schedule a dispatch. Visit{" "}
              <Link href="/admin/projects" className="underline">Projects</Link>,{" "}
              <Link href="/admin/users" className="underline">Users</Link>, and{" "}
              <Link href="/admin/trucks" className="underline">Trucks</Link>.
            </div>
          ) : (
            <DispatchForm
              mode="create"
              projects={projects.map((p) => ({ id: p.id, name: p.name, client: p.client }))}
              operators={operators.map((o) => ({
                id: o.id,
                name: o.user.name,
                employeeId: o.user.employeeId,
                isActive: o.user.isActive,
              }))}
              trucks={trucks.map((t) => ({
                id: t.id,
                licensePlate: t.licensePlate,
                type: t.type,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

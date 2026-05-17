import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listOperators } from "@/lib/operators";
import { OperatorsFilters } from "./OperatorsFilters";

export const dynamic = "force-dynamic";

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser("ADMIN");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const operators = await listOperators(query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Operators
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {operators.length} driver{operators.length === 1 ? "" : "s"} &middot;
          phone, licence, photo, assigned truck. New operators are created on
          the{" "}
          <Link href="/admin/users/new" className="underline hover:text-zinc-900">
            Users
          </Link>{" "}
          screen.
        </p>
      </div>

      <OperatorsFilters initial={query} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {operators.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No operators yet. Add one from{" "}
            <Link href="/admin/users/new" className="underline hover:text-zinc-900">
              /admin/users/new
            </Link>
            .
          </div>
        ) : (
          operators.map((op) => (
            <Link
              key={op.id}
              href={`/admin/operators/${op.id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <PhotoThumb src={op.photoPath} name={op.user.name} />
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900">
                    {op.user.name}
                    {op.user.isActive ? null : (
                      <span className="ml-1 text-xs text-zinc-400">(inactive)</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {op.user.employeeId ?? "—"}
                    {op.phone ? ` · ${op.phone}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
                <span>
                  {op.licenceClass ? (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium">
                      {op.licenceClass}
                    </span>
                  ) : (
                    <span className="italic text-zinc-400">no licence on file</span>
                  )}
                </span>
                <span>
                  {op.currentTruck ? (
                    <span className="font-mono">{op.currentTruck.licensePlate}</span>
                  ) : (
                    <span className="italic text-zinc-400">no truck</span>
                  )}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function PhotoThumb({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={`${name} photo`}
        className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700">
      {initial}
    </div>
  );
}

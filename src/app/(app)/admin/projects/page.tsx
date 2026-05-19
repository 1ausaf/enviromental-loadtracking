import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listProjects, getProjectProgress } from "@/lib/projects";
import { ProgressBar } from "@/components/ProgressBar";
import type { ProjectStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: ProjectStatus[] = ["ACTIVE", "COMPLETED"];

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireUser("ADMIN");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status: ProjectStatus | "ALL" =
    params.status && (STATUSES as string[]).includes(params.status)
      ? (params.status as ProjectStatus)
      : "ALL";

  const projects = await listProjects({ query, status });
  const enriched = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      progress: await getProjectProgress(p.id, p.loadTarget),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {projects.length} project{projects.length === 1 ? "" : "s"} &middot; budget,
            targets, assignments, document vault.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + New project
        </Link>
      </div>

      <ProjectsFilters initial={{ q: query, status }} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {enriched.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No projects match these filters.
          </div>
        ) : (
          enriched.map((p) => (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-zinc-900">{p.name}</div>
                  <div className="truncate text-xs text-zinc-600">{p.client}</div>
                  <div className="truncate text-xs text-zinc-500">{p.address}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-3 text-xs text-zinc-600">
                {dateFmt.format(p.startDate)}
                {p.endDate ? ` → ${dateFmt.format(p.endDate)}` : " · open-ended"}
              </div>
              <div className="mt-3">
                <ProgressBar completed={p.progress.completedLoads} target={p.loadTarget} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cls =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
      : "bg-zinc-200 text-zinc-700 ring-zinc-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {status === "ACTIVE" ? "Active" : "Completed"}
    </span>
  );
}

import { ProjectsFilters } from "./ProjectsFilters";

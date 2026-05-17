import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listActiveProjectsWithCounts } from "@/lib/projects";
import { listDispatches } from "@/lib/dispatches";
import { ProgressBar } from "@/components/ProgressBar";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function AdminPage() {
  await requireUser("ADMIN");
  const projects = await listActiveProjectsWithCounts();
  const totalIssues = projects.reduce((sum, p) => sum + p.issueCount, 0);

  // "Today's dispatches" panel — counts scheduled for the next 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = await listDispatches({
    fromDate: now,
    toDate: tomorrow,
  });
  const pendingAccept = upcoming.filter((d) => d.acceptance === "PENDING").length;
  const flagged = upcoming.filter((d) => d.acceptance === "FLAGGED").length;
  const inProgress = upcoming.filter(
    (d) => d.status !== "IDLE" && d.status !== "COMPLETED" && d.status !== "CANCELLED",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Master dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Active projects, progress, and flagged issues across the operation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Active projects" value={projects.length.toLocaleString()} />
        <StatCard
          title="Loads completed"
          value={projects.reduce((s, p) => s + p.progress.completedLoads, 0).toLocaleString()}
          sub={`of ${projects.reduce((s, p) => s + p.loadTarget, 0).toLocaleString()} target`}
        />
        <StatCard
          title="Flagged issues"
          value={totalIssues.toLocaleString()}
          tone={totalIssues > 0 ? "warn" : "ok"}
          sub="Ticket flagging lands in Phase 7."
        />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Today &amp; tomorrow</h2>
            <p className="text-xs text-zinc-500">
              {upcoming.length} dispatch{upcoming.length === 1 ? "" : "es"} scheduled in the next 24 hours.
            </p>
          </div>
          <Link
            href="/admin/dispatch"
            className="text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            Open dispatch board
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <MiniStat label="Pending accept" value={pendingAccept} tone={pendingAccept > 0 ? "warn" : undefined} />
          <MiniStat label="Flagged" value={flagged} tone={flagged > 0 ? "alert" : undefined} />
          <MiniStat label="In progress" value={inProgress} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Active projects</h2>
          <Link
            href="/admin/projects"
            className="text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              No active projects.{" "}
              <Link href="/admin/projects/new" className="underline hover:text-zinc-900">
                Create one
              </Link>
              .
            </div>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-zinc-900">{p.name}</div>
                    <div className="truncate text-xs text-zinc-600">{p.client}</div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>{dateFmt.format(p.startDate)}</div>
                    {p.endDate ? <div>→ {dateFmt.format(p.endDate)}</div> : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label="Operators" value={p._count.operators} />
                  <Mini label="Trucks" value={p._count.trucks} />
                  <Mini label="Issues" value={p.issueCount} tone={p.issueCount > 0 ? "warn" : undefined} />
                </div>
                <div className="mt-3">
                  <ProgressBar completed={p.progress.completedLoads} target={p.loadTarget} />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Admin tools</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <AdminLink href="/admin/dispatch" title="Dispatch" sub="Schedule & track" />
          <AdminLink href="/admin/gps" title="GPS" sub="Routes & replay" />
          <AdminLink href="/admin/projects" title="Projects" sub="Create & staff" />
          <AdminLink href="/admin/users" title="Users" sub="Roles & access" />
          <AdminLink href="/admin/trucks" title="Trucks" sub="Plates & status" />
          <AdminLink href="/admin/operators" title="Drivers" sub="Profiles & photos" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <div
        className={`mt-1 text-3xl font-semibold ${
          tone === "warn" ? "text-amber-700" : "text-zinc-900"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "alert";
}) {
  const cls =
    tone === "alert" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-zinc-900";
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${cls}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-sm font-semibold ${tone === "warn" ? "text-amber-700" : "text-zinc-900"}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function AdminLink({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="font-semibold text-zinc-900">{title}</div>
      <div className="text-xs text-zinc-600">{sub}</div>
    </Link>
  );
}

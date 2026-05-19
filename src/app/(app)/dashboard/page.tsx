import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { hasAccess } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { listDispatchesForOperator } from "@/lib/dispatches";
import { listTicketsForOperator } from "@/lib/tickets";
import { AcceptanceBadge, StatusBadge } from "@/components/DispatchBadges";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // Admins and Owners go straight to the master dashboard — they don't have
  // a personal "today" view; everything they care about is on /admin.
  if (hasAccess("ADMIN", user.role)) {
    redirect("/admin");
  }

  // --- Operator "Today" --------------------------------------------------
  const operator = await prisma.operator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!operator) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-base text-slate-600">
        Sign in as an operator to see your shift summary.
      </div>
    );
  }

  const [dispatches, tickets] = await Promise.all([
    listDispatchesForOperator(operator.id),
    listTicketsForOperator(operator.id),
  ]);

  const next = dispatches.find(
    (d) => d.status === "IDLE" && d.acceptance !== "FLAGGED",
  );
  const inProgress = dispatches.find((d) =>
    ["EN_ROUTE_TO_PICKUP", "LOADING", "EN_ROUTE_TO_DUMP"].includes(d.status),
  );
  const drafts = tickets.filter((t) => t.status === "DRAFT");
  const recentApproved = tickets.filter((t) => t.status === "APPROVED").slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Hi {user.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-base text-slate-600">
          Here&apos;s your day at a glance.
        </p>
      </div>

      {/* In-progress callout — biggest signal */}
      {inProgress ? (
        <Link
          href="/operator"
          className="block rounded-2xl border-2 border-sky-300 bg-sky-50 p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-600" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide text-sky-900">
              Trip in progress
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {inProgress.project.name}
          </div>
          <div className="mt-1 text-base text-slate-700">
            <span className="font-mono">{inProgress.truck.licensePlate}</span>
            <span className="mx-2 text-slate-400">·</span>
            <StatusBadge value={inProgress.status} />
          </div>
          <div className="mt-3 text-sm text-sky-900 underline">Open my dispatch →</div>
        </Link>
      ) : null}

      {/* Next assignment */}
      {next ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold uppercase tracking-wide text-slate-500">
              Next assignment
            </h2>
            <AcceptanceBadge value={next.acceptance} />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {next.project.name}
          </div>
          <div className="mt-1 text-base text-slate-700">
            {fmtDateTime(next.scheduledFor)}
          </div>
          <div className="mt-1 text-base text-slate-600">
            <span className="font-mono">{next.truck.licensePlate}</span>
            {next.pickupNote ? (
              <>
                <span className="mx-1 text-slate-400">·</span>
                Pickup: {next.pickupNote}
              </>
            ) : null}
          </div>
          <Link
            href="/operator"
            className="mt-4 inline-flex h-12 items-center rounded-md bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800"
          >
            Open my dispatches
          </Link>
        </div>
      ) : !inProgress ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-base text-slate-600">
          No upcoming dispatches. New assignments will show up here.
        </div>
      ) : null}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Upcoming" value={dispatches.filter((d) => d.status === "IDLE").length} href="/operator" />
        <StatTile label="Drafts to finish" value={drafts.length} href="/operator/tickets" tone={drafts.length > 0 ? "warn" : undefined} />
        <StatTile label="Approved (recent)" value={recentApproved.length} href="/operator/tickets" />
      </div>

      {/* Drafts row */}
      {drafts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-amber-900">
            ⚠ You have {drafts.length} draft ticket{drafts.length === 1 ? "" : "s"} to finish
          </h2>
          <ul className="mt-3 space-y-2">
            {drafts.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/operator/tickets/${t.id}`}
                  className="block rounded-md bg-white p-3 text-base hover:bg-amber-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold">{t.ticketNumber}</span>
                    <TicketStatusBadge status={t.status} />
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {fmtDate(t.date)} ·{" "}
                    {t.project?.name ?? "no project"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "warn";
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold ${
          tone === "warn" ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </Link>
  );
}

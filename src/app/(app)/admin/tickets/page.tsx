import Link from "next/link";
import type { TicketStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { listTickets } from "@/lib/tickets";
import { listOperators } from "@/lib/operators";
import { listProjects } from "@/lib/projects";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { TicketsFilters } from "./TicketsFilters";

export const dynamic = "force-dynamic";

const STATUSES: TicketStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "FLAGGED"];

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    operator?: string;
    project?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireUser("ADMIN");
  const sp = await searchParams;

  const status: TicketStatus | "ALL" =
    sp.status === "ALL"
      ? "ALL"
      : sp.status && (STATUSES as string[]).includes(sp.status)
        ? (sp.status as TicketStatus)
        : "SUBMITTED"; // default to the review queue
  const operatorId = sp.operator || undefined;
  const projectId = sp.project || undefined;
  const query = sp.q?.trim() || undefined;
  const fromDate = parseDate(sp.from);
  const toDate = parseDate(sp.to);

  const [tickets, operators, projects] = await Promise.all([
    listTickets({ status, operatorId, projectId, query, fromDate, toDate }),
    listOperators(),
    listProjects({ status: "ALL" }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Tickets
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {tickets.length} {status === "ALL" ? "ticket" : status.toLowerCase()}
          {tickets.length === 1 ? "" : "s"} matching. Approve or flag from the
          detail view.
        </p>
      </div>

      <TicketsFilters
        initial={{
          q: query ?? "",
          status,
          operator: operatorId ?? "ALL",
          project: projectId ?? "ALL",
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
        operators={operators.map((o) => ({
          id: o.id,
          name: o.user.name,
          employeeId: o.user.employeeId,
        }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Ticket #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3 hidden md:table-cell">Truck</th>
              <th className="px-4 py-3 hidden lg:table-cell">Project</th>
              <th className="px-4 py-3 hidden sm:table-cell">Hours</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No tickets match these filters.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-900">{t.ticketNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{dateFmt.format(t.date)}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    <div>{t.operator.user.name}</div>
                    {t.operator.user.employeeId ? (
                      <div className="text-xs text-zinc-500">{t.operator.user.employeeId}</div>
                    ) : null}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-zinc-700 md:table-cell">
                    {t.truck?.licensePlate ?? t.licensePlate ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 lg:table-cell">
                    {t.project?.name ?? <span className="italic text-zinc-400">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-zinc-700 sm:table-cell">
                    {t.totalHours !== null ? t.totalHours.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/tickets/${t.id}`}
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

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

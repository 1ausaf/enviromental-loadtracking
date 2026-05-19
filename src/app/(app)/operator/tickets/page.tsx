import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { listTicketsForOperator } from "@/lib/tickets";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { truckTypeLabel } from "@/components/TruckBadges";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function MyTicketsPage() {
  const user = await requireUser("OPERATOR");
  const op = await prisma.operator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!op) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Only operators have tickets.
      </div>
    );
  }
  const tickets = await listTicketsForOperator(op.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            My tickets
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {tickets.length} total. Drafts are editable until you sign &amp; submit.
          </p>
        </div>
        <Link
          href="/operator/tickets/new"
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + New ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No tickets yet.{" "}
          <Link href="/operator/tickets/new" className="underline hover:text-zinc-900">
            Create your first one
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 hidden md:table-cell">Project</th>
                <th className="px-4 py-3 hidden md:table-cell">Equipment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-900">{t.ticketNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{dtFmt.format(t.date)}</td>
                  <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                    {t.project?.name ?? <span className="italic text-zinc-400">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                    {truckTypeLabel(t.equipmentType)}
                  </td>
                  <td className="px-4 py-3">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/operator/tickets/${t.id}`}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

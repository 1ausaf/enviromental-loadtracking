import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { createDraft, TicketError } from "@/lib/tickets";
import { NewTicketForm } from "./NewTicketForm";

export const dynamic = "force-dynamic";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ dispatch?: string }>;
}) {
  const user = await requireUser("OPERATOR");
  const op = await prisma.operator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!op) redirect("/operator");

  const sp = await searchParams;

  // If a dispatch ID is in the URL (Phase 8's "Complete Load" path), create
  // the prefilled draft server-side and bounce to its detail page so the
  // operator just fills in load entries + signs.
  if (sp.dispatch) {
    try {
      const draft = await createDraft(op.id, { dispatchId: sp.dispatch });
      redirect(`/operator/tickets/${draft.id}`);
    } catch (e) {
      // A redirect throws — only catch TicketError, re-throw redirects.
      if (e instanceof TicketError) {
        return (
          <div className="mx-auto max-w-lg space-y-4">
            <div>
              <Link
                href="/operator/tickets"
                className="text-sm text-zinc-600 underline hover:text-zinc-900"
              >
                ← Back to my tickets
              </Link>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {e.message}
            </div>
          </div>
        );
      }
      throw e;
    }
  }

  // Find this operator's in-progress dispatches so they can prefill from
  // one in the form below.
  const activeDispatches = await prisma.dispatch.findMany({
    where: {
      operatorId: op.id,
      status: { notIn: ["CANCELLED"] },
      ticket: null,
    },
    orderBy: { scheduledFor: "desc" },
    take: 20,
    include: { project: { select: { name: true } }, truck: { select: { licensePlate: true } } },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link
          href="/operator/tickets"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to my tickets
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          New load ticket
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Picking a dispatch pre-fills truck, project, equipment, pickup and
          delivery. You can also start a blank ticket.
        </p>
        <div className="mt-6">
          <NewTicketForm
            dispatches={activeDispatches.map((d) => ({
              id: d.id,
              label: `${d.project.name} · ${d.truck.licensePlate} · ${d.scheduledFor.toLocaleDateString()}`,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

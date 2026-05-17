import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getTicket, TicketError } from "@/lib/tickets";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { TicketView } from "@/app/(app)/_ticket/TicketView";
import { DraftEditor } from "./DraftEditor";

export const dynamic = "force-dynamic";

export default async function OperatorTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("OPERATOR");
  const op = await prisma.operator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const { id } = await params;

  let ticket;
  try {
    ticket = await getTicket(id);
  } catch (e) {
    if (e instanceof TicketError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  if (!op || ticket.operatorId !== op.id) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/operator/tickets"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to my tickets
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-zinc-600">{ticket.ticketNumber}</span>
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      {ticket.status === "DRAFT" ? (
        <DraftEditor
          id={ticket.id}
          initial={{
            date: ticket.date.toISOString().slice(0, 10),
            brokerName: ticket.brokerName ?? "",
            truckNumber: ticket.truckNumber ?? "",
            licensePlate: ticket.licensePlate ?? "",
            companyHaulingFor: ticket.companyHaulingFor ?? "",
            jobContractNumber: ticket.jobContractNumber ?? "",
            pickupLocation: ticket.pickupLocation ?? "",
            deliveryLocation: ticket.deliveryLocation ?? "",
            equipmentType: ticket.equipmentType,
            used407ETR: ticket.used407ETR,
            startTime: ticket.startTime ? toLocalDtInput(ticket.startTime) : "",
            endTime: ticket.endTime ? toLocalDtInput(ticket.endTime) : "",
            comments: ticket.comments ?? "",
            loadEntries: ticket.loadEntries.map((e) => ({
              loadNumber: e.loadNumber,
              loadTime: e.loadTime ? toLocalDtInput(e.loadTime) : "",
              notes: e.notes ?? "",
            })),
          }}
        />
      ) : (
        <TicketView ticket={ticketToView(ticket)} />
      )}
    </div>
  );
}

function toLocalDtInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ticketToView(t: any) {
  return {
    ticketNumber: t.ticketNumber,
    status: t.status,
    date: t.date.toISOString(),
    brokerName: t.brokerName,
    truckNumber: t.truckNumber,
    licensePlate: t.licensePlate,
    companyHaulingFor: t.companyHaulingFor,
    jobContractNumber: t.jobContractNumber,
    pickupLocation: t.pickupLocation,
    deliveryLocation: t.deliveryLocation,
    equipmentType: t.equipmentType,
    used407ETR: t.used407ETR,
    startTime: t.startTime?.toISOString() ?? null,
    endTime: t.endTime?.toISOString() ?? null,
    totalHours: t.totalHours,
    comments: t.comments,
    signatureDataUrl: t.signatureDataUrl,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    approvedAt: t.approvedAt?.toISOString() ?? null,
    approvedByName: t.approvedBy?.name ?? null,
    flaggedAt: t.flaggedAt?.toISOString() ?? null,
    flaggedByName: t.flaggedBy?.name ?? null,
    flagReason: t.flagReason,
    operatorName: t.operator.user.name,
    operatorEmployeeId: t.operator.user.employeeId,
    projectName: t.project?.name ?? null,
    projectClient: t.project?.client ?? null,
    loadEntries: t.loadEntries.map((e: { loadNumber: number; loadTime: Date | null; notes: string | null }) => ({
      loadNumber: e.loadNumber,
      loadTime: e.loadTime?.toISOString() ?? null,
      notes: e.notes,
    })),
  };
}

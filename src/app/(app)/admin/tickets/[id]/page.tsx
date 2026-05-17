import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getTicket, TicketError } from "@/lib/tickets";
import { TicketView } from "@/app/(app)/_ticket/TicketView";
import { AdminTicketActions } from "./AdminTicketActions";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;
  let ticket;
  try {
    ticket = await getTicket(id);
  } catch (e) {
    if (e instanceof TicketError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/tickets"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to tickets
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          {ticket.status === "SUBMITTED" || ticket.status === "FLAGGED" || ticket.status === "APPROVED" ? (
            <AdminTicketActions id={ticket.id} status={ticket.status} />
          ) : null}
        </div>
      </div>

      <TicketView
        ticket={{
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          date: ticket.date.toISOString(),
          brokerName: ticket.brokerName,
          truckNumber: ticket.truckNumber,
          licensePlate: ticket.licensePlate,
          companyHaulingFor: ticket.companyHaulingFor,
          jobContractNumber: ticket.jobContractNumber,
          pickupLocation: ticket.pickupLocation,
          deliveryLocation: ticket.deliveryLocation,
          equipmentType: ticket.equipmentType,
          used407ETR: ticket.used407ETR,
          startTime: ticket.startTime?.toISOString() ?? null,
          endTime: ticket.endTime?.toISOString() ?? null,
          totalHours: ticket.totalHours,
          comments: ticket.comments,
          materialType: ticket.materialType,
          issuesNote: ticket.issuesNote,
          signatureDataUrl: ticket.signatureDataUrl,
          submittedAt: ticket.submittedAt?.toISOString() ?? null,
          approvedAt: ticket.approvedAt?.toISOString() ?? null,
          approvedByName: ticket.approvedBy?.name ?? null,
          flaggedAt: ticket.flaggedAt?.toISOString() ?? null,
          flaggedByName: ticket.flaggedBy?.name ?? null,
          flagReason: ticket.flagReason,
          operatorName: ticket.operator.user.name,
          operatorEmployeeId: ticket.operator.user.employeeId,
          projectName: ticket.project?.name ?? null,
          projectClient: ticket.project?.client ?? null,
          loadEntries: ticket.loadEntries.map((e) => ({
            loadNumber: e.loadNumber,
            loadTime: e.loadTime?.toISOString() ?? null,
            notes: e.notes,
          })),
          photos: ticket.photos.map((p) => ({
            id: p.id,
            filename: p.filename,
            originalName: p.originalName,
          })),
          ticketId: ticket.id,
        }}
      />
    </div>
  );
}

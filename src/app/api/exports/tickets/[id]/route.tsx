import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getTicket, TicketError } from "@/lib/tickets";
import { hasAccess } from "@/lib/roles";
import { pdfResponse, TicketPdf, type TicketPdfModel } from "@/lib/exports/pdf";
import { truckTypeLabel } from "@/components/TruckBadges";

export const runtime = "nodejs";

// Single-ticket PDF download. Admin/Owner can download any; operator can
// download their own (so they have a copy of submitted tickets).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireUser("OPERATOR");
  const { id } = await params;

  let t;
  try {
    t = await getTicket(id);
  } catch (e) {
    if (e instanceof TicketError && e.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    throw e;
  }

  if (!hasAccess("ADMIN", actor.role)) {
    // Operator must own this ticket.
    const op = await prisma.operator.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!op || op.id !== t.operatorId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  // Photos need to be embedded as data URLs (server-side @react-pdf can't
  // fetch /uploads relative URLs at render time).
  const photoUrls: string[] = [];
  for (const p of t.photos) {
    const filepath = path.join(process.cwd(), "public", "uploads", "tickets", id, p.filename);
    try {
      const buf = await fs.readFile(filepath);
      const mime = p.mimeType || "image/png";
      photoUrls.push(`data:${mime};base64,${buf.toString("base64")}`);
    } catch {
      // Skip missing files silently — the rest of the ticket still prints.
    }
  }

  const model: TicketPdfModel = {
    ticketNumber: t.ticketNumber,
    status: t.status,
    date: t.date,
    brokerName: t.brokerName,
    truckNumber: t.truckNumber,
    licensePlate: t.licensePlate,
    companyHaulingFor: t.companyHaulingFor,
    jobContractNumber: t.jobContractNumber,
    pickupLocation: t.pickupLocation,
    deliveryLocation: t.deliveryLocation,
    equipmentLabel: truckTypeLabel(t.equipmentType),
    used407ETR: t.used407ETR,
    startTime: t.startTime,
    endTime: t.endTime,
    totalHours: t.totalHours,
    materialType: t.materialType,
    comments: t.comments,
    issuesNote: t.issuesNote,
    signatureDataUrl: t.signatureDataUrl,
    submittedAt: t.submittedAt,
    approvedAt: t.approvedAt,
    approvedByName: t.approvedBy?.name ?? null,
    flaggedAt: t.flaggedAt,
    flaggedByName: t.flaggedBy?.name ?? null,
    flagReason: t.flagReason,
    operatorName: t.operator.user.name,
    operatorEmployeeId: t.operator.user.employeeId,
    projectName: t.project?.name ?? null,
    projectClient: t.project?.client ?? null,
    loadEntries: t.loadEntries.map((e) => ({
      loadNumber: e.loadNumber,
      loadTime: e.loadTime,
      notes: e.notes,
    })),
    photoUrls,
  };

  return pdfResponse(<TicketPdf t={model} />, `${t.ticketNumber}.pdf`);
}

import { NextResponse } from "next/server";
import type { TicketStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { listTickets } from "@/lib/tickets";
import { buildCsv, csvResponse } from "@/lib/exports/csv";
import { ListPdf, pdfResponse, type ListColumn } from "@/lib/exports/pdf";
import { truckTypeLabel } from "@/components/TruckBadges";

export const runtime = "nodejs";

const VALID_STATUSES: TicketStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "FLAGGED"];

type Row = Awaited<ReturnType<typeof listTickets>>[number];

export async function GET(req: Request) {
  await requireUser("ADMIN");
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";

  // Same filters as the /admin/tickets list — kept in sync intentionally.
  const sp = url.searchParams;
  const statusParam = sp.get("status");
  const status: TicketStatus | "ALL" =
    statusParam === "ALL"
      ? "ALL"
      : statusParam && (VALID_STATUSES as string[]).includes(statusParam)
        ? (statusParam as TicketStatus)
        : "ALL";

  const filters = {
    status,
    operatorId: sp.get("operator") || undefined,
    projectId: sp.get("project") || undefined,
    query: sp.get("q")?.trim() || undefined,
    fromDate: parseDate(sp.get("from")),
    toDate: parseDate(sp.get("to")),
  };

  const tickets = await listTickets(filters);

  const filtersText = describeFilters({
    status,
    operator: sp.get("operator"),
    project: sp.get("project"),
    query: filters.query,
    from: sp.get("from"),
    to: sp.get("to"),
  });

  const filenameStem = `tickets-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const header: ReadonlyArray<string> = [
      "Ticket #",
      "Date",
      "Status",
      "Operator",
      "Employee ID",
      "Truck plate",
      "Equipment",
      "Project",
      "Client",
      "Start",
      "End",
      "Total hours",
      "Submitted",
      "Approved",
      "Approved by",
      "Flag reason",
    ];
    const body = tickets.map((t) => [
      t.ticketNumber,
      t.date.toISOString().slice(0, 10),
      t.status,
      t.operator.user.name,
      t.operator.user.employeeId ?? "",
      t.truck?.licensePlate ?? t.licensePlate ?? "",
      truckTypeLabel(t.equipmentType),
      t.project?.name ?? "",
      t.project?.client ?? "",
      t.startTime?.toISOString() ?? "",
      t.endTime?.toISOString() ?? "",
      t.totalHours ?? "",
      t.submittedAt?.toISOString() ?? "",
      t.approvedAt?.toISOString() ?? "",
      "",
      t.flagReason ?? "",
    ]);
    return csvResponse(buildCsv([header, ...body]), `${filenameStem}.csv`);
  }

  const columns: ListColumn<Row>[] = [
    { label: "Ticket #", flex: 2, mono: true, cell: (t) => t.ticketNumber },
    { label: "Date", flex: 1.5, cell: (t) => t.date.toISOString().slice(0, 10) },
    { label: "Status", flex: 1, cell: (t) => t.status },
    { label: "Operator", flex: 2, cell: (t) => t.operator.user.name },
    { label: "Truck", flex: 1.5, mono: true, cell: (t) => t.truck?.licensePlate ?? t.licensePlate ?? "—" },
    { label: "Project", flex: 2, cell: (t) => t.project?.name ?? "—" },
    { label: "Hours", flex: 1, align: "right", mono: true, cell: (t) => (t.totalHours != null ? t.totalHours.toFixed(2) : "—") },
  ];
  return pdfResponse(
    <ListPdf
      title="Tickets"
      filtersText={filtersText}
      columns={columns}
      rows={tickets}
      generatedAt={new Date()}
    />,
    `${filenameStem}.pdf`,
  );
}

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function describeFilters(f: {
  status: string;
  operator: string | null;
  project: string | null;
  query: string | undefined;
  from: string | null;
  to: string | null;
}): string {
  const parts: string[] = [`Status: ${f.status}`];
  if (f.query) parts.push(`Search: "${f.query}"`);
  if (f.from || f.to) parts.push(`Date: ${f.from ?? "…"} → ${f.to ?? "…"}`);
  if (f.operator) parts.push("Operator: filtered");
  if (f.project) parts.push("Project: filtered");
  return parts.join(" · ");
}


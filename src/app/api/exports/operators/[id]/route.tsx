import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getOperator, OperatorError } from "@/lib/operators";
import { getOperatorLoadCounts } from "@/lib/stats";
import { listTickets } from "@/lib/tickets";
import { buildCsv, csvResponse } from "@/lib/exports/csv";
import { ListPdf, pdfResponse, type ListColumn } from "@/lib/exports/pdf";

export const runtime = "nodejs";

type TicketRow = Awaited<ReturnType<typeof listTickets>>[number];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser("ADMIN");
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";

  let op;
  try {
    op = await getOperator(id);
  } catch (e) {
    if (e instanceof OperatorError && e.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    throw e;
  }

  const [counts, tickets] = await Promise.all([
    getOperatorLoadCounts(id),
    listTickets({ operatorId: id, status: "ALL" }),
  ]);

  const filenameStem = `operator-${slug(op.user.name)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const rows: ReadonlyArray<ReadonlyArray<string | number | Date | null>> = [
      ["Section", "Field", "Value"],
      ["Operator", "Name", op.user.name],
      ["Operator", "Email", op.user.email],
      ["Operator", "Employee ID", op.user.employeeId ?? ""],
      ["Operator", "Active", op.user.isActive ? "Yes" : "No"],
      ["Operator", "Phone", op.phone ?? ""],
      ["Operator", "Licence class", op.licenceClass ?? ""],
      ["Operator", "Current truck", op.currentTruck?.licensePlate ?? ""],
      ["Counts", "Approved loads today", counts.daily],
      ["Counts", "Approved loads this week", counts.weekly],
      [],
      ["Per project (approved loads)"],
      ["Project", "Count"],
      ...counts.perProject.map((p) => [p.projectName, p.count] as const),
      [],
      ["Tickets"],
      ["Ticket #", "Date", "Status", "Truck", "Project", "Hours"],
      ...tickets.map((t) => [
        t.ticketNumber,
        t.date.toISOString().slice(0, 10),
        t.status,
        t.truck?.licensePlate ?? t.licensePlate ?? "",
        t.project?.name ?? "",
        t.totalHours ?? "",
      ]),
    ];
    return csvResponse(buildCsv(rows), `${filenameStem}.csv`);
  }

  const columns: ListColumn<TicketRow>[] = [
    { label: "Ticket #", flex: 2, mono: true, cell: (t) => t.ticketNumber },
    { label: "Date", flex: 1.5, cell: (t) => t.date.toISOString().slice(0, 10) },
    { label: "Status", flex: 1, cell: (t) => t.status },
    { label: "Truck", flex: 1.5, mono: true, cell: (t) => t.truck?.licensePlate ?? "—" },
    { label: "Project", flex: 2, cell: (t) => t.project?.name ?? "—" },
    { label: "Hours", flex: 1, align: "right", mono: true, cell: (t) => (t.totalHours != null ? t.totalHours.toFixed(2) : "—") },
  ];

  const subtitle =
    `${op.user.email}${op.user.employeeId ? ` · ${op.user.employeeId}` : ""}` +
    `${op.phone ? ` · ${op.phone}` : ""}${op.licenceClass ? ` · ${op.licenceClass}` : ""}\n` +
    `Today: ${counts.daily} loads · This week: ${counts.weekly} loads`;

  return pdfResponse(
    <ListPdf
      title={`Operator stats — ${op.user.name}`}
      subtitle={subtitle}
      columns={columns}
      rows={tickets}
      generatedAt={new Date()}
    />,
    `${filenameStem}.pdf`,
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

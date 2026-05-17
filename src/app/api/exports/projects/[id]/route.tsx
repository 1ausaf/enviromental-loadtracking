import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  getProject,
  getProjectProgress,
  ProjectError,
} from "@/lib/projects";
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

  let project;
  try {
    project = await getProject(id);
  } catch (e) {
    if (e instanceof ProjectError && e.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    throw e;
  }

  const [progress, tickets] = await Promise.all([
    getProjectProgress(id, project.loadTarget),
    listTickets({ projectId: id, status: "ALL" }),
  ]);

  const filenameStem = `project-${slug(project.name)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const header = [
      "Section",
      "Field",
      "Value",
    ];
    const summary: ReadonlyArray<ReadonlyArray<string | number | Date | null>> = [
      header,
      ["Project", "Name", project.name],
      ["Project", "Client", project.client],
      ["Project", "Address", project.address],
      ["Project", "Status", project.status],
      ["Project", "Start date", project.startDate],
      ["Project", "End date", project.endDate],
      ["Project", "Material budget (CAD)", project.materialBudget],
      ["Project", "Load target", project.loadTarget],
      ["Progress", "Completed loads", progress.completedLoads],
      ["Progress", "Percent", `${progress.percent}%`],
      ["Counts", "Operators assigned", project.operators.length],
      ["Counts", "Trucks assigned", project.trucks.length],
      ["Counts", "Documents", project.documents.length],
      ["Counts", "Tickets total", tickets.length],
      [],
      ["Tickets"],
      ["Ticket #", "Date", "Status", "Operator", "Truck", "Hours"],
      ...tickets.map((t) => [
        t.ticketNumber,
        t.date.toISOString().slice(0, 10),
        t.status,
        t.operator.user.name,
        t.truck?.licensePlate ?? t.licensePlate ?? "",
        t.totalHours ?? "",
      ]),
    ];
    return csvResponse(buildCsv(summary), `${filenameStem}.csv`);
  }

  const columns: ListColumn<TicketRow>[] = [
    { label: "Ticket #", flex: 2, mono: true, cell: (t) => t.ticketNumber },
    { label: "Date", flex: 1.5, cell: (t) => t.date.toISOString().slice(0, 10) },
    { label: "Status", flex: 1, cell: (t) => t.status },
    { label: "Operator", flex: 2, cell: (t) => t.operator.user.name },
    { label: "Truck", flex: 1.5, mono: true, cell: (t) => t.truck?.licensePlate ?? "—" },
    { label: "Hours", flex: 1, align: "right", mono: true, cell: (t) => (t.totalHours != null ? t.totalHours.toFixed(2) : "—") },
  ];

  const subtitle =
    `${project.client} · ${project.address}\n` +
    `Status: ${project.status} · Budget: $${project.materialBudget.toLocaleString()} · ` +
    `Target: ${project.loadTarget} loads · ` +
    `Progress: ${progress.completedLoads}/${progress.loadTarget} (${progress.percent}%)`;

  return pdfResponse(
    <ListPdf
      title={`Project summary — ${project.name}`}
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

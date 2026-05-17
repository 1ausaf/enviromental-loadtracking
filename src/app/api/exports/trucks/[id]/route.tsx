import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getTruck, TruckError } from "@/lib/trucks";
import { getTruckStats } from "@/lib/stats";
import { listTickets } from "@/lib/tickets";
import { buildCsv, csvResponse } from "@/lib/exports/csv";
import { ListPdf, pdfResponse, type ListColumn } from "@/lib/exports/pdf";
import { truckTypeLabel } from "@/components/TruckBadges";

export const runtime = "nodejs";

type TicketRow = Awaited<ReturnType<typeof listTickets>>[number];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser("ADMIN");
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";

  let truck;
  try {
    truck = await getTruck(id);
  } catch (e) {
    if (e instanceof TruckError && e.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    throw e;
  }

  const [stats, tickets] = await Promise.all([
    getTruckStats(id),
    listTickets({ truckId: id, status: "ALL" }),
  ]);

  const filenameStem = `truck-${slug(truck.licensePlate)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const summary: ReadonlyArray<ReadonlyArray<string | number | Date | null>> = [
      ["Section", "Field", "Value"],
      ["Truck", "License plate", truck.licensePlate],
      ["Truck", "Type", truckTypeLabel(truck.type)],
      ["Truck", "Capacity (tonnes)", truck.capacityTonnes],
      ["Truck", "Colour / ID", truck.colour],
      ["Truck", "Status", truck.status],
      ["Truck", "Current operator", truck.assignedOperator?.user.name ?? ""],
      ["Stats", "Approved loads (lifetime)", stats.totalLoads],
      ["Stats", "Active hours (lifetime)", stats.activeHours],
      [],
      ["Tickets"],
      ["Ticket #", "Date", "Status", "Operator", "Project", "Hours"],
      ...tickets.map((t) => [
        t.ticketNumber,
        t.date.toISOString().slice(0, 10),
        t.status,
        t.operator.user.name,
        t.project?.name ?? "",
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
    { label: "Project", flex: 2, cell: (t) => t.project?.name ?? "—" },
    { label: "Hours", flex: 1, align: "right", mono: true, cell: (t) => (t.totalHours != null ? t.totalHours.toFixed(2) : "—") },
  ];

  const subtitle =
    `${truckTypeLabel(truck.type)} · ${truck.capacityTonnes} t · ${truck.colour} · ${truck.status}\n` +
    `Lifetime: ${stats.totalLoads} loads · ${stats.activeHours} hours`;

  return pdfResponse(
    <ListPdf
      title={`Truck stats — ${truck.licensePlate}`}
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

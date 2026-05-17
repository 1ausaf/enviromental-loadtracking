import { requireUser } from "@/lib/session";
import { listTrips } from "@/lib/trips";
import { buildCsv, csvResponse } from "@/lib/exports/csv";
import { ListPdf, pdfResponse, type ListColumn } from "@/lib/exports/pdf";

export const runtime = "nodejs";

type Row = Awaited<ReturnType<typeof listTrips>>[number];

export async function GET(req: Request) {
  await requireUser("ADMIN");
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") === "pdf" ? "pdf" : "csv";

  const filters = {
    operatorId: sp.get("operator") || undefined,
    projectId: sp.get("project") || undefined,
    truckId: sp.get("truck") || undefined,
    query: sp.get("q")?.trim() || undefined,
    fromDate: parseDate(sp.get("from")),
    toDate: parseDate(sp.get("to")),
    activeOnly: sp.get("activeOnly") === "1",
  };

  const trips = await listTrips(filters);
  const filenameStem = `trips-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const header = [
      "Started",
      "Ended",
      "Elapsed minutes",
      "Operator",
      "Employee ID",
      "Truck plate",
      "Project",
      "Pickup",
      "Dump",
      "Sample count",
      "Distance km",
    ];
    const body = trips.map((t) => [
      t.startedAt.toISOString(),
      t.endedAt?.toISOString() ?? "",
      t.endedAt ? Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60000) : "",
      t.operator.user.name,
      t.operator.user.employeeId ?? "",
      t.truck.licensePlate,
      t.project.name,
      t.pickupNote ?? "",
      t.dumpNote ?? "",
      t.pointCount,
      t.totalDistanceM !== null ? (t.totalDistanceM / 1000).toFixed(2) : "",
    ]);
    return csvResponse(buildCsv([header, ...body]), `${filenameStem}.csv`);
  }

  const columns: ListColumn<Row>[] = [
    { label: "Started", flex: 2, cell: (t) => t.startedAt.toISOString().slice(0, 16).replace("T", " ") },
    { label: "Min", flex: 1, align: "right", cell: (t) => (t.endedAt ? Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60000) : "—") },
    { label: "Operator", flex: 2, cell: (t) => t.operator.user.name },
    { label: "Truck", flex: 1.5, mono: true, cell: (t) => t.truck.licensePlate },
    { label: "Project", flex: 2, cell: (t) => t.project.name },
    { label: "Pickup", flex: 2, cell: (t) => t.pickupNote ?? "—" },
    { label: "Dump", flex: 2, cell: (t) => t.dumpNote ?? "—" },
    { label: "km", flex: 1, align: "right", mono: true, cell: (t) => (t.totalDistanceM !== null ? (t.totalDistanceM / 1000).toFixed(1) : "—") },
  ];

  const filtersText = describeFilters({
    query: filters.query,
    from: sp.get("from"),
    to: sp.get("to"),
    activeOnly: filters.activeOnly,
    operator: sp.get("operator"),
    project: sp.get("project"),
    truck: sp.get("truck"),
  });

  return pdfResponse(
    <ListPdf
      title="GPS trips"
      filtersText={filtersText}
      columns={columns}
      rows={trips}
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
  query: string | undefined;
  from: string | null;
  to: string | null;
  activeOnly: boolean;
  operator: string | null;
  project: string | null;
  truck: string | null;
}): string {
  const parts: string[] = [];
  if (f.query) parts.push(`Search: "${f.query}"`);
  if (f.from || f.to) parts.push(`Date: ${f.from ?? "…"} → ${f.to ?? "…"}`);
  if (f.activeOnly) parts.push("Active only");
  if (f.operator) parts.push("Operator: filtered");
  if (f.project) parts.push("Project: filtered");
  if (f.truck) parts.push("Truck: filtered");
  return parts.length ? parts.join(" · ") : "All trips";
}

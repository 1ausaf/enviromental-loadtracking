import type { TicketStatus, TruckType } from "@/generated/prisma/client";
import { truckTypeLabel } from "@/components/TruckBadges";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";

export type TicketViewModel = {
  ticketNumber: string;
  status: TicketStatus;
  date: string;
  brokerName: string | null;
  truckNumber: string | null;
  licensePlate: string | null;
  companyHaulingFor: string | null;
  jobContractNumber: string | null;
  pickupLocation: string | null;
  deliveryLocation: string | null;
  equipmentType: TruckType;
  used407ETR: boolean;
  startTime: string | null;
  endTime: string | null;
  totalHours: number | null;
  comments: string | null;
  materialType: string | null;
  issuesNote: string | null;
  signatureDataUrl: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  flaggedAt: string | null;
  flaggedByName: string | null;
  flagReason: string | null;
  operatorName: string;
  operatorEmployeeId: string | null;
  projectName: string | null;
  projectClient: string | null;
  loadEntries: Array<{ loadNumber: number; loadTime: string | null; notes: string | null }>;
  photos: Array<{ id: string; filename: string; originalName: string }>;
  ticketId: string;
};

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const dtFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

// Print-friendly digital load ticket. Mirrors the paper form layout.
// All chrome ("Print" button, badge tray, admin actions) is the parent's job;
// this component is purely the ticket document itself, safe to render on both
// the operator and admin views and to use as a print target via @media print.
export function TicketView({
  ticket,
  rightSlot,
  printable = true,
}: {
  ticket: TicketViewModel;
  rightSlot?: React.ReactNode;
  printable?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8 ${
        printable ? "" : "print:hidden"
      }`}
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">HK Environmental Group · Load Ticket</div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {ticket.ticketNumber}
          </h1>
          <p className="text-sm text-zinc-600">{dateFmt.format(new Date(ticket.date))}</p>
        </div>
        <div className="flex flex-col items-end gap-1 print:hidden">
          <TicketStatusBadge status={ticket.status} />
          {rightSlot}
        </div>
      </header>

      {/* Two-column field grid */}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Field label="Broker" value={ticket.brokerName} />
        <Field label="Company hauling for" value={ticket.companyHaulingFor} />
        <Field label="Truck number" value={ticket.truckNumber} mono />
        <Field label="License plate" value={ticket.licensePlate} mono />
        <Field label="Job / contract #" value={ticket.jobContractNumber} mono />
        <Field label="Equipment type" value={truckTypeLabel(ticket.equipmentType)} />
        <Field label="Pickup location" value={ticket.pickupLocation} />
        <Field label="Delivery location" value={ticket.deliveryLocation} />
        <Field label="407 ETR used" value={ticket.used407ETR ? "Yes" : "No"} />
        <Field
          label="Project"
          value={
            ticket.projectName
              ? `${ticket.projectName}${ticket.projectClient ? ` · ${ticket.projectClient}` : ""}`
              : null
          }
        />
        <Field label="Material type" value={ticket.materialType} />
      </dl>

      {/* Time block */}
      <div className="mt-6 grid grid-cols-3 gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-center">
        <TimeStat label="Start" value={ticket.startTime ? timeFmt.format(new Date(ticket.startTime)) : "—"} />
        <TimeStat label="End" value={ticket.endTime ? timeFmt.format(new Date(ticket.endTime)) : "—"} />
        <TimeStat
          label="Total hours"
          value={ticket.totalHours !== null ? ticket.totalHours.toFixed(2) : "—"}
        />
      </div>

      {/* Load entries */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
          Loads ({ticket.loadEntries.length})
        </h2>
        {ticket.loadEntries.length === 0 ? (
          <p className="mt-1 text-sm italic text-zinc-500">No loads recorded.</p>
        ) : (
          <table className="mt-2 w-full border border-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">#</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Time</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ticket.loadEntries.map((e) => (
                <tr key={e.loadNumber}>
                  <td className="border-b border-zinc-100 px-3 py-2 font-mono">{e.loadNumber}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">
                    {e.loadTime ? timeFmt.format(new Date(e.loadTime)) : "—"}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">
                    {e.notes ?? <span className="italic text-zinc-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {ticket.issuesNote ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
            Issues reported
          </h2>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {ticket.issuesNote}
          </p>
        </section>
      ) : null}

      {ticket.photos.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
            Photos ({ticket.photos.length})
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3">
            {ticket.photos.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/uploads/tickets/${ticket.ticketId}/${p.filename}`}
                  alt={p.originalName}
                  className="aspect-square w-full rounded-md object-cover ring-1 ring-zinc-200 print:break-inside-avoid"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ticket.comments ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Comments</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{ticket.comments}</p>
        </section>
      ) : null}

      {/* Signature + operator block */}
      <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Operator signature</h2>
          <div className="mt-2 h-32 rounded-md border border-zinc-200 bg-white">
            {ticket.signatureDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ticket.signatureDataUrl}
                alt="Operator signature"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
                Not signed yet
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            {ticket.operatorName}
            {ticket.operatorEmployeeId ? ` · ${ticket.operatorEmployeeId}` : ""}
            {ticket.submittedAt ? ` · submitted ${dtFmt.format(new Date(ticket.submittedAt))}` : ""}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Admin approval</h2>
          {ticket.status === "APPROVED" && ticket.approvedAt ? (
            <div className="mt-2 inline-block rounded-md border-2 border-emerald-700 px-4 py-3 text-center">
              <div className="text-xl font-bold uppercase tracking-wider text-emerald-700">Approved</div>
              <div className="mt-1 text-xs text-emerald-900">
                {ticket.approvedByName ?? "Admin"}
                <br />
                {dtFmt.format(new Date(ticket.approvedAt))}
              </div>
            </div>
          ) : ticket.status === "FLAGGED" && ticket.flaggedAt ? (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="font-semibold uppercase tracking-wide">Flagged</div>
              <div className="text-xs">
                {ticket.flaggedByName ?? "Admin"} · {dtFmt.format(new Date(ticket.flaggedAt))}
              </div>
              {ticket.flagReason ? (
                <div className="mt-1 whitespace-pre-wrap text-sm">{ticket.flagReason}</div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs italic text-zinc-500">
              {ticket.status === "DRAFT" ? "—" : "Awaiting admin review."}
            </p>
          )}
        </div>
      </section>
    </article>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono" : ""} text-zinc-900`}>
        {value || <span className="italic text-zinc-400">—</span>}
      </dd>
    </div>
  );
}

function TimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

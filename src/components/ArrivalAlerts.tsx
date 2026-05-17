import Link from "next/link";
import { listPendingArrivals } from "@/lib/dispatches";
import { ArrivalCountdown } from "./ArrivalCountdown";

// Server-rendered panel + client-side per-row ticking countdown. The
// outer page should already poll via AutoRefresh — that re-runs this
// server component to drop rows when the operator submits their ticket.
export async function ArrivalAlerts() {
  const arrivals = await listPendingArrivals();
  if (arrivals.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        ✓ No outstanding arrivals. All completed hauls have submitted tickets.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-900">
            ⚠ Arrivals awaiting ticket
          </h2>
          <p className="text-xs text-amber-900/70">
            Operator completed the haul but hasn&apos;t submitted the eTicket yet.
            Timer counts time on-site since they tapped Complete Load.
          </p>
        </div>
        <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          {arrivals.length} pending
        </span>
      </div>

      <ul className="mt-4 divide-y divide-amber-200">
        {arrivals.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-zinc-900">
                {d.operator.user.name}
                {d.operator.user.employeeId ? (
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    · {d.operator.user.employeeId}
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs text-zinc-700">
                {d.project.name}
                <span className="mx-1 text-zinc-400">·</span>
                <span className="font-mono">{d.truck.licensePlate}</span>
                {d.dumpNote ? (
                  <>
                    <span className="mx-1 text-zinc-400">·</span>
                    <span>at {d.dumpNote}</span>
                  </>
                ) : null}
              </div>
            </div>

            <ArrivalCountdown
              completedAt={d.completedAt!.toISOString()}
            />

            <Link
              href={
                d.ticket?.id
                  ? `/admin/tickets/${d.ticket.id}`
                  : `/admin/dispatch/${d.id}`
              }
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              {d.ticket?.id ? "Open draft" : "Open dispatch"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

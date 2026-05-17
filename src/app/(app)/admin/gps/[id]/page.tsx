import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getTrip, TripError } from "@/lib/trips";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MapReplayClient } from "./MapReplayClient";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function GpsReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;
  let trip;
  try {
    trip = await getTrip(id);
  } catch (e) {
    if (e instanceof TripError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const elapsedMin =
    trip.endedAt !== null
      ? Math.round((trip.endedAt.getTime() - trip.startedAt.getTime()) / 60000)
      : Math.round((Date.now() - trip.startedAt.getTime()) / 60000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/gps"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to GPS history
        </Link>
        {trip.endedAt === null ? <AutoRefresh intervalMs={10000} label="Refreshing live trip" /> : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {trip.project.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {trip.operator.user.name}
              {trip.operator.user.employeeId ? ` · ${trip.operator.user.employeeId}` : ""} ·
              <span className="ml-1 font-mono">{trip.truck.licensePlate}</span>
            </p>
            <p className="text-sm text-zinc-500">
              Started {dtFmt.format(trip.startedAt)} ·{" "}
              {trip.endedAt ? `ended ${dtFmt.format(trip.endedAt)}` : "in progress"}
            </p>
          </div>
          {trip.endedAt === null ? (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-inset ring-sky-200">
              Live
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200">
              Ended
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Pickup" value={trip.pickupNote ?? "—"} />
          <Stat label="Dump" value={trip.dumpNote ?? "—"} />
          <Stat label="GPS samples" value={trip.pointCount.toLocaleString()} />
          <Stat label="Elapsed" value={`${elapsedMin} min`} />
          <Stat
            label="Distance"
            value={
              trip.totalDistanceM === null ? "—" : `${(trip.totalDistanceM / 1000).toFixed(2)} km`
            }
          />
        </dl>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <MapReplayClient
          points={trip.points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            recordedAt: p.recordedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  );
}

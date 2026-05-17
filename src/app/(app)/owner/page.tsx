import Link from "next/link";
import type { ExceptionStatus, ExceptionType } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { hasAccess } from "@/lib/roles";
import { listExceptions } from "@/lib/exceptions";
import { ExceptionStatusBadge, ExceptionTypeBadge } from "@/components/ExceptionBadges";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ExceptionFilters } from "./ExceptionFilters";

export const dynamic = "force-dynamic";

const STATUSES: ExceptionStatus[] = ["PENDING", "APPROVED", "DECLINED"];
const TYPES: ExceptionType[] = [
  "TICKET_LATE_SUBMISSION",
  "TICKET_FLAGGED",
  "ADMIN_OVERRIDE_REQUEST",
];

const dtFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function OwnerExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  // ADMIN can view (read-only); only OWNER can act in the detail view.
  const actor = await requireUser("ADMIN");
  const sp = await searchParams;

  const status: ExceptionStatus | "ALL" =
    sp.status === "ALL"
      ? "ALL"
      : sp.status && (STATUSES as string[]).includes(sp.status)
        ? (sp.status as ExceptionStatus)
        : "PENDING"; // default to the review queue

  const type: ExceptionType | "ALL" =
    sp.type && (TYPES as string[]).includes(sp.type)
      ? (sp.type as ExceptionType)
      : "ALL";

  const query = sp.q?.trim() || undefined;

  const exceptions = await listExceptions({ status, type, query });
  const pendingCount = exceptions.filter((x) => x.status === "PENDING").length;
  const isOwner = hasAccess("OWNER", actor.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Owner exceptions
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {isOwner
              ? "Review and approve / decline exceptions routed for your sign-off."
              : "Read-only — only Owners can approve or decline. (Proposal §2.8.)"}
          </p>
        </div>
        <AutoRefresh intervalMs={10000} label="Refreshing" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Pending" value={pendingCount} tone={pendingCount > 0 ? "warn" : undefined} />
        <StatTile label="Showing" value={exceptions.length} />
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm text-xs text-zinc-600">
          Late-submission threshold: 24 h after haul date. Configurable in{" "}
          <code className="font-mono">src/lib/exceptions.ts</code>.
        </div>
      </div>

      <ExceptionFilters initial={{ q: query ?? "", status, type }} />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Raised</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3 hidden sm:table-cell">By</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden md:table-cell">Decided</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No exceptions match these filters.
                </td>
              </tr>
            ) : (
              exceptions.map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                    {dtFmt.format(x.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <ExceptionTypeBadge type={x.type} />
                  </td>
                  <td className="px-4 py-3 text-zinc-900">
                    <div className="max-w-md truncate" title={x.summary}>
                      {x.summary}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-zinc-600 sm:table-cell">
                    {x.createdBy?.name ?? <span className="italic text-zinc-400">system</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ExceptionStatusBadge status={x.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-zinc-600 md:table-cell">
                    {x.decidedAt ? (
                      <>
                        {dtFmt.format(x.decidedAt)}
                        <div className="text-zinc-500">{x.decidedBy?.name ?? "—"}</div>
                      </>
                    ) : (
                      <span className="italic text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/owner/exceptions/${x.id}`}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  const cls = tone === "warn" ? "text-amber-700" : "text-zinc-900";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value.toLocaleString()}</div>
    </div>
  );
}

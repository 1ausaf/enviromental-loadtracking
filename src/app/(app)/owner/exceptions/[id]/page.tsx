import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { hasAccess } from "@/lib/roles";
import { ExceptionError, getException } from "@/lib/exceptions";
import {
  ExceptionStatusBadge,
  ExceptionTypeBadge,
} from "@/components/ExceptionBadges";
import { OwnerDecision } from "./OwnerDecision";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ExceptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireUser("ADMIN");
  const { id } = await params;
  let x;
  try {
    x = await getException(id);
  } catch (e) {
    if (e instanceof ExceptionError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const isOwner = hasAccess("OWNER", actor.role);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/owner"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to exceptions
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {x.summary}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Raised {dtFmt.format(x.createdAt)} by{" "}
              {x.createdBy?.name ?? <span className="italic">system</span>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ExceptionTypeBadge type={x.type} />
            <ExceptionStatusBadge status={x.status} />
          </div>
        </div>

        {x.details ? (
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 font-sans text-sm text-zinc-800">
            {x.details}
          </pre>
        ) : null}

        {x.ticket ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Linked ticket</div>
            <div className="mt-1">
              <Link
                href={`/admin/tickets/${x.ticket.id}`}
                className="font-mono font-semibold text-zinc-900 hover:underline"
              >
                {x.ticket.ticketNumber}
              </Link>
              <span className="ml-2 text-xs text-zinc-600">
                {x.ticket.operator.user.name} ·{" "}
                {x.ticket.project?.name ?? "no project"} · status: {x.ticket.status}
              </span>
            </div>
          </div>
        ) : null}

        {x.status !== "PENDING" ? (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              x.status === "APPROVED"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <div className="font-semibold uppercase tracking-wide">Decision</div>
            <div className="text-xs">
              {x.decidedBy?.name ?? "—"} ·{" "}
              {x.decidedAt ? dtFmt.format(x.decidedAt) : ""}
            </div>
            {x.decisionNote ? (
              <div className="mt-1 whitespace-pre-wrap">{x.decisionNote}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {x.status === "PENDING" && isOwner ? (
        <OwnerDecision id={x.id} type={x.type} />
      ) : x.status === "PENDING" && !isOwner ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          Only the Owner can approve or decline this exception.
        </div>
      ) : null}
    </div>
  );
}

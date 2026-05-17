import Link from "next/link";
import { requireUser } from "@/lib/session";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default async function AdminPage() {
  await requireUser("ADMIN");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Admin
        </h1>
        <p className="mt-2 text-zinc-600">
          Day-to-day management. New tools land here each phase.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <AdminLink href="/admin/users" title="Users" sub="Create, deactivate, delete" />
          <AdminLink href="/admin/trucks" title="Trucks" sub="Plates, capacity, status, assignment" />
          <AdminLink href="/admin/operators" title="Drivers" sub="Phone, licence, photo, load counts" />
        </div>
      </div>

      <PlaceholderCard
        title="Coming in later phases"
        phase="Phase 4 / 5 / 8"
        proposalSection="2.4 / 2.6 / 2.7"
      >
        Projects with budgets and progress bars, the dispatch board with live
        haul status, ticket review queue, and live arrival countdowns.
      </PlaceholderCard>
    </div>
  );
}

function AdminLink({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-shadow hover:bg-white hover:shadow-md"
    >
      <div className="font-semibold text-zinc-900">{title}</div>
      <div className="text-xs text-zinc-600">{sub}</div>
    </Link>
  );
}

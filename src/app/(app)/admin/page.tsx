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
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Manage users →
          </Link>
        </div>
      </div>

      <PlaceholderCard
        title="Coming in later phases"
        phase="Phase 3 / 4 / 5 / 8"
        proposalSection="2.3 / 2.4 / 2.6 / 2.7"
      >
        Truck & driver management, projects with budgets, the dispatch board,
        ticket review queue, and live arrival countdowns.
      </PlaceholderCard>
    </div>
  );
}

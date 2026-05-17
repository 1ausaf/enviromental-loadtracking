import { requireUser } from "@/lib/session";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default async function AdminPage() {
  await requireUser("ADMIN");

  return (
    <PlaceholderCard
      title="Admin workspace"
      phase="Phase 2 / 4 / 5 / 8"
      proposalSection="2.1 / 2.4 / 2.6 / 2.7"
    >
      Day-to-day management. Create users and projects, build dispatches,
      review and approve submitted tickets, watch the live dispatch board and
      arrival countdowns.
    </PlaceholderCard>
  );
}

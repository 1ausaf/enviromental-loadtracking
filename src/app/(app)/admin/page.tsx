import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasAccess } from "@/lib/roles";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!hasAccess("ADMIN", user.role)) redirect("/dashboard");

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

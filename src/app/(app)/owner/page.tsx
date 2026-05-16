import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasAccess } from "@/lib/roles";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!hasAccess("OWNER", user.role)) redirect("/dashboard");

  return (
    <PlaceholderCard
      title="Owner workspace"
      phase="Phase 9"
      proposalSection="2.8"
    >
      Full access plus Owner-only exception approvals. Review and approve or
      decline items routed outside standard operating rules; full audit trail.
    </PlaceholderCard>
  );
}

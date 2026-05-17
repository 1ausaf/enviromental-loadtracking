import { requireUser } from "@/lib/session";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default async function OwnerPage() {
  await requireUser("OWNER");

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

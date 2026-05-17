import { requireUser } from "@/lib/session";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default async function OperatorPage() {
  await requireUser("OPERATOR");

  return (
    <PlaceholderCard
      title="Operator workspace"
      phase="Phase 5 / Phase 7"
      proposalSection="2.6 / 2.2"
    >
      Drivers in the field. Accept dispatch, start trips (GPS tracking begins),
      submit digital load tickets, view personal ticket history.
    </PlaceholderCard>
  );
}

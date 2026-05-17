import { prisma } from "@/lib/db";

const KEY = "employeeId";

// Bump the SystemCounter row atomically and return the formatted ID.
// Postgres UPDATE ... RETURNING is itself atomic, so concurrent allocators
// each see a distinct value. No transaction wrapper required.
export async function nextEmployeeId(): Promise<string> {
  const updated = await prisma.systemCounter.update({
    where: { key: KEY },
    data: { value: { increment: 1 } },
  });
  return formatEmployeeId(updated.value);
}

export function formatEmployeeId(n: number): string {
  return `HK-${String(n).padStart(4, "0")}`;
}

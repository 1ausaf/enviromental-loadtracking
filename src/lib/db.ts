import { PrismaClient } from "@/generated/prisma/client";

// PHASE 0 STUB.
// Prisma 7 requires either a runtime `adapter` (e.g. @prisma/adapter-pg) or
// `accelerateUrl` to construct the client. No database queries run in Phase 0,
// so we don't instantiate one yet. Phase 1 replaces the body of getPrisma()
// with the real singleton wired to the chosen adapter — every other file
// already imports through this module so no call sites need to change.

export type { PrismaClient };

let _client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (_client) return _client;
  throw new Error(
    "Database access is not wired yet. Phase 1 will instantiate PrismaClient " +
      "with a runtime adapter (e.g. new PrismaPg({ connectionString: process.env.DATABASE_URL })). " +
      "Until then no module should call getPrisma().",
  );
}

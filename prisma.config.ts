// Load .env first, then .env.local on top — same precedence Next.js uses.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { defineConfig } from "prisma/config";

// Migration / DDL operations need a direct (session-mode) Postgres
// connection. Production runtime queries from Vercel go through the
// PgBouncer transaction-mode pooler via DATABASE_URL — but DDL won't
// work there. When DIRECT_URL is set we use it for the CLI; otherwise
// we fall back to DATABASE_URL (fine for local Postgres / Docker).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});

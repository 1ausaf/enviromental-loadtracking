import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

// Phase 1 seed: create one Owner so the app is loginable on day one.
// Phase 2 adds the in-app user-management UI; from then on, seeding is
// only needed for fresh environments.

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@hkenv.local").toLowerCase();
  const name = process.env.SEED_OWNER_NAME ?? "HK Owner";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!2026";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: user ${email} already exists (role=${existing.role}); skipping.`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "OWNER",
      passwordHash,
      isActive: true,
    },
  });

  console.log("Seed: created Owner user");
  console.log(`  id:       ${user.id}`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  role:     OWNER`);
  console.log("");
  console.log("Sign in at /login. 2FA setup runs on first sign-in.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

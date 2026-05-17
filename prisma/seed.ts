import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

// Inlined to keep the seed independent of src/lib/db.ts (which constructs
// PrismaClient eagerly via its own adapter on import).
const formatEmployeeId = (n: number) => `HK-${String(n).padStart(4, "0")}`;

// Phase 1 seed: create one Owner so the app is loginable on day one.
// Phase 2 adds employee-id backfill for any existing user without one.
// Phase 2 onward: the seed is only needed for fresh environments — new
// users are created via /admin/users in the app.

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  // Make sure the employeeId counter row exists (the migration does this too,
  // but seeding old environments without the row is harmless).
  await prisma.systemCounter.upsert({
    where: { key: "employeeId" },
    create: { key: "employeeId", value: 0 },
    update: {},
  });

  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@hkenv.local").toLowerCase();
  const name = process.env.SEED_OWNER_NAME ?? "HK Owner";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!2026";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.employeeId) {
      const counter = await prisma.systemCounter.update({
        where: { key: "employeeId" },
        data: { value: { increment: 1 } },
      });
      const employeeId = formatEmployeeId(counter.value);
      await prisma.user.update({
        where: { id: existing.id },
        data: { employeeId },
      });
      console.log(`Seed: backfilled employeeId ${employeeId} for ${email}`);
    } else {
      console.log(
        `Seed: user ${email} already exists (role=${existing.role}, employeeId=${existing.employeeId}); skipping.`,
      );
    }
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);
  const counter = await prisma.systemCounter.update({
    where: { key: "employeeId" },
    data: { value: { increment: 1 } },
  });
  const employeeId = formatEmployeeId(counter.value);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "OWNER",
      employeeId,
      passwordHash,
      isActive: true,
    },
  });

  console.log("Seed: created Owner user");
  console.log(`  id:         ${user.id}`);
  console.log(`  email:      ${email}`);
  console.log(`  password:   ${password}`);
  console.log(`  role:       OWNER`);
  console.log(`  employeeId: ${employeeId}`);
  console.log("");
  console.log("Sign in at /login. 2FA setup runs on first sign-in.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

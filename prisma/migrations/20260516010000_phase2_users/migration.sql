-- Phase 2: atomic counter for employee IDs (and other future sequences).
-- See src/lib/employee-id.ts for the bump-and-read transaction.

-- CreateTable
CREATE TABLE "SystemCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SystemCounter_pkey" PRIMARY KEY ("key")
);

-- Seed the employeeId counter so the first allocation returns HK-0001.
INSERT INTO "SystemCounter" ("key", "value") VALUES ('employeeId', 0)
ON CONFLICT ("key") DO NOTHING;

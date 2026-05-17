-- Phase 3: truck and driver management.

-- CreateEnum
CREATE TYPE "TruckType" AS ENUM ('TRI_AXLE', 'END_DUMP', 'LIVE_BOTTOM', 'FLOAT');

-- CreateEnum
CREATE TYPE "TruckStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LicenceClass" AS ENUM ('AZ', 'DZ', 'BZ', 'CZ', 'G');

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "licenceClass" "LicenceClass",
    "photoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "type" "TruckType" NOT NULL,
    "capacityTonnes" DOUBLE PRECISION NOT NULL,
    "colour" TEXT NOT NULL,
    "status" "TruckStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedOperatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckAssignmentEvent" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "TruckAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_userId_key" ON "Operator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_licensePlate_key" ON "Truck"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_assignedOperatorId_key" ON "Truck"("assignedOperatorId");

-- CreateIndex
CREATE INDEX "TruckAssignmentEvent_truckId_idx" ON "TruckAssignmentEvent"("truckId");

-- CreateIndex
CREATE INDEX "TruckAssignmentEvent_operatorId_idx" ON "TruckAssignmentEvent"("operatorId");

-- CreateIndex
CREATE INDEX "TruckAssignmentEvent_releasedAt_idx" ON "TruckAssignmentEvent"("releasedAt");

-- AddForeignKey
ALTER TABLE "Operator" ADD CONSTRAINT "Operator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignmentEvent" ADD CONSTRAINT "TruckAssignmentEvent_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignmentEvent" ADD CONSTRAINT "TruckAssignmentEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing User with role=OPERATOR gets an empty Operator
-- profile row so the rest of the app can rely on User<>Operator parity.
-- Phase 2 + 3 onward: createUser() will create the row inline.
INSERT INTO "Operator" ("id", "userId", "createdAt", "updatedAt")
SELECT
  -- 25-char cuid-ish ID: 'c' + 24 lowercase hex chars from a sha256 of userId.
  'c' || substr(encode(sha256(("id")::bytea), 'hex'), 1, 24),
  "id",
  NOW(),
  NOW()
FROM "User"
WHERE "role" = 'OPERATOR'
  AND NOT EXISTS (SELECT 1 FROM "Operator" WHERE "Operator"."userId" = "User"."id");

-- Phase 5: multi-user dispatch system.

-- CreateEnum
CREATE TYPE "DispatchAcceptance" AS ENUM ('PENDING', 'ACCEPTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('IDLE', 'EN_ROUTE_TO_PICKUP', 'LOADING', 'EN_ROUTE_TO_DUMP', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "pickupNote" TEXT,
    "dumpNote" TEXT,
    "notes" TEXT,
    "acceptance" "DispatchAcceptance" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "status" "DispatchStatus" NOT NULL DEFAULT 'IDLE',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispatch_scheduledFor_idx" ON "Dispatch"("scheduledFor");

-- CreateIndex
CREATE INDEX "Dispatch_projectId_scheduledFor_idx" ON "Dispatch"("projectId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Dispatch_operatorId_scheduledFor_idx" ON "Dispatch"("operatorId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Dispatch_truckId_idx" ON "Dispatch"("truckId");

-- CreateIndex
CREATE INDEX "Dispatch_status_idx" ON "Dispatch"("status");

-- CreateIndex
CREATE INDEX "Dispatch_acceptance_idx" ON "Dispatch"("acceptance");

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

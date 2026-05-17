-- Phase 7: digital load ticketing.

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'FLAGGED');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "brokerName" TEXT,
    "truckNumber" TEXT,
    "licensePlate" TEXT,
    "companyHaulingFor" TEXT,
    "jobContractNumber" TEXT,
    "pickupLocation" TEXT,
    "deliveryLocation" TEXT,
    "equipmentType" "TruckType" NOT NULL,
    "used407ETR" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "comments" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT',
    "signatureDataUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "flaggedById" TEXT,
    "dispatchId" TEXT,
    "projectId" TEXT,
    "operatorId" TEXT NOT NULL,
    "truckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketLoadEntry" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "loadNumber" INTEGER NOT NULL,
    "loadTime" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "TicketLoadEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_dispatchId_key" ON "Ticket"("dispatchId");

-- CreateIndex
CREATE INDEX "Ticket_status_date_idx" ON "Ticket"("status", "date");

-- CreateIndex
CREATE INDEX "Ticket_operatorId_date_idx" ON "Ticket"("operatorId", "date");

-- CreateIndex
CREATE INDEX "Ticket_projectId_date_idx" ON "Ticket"("projectId", "date");

-- CreateIndex
CREATE INDEX "Ticket_truckId_date_idx" ON "Ticket"("truckId", "date");

-- CreateIndex
CREATE INDEX "Ticket_date_idx" ON "Ticket"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TicketLoadEntry_ticketId_loadNumber_key" ON "TicketLoadEntry"("ticketId", "loadNumber");

-- CreateIndex
CREATE INDEX "TicketLoadEntry_ticketId_idx" ON "TicketLoadEntry"("ticketId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLoadEntry" ADD CONSTRAINT "TicketLoadEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the ticketNumber counter at 100000 so the first ticket is T-100001.
INSERT INTO "SystemCounter" ("key", "value") VALUES ('ticketNumber', 100000)
ON CONFLICT ("key") DO NOTHING;

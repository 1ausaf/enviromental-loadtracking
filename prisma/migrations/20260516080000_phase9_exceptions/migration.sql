-- Phase 9: Owner exception approvals.

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('TICKET_LATE_SUBMISSION', 'TICKET_FLAGGED', 'ADMIN_OVERRIDE_REQUEST');

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "ticketId" TEXT,
    "dispatchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" TEXT,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exception_status_createdAt_idx" ON "Exception"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Exception_type_createdAt_idx" ON "Exception"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Exception_ticketId_idx" ON "Exception"("ticketId");

-- CreateIndex
CREATE INDEX "Exception_dispatchId_idx" ON "Exception"("dispatchId");

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

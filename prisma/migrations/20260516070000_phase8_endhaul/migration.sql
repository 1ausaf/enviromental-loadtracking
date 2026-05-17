-- Phase 8: end-of-haul submission — adds material type, issues note, and
-- optional photo attachments to tickets.

-- AlterTable: add Phase 8 columns to Ticket
ALTER TABLE "Ticket"
  ADD COLUMN "materialType" TEXT,
  ADD COLUMN "issuesNote" TEXT;

-- CreateTable
CREATE TABLE "TicketPhoto" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketPhoto_ticketId_uploadedAt_idx" ON "TicketPhoto"("ticketId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "TicketPhoto" ADD CONSTRAINT "TicketPhoto_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

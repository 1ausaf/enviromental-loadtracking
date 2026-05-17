-- Phase 6: GPS trip tracking and location history.

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "endLatitude" DOUBLE PRECISION,
    "endLongitude" DOUBLE PRECISION,
    "pointCount" INTEGER NOT NULL DEFAULT 0,
    "totalDistanceM" DOUBLE PRECISION,
    "pickupNote" TEXT,
    "dumpNote" TEXT,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPoint" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,

    CONSTRAINT "TripPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_dispatchId_key" ON "Trip"("dispatchId");

-- CreateIndex
CREATE INDEX "Trip_operatorId_startedAt_idx" ON "Trip"("operatorId", "startedAt");

-- CreateIndex
CREATE INDEX "Trip_projectId_startedAt_idx" ON "Trip"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "Trip_truckId_startedAt_idx" ON "Trip"("truckId", "startedAt");

-- CreateIndex
CREATE INDEX "Trip_startedAt_idx" ON "Trip"("startedAt");

-- CreateIndex
CREATE INDEX "TripPoint_tripId_recordedAt_idx" ON "TripPoint"("tripId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPoint" ADD CONSTRAINT "TripPoint_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

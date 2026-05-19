-- Phase 12: geofence-driven pickup/drop tracking and per-dispatch load pools.
--
-- Project gets pickup/dump coordinates (admin sets via map pin). Dispatch
-- gets loadsAssigned / loadsCompleted so the project's loadTarget pool can
-- be split across multiple operators. A new DispatchLoad table records each
-- pickup→drop cycle with timestamps + GPS pins.

-- Project coordinates (nullable so legacy rows stay valid)
ALTER TABLE "Project"
  ADD COLUMN "pickupLatitude"  DOUBLE PRECISION,
  ADD COLUMN "pickupLongitude" DOUBLE PRECISION,
  ADD COLUMN "dumpLatitude"    DOUBLE PRECISION,
  ADD COLUMN "dumpLongitude"   DOUBLE PRECISION;

-- Dispatch load tracking
ALTER TABLE "Dispatch"
  ADD COLUMN "loadsAssigned"  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "loadsCompleted" INTEGER NOT NULL DEFAULT 0;

-- Per-cycle pickup/drop log
CREATE TABLE "DispatchLoad" (
  "id"               TEXT NOT NULL,
  "dispatchId"       TEXT NOT NULL,
  "loadNumber"       INTEGER NOT NULL,
  "pickupAt"         TIMESTAMP(3),
  "pickupLatitude"   DOUBLE PRECISION,
  "pickupLongitude"  DOUBLE PRECISION,
  "pickupAccuracy"   DOUBLE PRECISION,
  "dropoffAt"        TIMESTAMP(3),
  "dropoffLatitude"  DOUBLE PRECISION,
  "dropoffLongitude" DOUBLE PRECISION,
  "dropoffAccuracy"  DOUBLE PRECISION,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DispatchLoad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispatchLoad_dispatchId_loadNumber_key"
  ON "DispatchLoad"("dispatchId", "loadNumber");

CREATE INDEX "DispatchLoad_dispatchId_idx"
  ON "DispatchLoad"("dispatchId");

ALTER TABLE "DispatchLoad"
  ADD CONSTRAINT "DispatchLoad_dispatchId_fkey"
  FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

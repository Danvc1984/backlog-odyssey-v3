-- At most one RUNNING PriceRefresh at a time; the refresh engine claims
-- through this index and recovers abandoned runs before starting a new one.
CREATE UNIQUE INDEX "PriceRefresh_single_running" ON "PriceRefresh" ("status")
WHERE "status" = 'RUNNING';

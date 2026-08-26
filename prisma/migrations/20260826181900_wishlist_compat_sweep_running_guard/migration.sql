-- At most one RUNNING WishlistCompatSweep at a time; the sweep engine claims
-- through this index and recovers abandoned runs before starting a new one.
CREATE UNIQUE INDEX "WishlistCompatSweep_single_running" ON "WishlistCompatSweep" ("status")
WHERE "status" = 'RUNNING';
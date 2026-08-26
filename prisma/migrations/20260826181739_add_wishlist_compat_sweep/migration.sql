-- CreateTable
CREATE TABLE "WishlistCompatSweep" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "counts" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WishlistCompatSweep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistCompatSweep_status_requestedAt_idx" ON "WishlistCompatSweep"("status", "requestedAt");

-- RenameIndex
ALTER INDEX "WishlistEnvironmentCompatibility_wishlistEntryId_environment_ke" RENAME TO "WishlistEnvironmentCompatibility_wishlistEntryId_environmen_key";

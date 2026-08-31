-- CreateTable
CREATE TABLE "SteamRecentActivityCache" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "entries" JSONB,
    "refreshedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamRecentActivityCache_pkey" PRIMARY KEY ("id")
);

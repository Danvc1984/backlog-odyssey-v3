-- AlterEnum
ALTER TYPE "MatchMethod" ADD VALUE 'MANUAL_IGDB_SEARCH';

-- AlterEnum
ALTER TYPE "Provider" ADD VALUE 'IGDB';

-- CreateTable
CREATE TABLE "IgdbTokenCache" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgdbTokenCache_pkey" PRIMARY KEY ("id")
);

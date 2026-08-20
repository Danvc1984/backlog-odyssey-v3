-- CreateEnum
CREATE TYPE "UnresolvedDlcStatus" AS ENUM ('PENDING', 'DISCARDED');

-- CreateTable
CREATE TABLE "UnresolvedSteamDlc" (
    "id" TEXT NOT NULL,
    "steamAppId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steamBaseAppId" TEXT,
    "status" "UnresolvedDlcStatus" NOT NULL DEFAULT 'PENDING',
    "discardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnresolvedSteamDlc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnresolvedSteamDlc_steamAppId_key" ON "UnresolvedSteamDlc"("steamAppId");

-- CreateIndex
CREATE INDEX "UnresolvedSteamDlc_status_idx" ON "UnresolvedSteamDlc"("status");

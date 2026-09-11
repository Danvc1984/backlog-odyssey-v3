-- CreateEnum
CREATE TYPE "DurationProfile" AS ENUM ('HASTILY', 'NORMALLY', 'COMPLETELY');

-- CreateEnum
CREATE TYPE "PlaytimeProvider" AS ENUM ('IGDB', 'STEAMSPY');

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "durationProfile" "DurationProfile" NOT NULL DEFAULT 'NORMALLY';

-- CreateTable
CREATE TABLE "PlaytimeEvidence" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "PlaytimeProvider" NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaytimeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaytimeEvidence_gameId_key" ON "PlaytimeEvidence"("gameId");

-- AddForeignKey
ALTER TABLE "PlaytimeEvidence" ADD CONSTRAINT "PlaytimeEvidence_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

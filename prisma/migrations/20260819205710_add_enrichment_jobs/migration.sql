-- CreateEnum
CREATE TYPE "EnrichmentJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'AWAITING_MATCH', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnrichmentJobStage" AS ENUM ('MATCHING', 'PERSISTING', 'RETRYING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "EnrichmentJobStage" NOT NULL DEFAULT 'MATCHING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "candidatePayload" JSONB,
    "selectedRawgId" INTEGER,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_nextAttemptAt_idx" ON "EnrichmentJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "EnrichmentJob_gameId_provider_key" ON "EnrichmentJob"("gameId", "provider");

-- AddForeignKey
ALTER TABLE "EnrichmentJob" ADD CONSTRAINT "EnrichmentJob_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

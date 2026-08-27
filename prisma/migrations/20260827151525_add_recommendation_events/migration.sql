-- CreateEnum
CREATE TYPE "RecommendationEventKind" AS ENUM ('EXPOSURE', 'ROTATION', 'TASTE_SETUP_ANSWER', 'START', 'COMPLETION', 'ABANDONMENT', 'DISMISSAL');

-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "kind" "RecommendationEventKind" NOT NULL,
    "gameId" TEXT,
    "wishlistEntryId" TEXT,
    "runId" TEXT,
    "reason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationEvent_kind_createdAt_idx" ON "RecommendationEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_gameId_kind_idx" ON "RecommendationEvent"("gameId", "kind");

-- CreateIndex
CREATE INDEX "RecommendationEvent_wishlistEntryId_kind_idx" ON "RecommendationEvent"("wishlistEntryId", "kind");

-- CreateIndex
CREATE INDEX "RecommendationEvent_runId_idx" ON "RecommendationEvent"("runId");

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

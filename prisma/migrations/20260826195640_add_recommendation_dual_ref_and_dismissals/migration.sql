/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `RecommendationFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `RecommendationFeedback` table. All the data in the column will be lost.
  - Changed the type of `kind` on the `RecommendationFeedback` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "RecommendationFeedback" DROP COLUMN "expiresAt",
DROP COLUMN "reason",
ADD COLUMN     "wishlistEntryId" TEXT,
ALTER COLUMN "gameId" DROP NOT NULL,
DROP COLUMN "kind",
ADD COLUMN     "kind" "RecommendationKind" NOT NULL;

-- AlterTable
ALTER TABLE "RecommendationItem" ADD COLUMN     "wishlistEntryId" TEXT,
ALTER COLUMN "gameId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "RecommendationFeedback_gameId_kind_idx" ON "RecommendationFeedback"("gameId", "kind");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_wishlistEntryId_kind_idx" ON "RecommendationFeedback"("wishlistEntryId", "kind");

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

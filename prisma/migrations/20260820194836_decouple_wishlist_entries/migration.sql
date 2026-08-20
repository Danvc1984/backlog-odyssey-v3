/*
  Warnings:

  - You are about to drop the column `gameId` on the `WishlistEntry` table. All the data in the column will be lost.
  - You are about to drop the column `targetPrice` on the `WishlistEntry` table. All the data in the column will be lost.
  - Added the required column `name` to the `WishlistEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "WishlistEntry" DROP CONSTRAINT "WishlistEntry_gameId_fkey";

-- DropIndex
DROP INDEX "WishlistEntry_gameId_idx";

-- DropIndex
DROP INDEX "WishlistEntry_gameId_key";

-- AlterTable
ALTER TABLE "WishlistEntry" DROP COLUMN "gameId",
DROP COLUMN "targetPrice",
ADD COLUMN     "baseGameId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "sourcePreference" TEXT,
ADD COLUMN     "steamAppId" TEXT,
ADD COLUMN     "targetPriceMxn" DECIMAL(10,2),
ADD COLUMN     "type" "GameType" NOT NULL DEFAULT 'BASE_GAME';

-- CreateTable
CREATE TABLE "WishlistMetadataSnapshot" (
    "id" TEXT NOT NULL,
    "wishlistEntryId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'RAWG',
    "payload" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "WishlistMetadataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistMetadataSnapshot_wishlistEntryId_key" ON "WishlistMetadataSnapshot"("wishlistEntryId");

-- CreateIndex
CREATE INDEX "WishlistMetadataSnapshot_wishlistEntryId_provider_idx" ON "WishlistMetadataSnapshot"("wishlistEntryId", "provider");

-- CreateIndex
CREATE INDEX "WishlistEntry_baseGameId_idx" ON "WishlistEntry"("baseGameId");

-- CreateIndex
CREATE INDEX "WishlistEntry_type_idx" ON "WishlistEntry"("type");

-- AddForeignKey
ALTER TABLE "WishlistEntry" ADD CONSTRAINT "WishlistEntry_baseGameId_fkey" FOREIGN KEY ("baseGameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistMetadataSnapshot" ADD CONSTRAINT "WishlistMetadataSnapshot_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

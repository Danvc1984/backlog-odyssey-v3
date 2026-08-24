-- CreateEnum
CREATE TYPE "UnresolvedDlcSource" AS ENUM ('OWNED_SYNC', 'WISHLIST_IMPORT');

-- CreateEnum
CREATE TYPE "WishlistImportReviewStatus" AS ENUM ('OPEN', 'LINKED', 'IGNORED');

-- AlterTable
ALTER TABLE "UnresolvedSteamDlc" ADD COLUMN     "source" "UnresolvedDlcSource" NOT NULL DEFAULT 'OWNED_SYNC';

-- CreateTable
CREATE TABLE "WishlistImportReview" (
    "id" TEXT NOT NULL,
    "steamAppId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "status" "WishlistImportReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistImportReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistImportIgnore" (
    "id" TEXT NOT NULL,
    "steamAppId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistImportIgnore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistImportReview_steamAppId_key" ON "WishlistImportReview"("steamAppId");

-- CreateIndex
CREATE INDEX "WishlistImportReview_status_idx" ON "WishlistImportReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistImportIgnore_steamAppId_key" ON "WishlistImportIgnore"("steamAppId");

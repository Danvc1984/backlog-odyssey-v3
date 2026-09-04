-- AlterTable
ALTER TABLE "WallpaperState" ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;

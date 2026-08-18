-- CreateEnum
CREATE TYPE "CatalogOperationType" AS ENUM ('MERGE', 'DELETE');

-- CreateEnum
CREATE TYPE "CatalogOperationState" AS ENUM ('PENDING', 'UNDONE', 'EXPIRED', 'COMPLETED');

-- CreateTable
CREATE TABLE "CatalogOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CatalogOperationType" NOT NULL,
    "state" "CatalogOperationState" NOT NULL DEFAULT 'PENDING',
    "affectedGameIds" TEXT[],
    "snapshot" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogOperation_userId_state_idx" ON "CatalogOperation"("userId", "state");

-- CreateIndex
CREATE INDEX "CatalogOperation_expiresAt_idx" ON "CatalogOperation"("expiresAt");

-- AddForeignKey
ALTER TABLE "CatalogOperation" ADD CONSTRAINT "CatalogOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

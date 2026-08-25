-- CreateTable
CREATE TABLE "WishlistCompatibilitySnapshot" (
    "id" TEXT NOT NULL,
    "wishlistEntryId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "result" JSONB,
    "sourceUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "WishlistCompatibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistEnvironmentCompatibility" (
    "id" TEXT NOT NULL,
    "wishlistEntryId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "status" "CompatibilityStatus" NOT NULL,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistEnvironmentCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistCompatibilitySnapshot_wishlistEntryId_provider_key" ON "WishlistCompatibilitySnapshot"("wishlistEntryId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistEnvironmentCompatibility_wishlistEntryId_environment_key" ON "WishlistEnvironmentCompatibility"("wishlistEntryId", "environment");

-- AddForeignKey
ALTER TABLE "WishlistCompatibilitySnapshot" ADD CONSTRAINT "WishlistCompatibilitySnapshot_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistEnvironmentCompatibility" ADD CONSTRAINT "WishlistEnvironmentCompatibility_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

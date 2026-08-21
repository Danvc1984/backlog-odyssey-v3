-- AlterTable
ALTER TABLE "DealOffer" ADD COLUMN     "itadFlag" TEXT;

-- CreateTable
CREATE TABLE "ItadIdentity" (
    "steamAppId" TEXT NOT NULL,
    "itadId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItadIdentity_pkey" PRIMARY KEY ("steamAppId")
);

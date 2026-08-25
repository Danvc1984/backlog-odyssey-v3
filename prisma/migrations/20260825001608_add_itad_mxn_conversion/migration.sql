-- AlterTable
ALTER TABLE "DealOffer" ADD COLUMN     "exchangeRateFetchedAt" TIMESTAMP(3),
ADD COLUMN     "exchangeRateToMxn" DECIMAL(14,6),
ADD COLUMN     "sourceCurrency" TEXT,
ADD COLUMN     "sourceHistoricalLow" DECIMAL(10,2),
ADD COLUMN     "sourcePrice" DECIMAL(10,2),
ADD COLUMN     "sourceRegularPrice" DECIMAL(10,2);

ALTER TABLE "AppSettings" ADD COLUMN "displayCurrency" TEXT NOT NULL DEFAULT 'MXN';

ALTER TABLE "DealOffer" ADD COLUMN "displayCurrency" TEXT;

ALTER TABLE "DealOffer" ADD COLUMN "exchangeRateToDisplayCurrency" DECIMAL(14,6);

ALTER TABLE "PriceRefresh" ADD COLUMN "displayCurrency" TEXT;

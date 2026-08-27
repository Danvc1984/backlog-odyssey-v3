-- CreateEnum
CREATE TYPE "RecommendationDimension" AS ENUM ('GENRE', 'TAG', 'EXPERIENCE', 'DURATION', 'PUBLISHER', 'ERA', 'SERIES', 'ENVIRONMENT', 'MATURITY');

-- CreateEnum
CREATE TYPE "RecommendationPreferenceAttitude" AS ENUM ('PREFER', 'NEUTRAL', 'AVOID');

-- CreateTable
CREATE TABLE "RecommendationProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationPreference" (
    "id" TEXT NOT NULL,
    "dimension" "RecommendationDimension" NOT NULL,
    "value" TEXT NOT NULL,
    "attitude" "RecommendationPreferenceAttitude" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationPreference_dimension_value_key" ON "RecommendationPreference"("dimension", "value");

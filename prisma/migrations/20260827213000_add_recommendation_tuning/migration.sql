-- CreateTable
CREATE TABLE "RecommendationTuneState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "playTune" JSONB,
    "buyTune" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationTuneState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tune" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationPreset_name_key" ON "RecommendationPreset"("name");

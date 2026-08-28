-- AlterTable
ALTER TABLE "GameAvailability" ADD COLUMN     "alternativeSourceId" TEXT;

-- CreateTable
CREATE TABLE "AlternativeSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "knownKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlternativeSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlternativeSource_normalizedName_key" ON "AlternativeSource"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "AlternativeSource_knownKey_key" ON "AlternativeSource"("knownKey");

-- Copy a display name onto unnamed OTHER_PLATFORM rows, taken verbatim from
-- the game's earliest named duplicate. Runs before dedup so the kept row still
-- sees its discarded siblings' names. No store is inferred from names.
WITH named AS (
    SELECT DISTINCT ON ("gameId")
        "gameId",
        "displayName"
    FROM "GameAvailability"
    WHERE "source" = 'OTHER_PLATFORM' AND "displayName" IS NOT NULL
    ORDER BY "gameId", "addedAt" ASC, "id" ASC
)
UPDATE "GameAvailability" AS target
SET "displayName" = named."displayName"
FROM named
WHERE target."gameId" = named."gameId"
  AND target."source" = 'OTHER_PLATFORM'
  AND target."displayName" IS NULL;

-- Collapse duplicate OTHER_PLATFORM rows into the oldest row per game. The
-- shared alternativeSourceId backfilled below would otherwise collide on the
-- per-game unique index. Oldest means earliest addedAt, then smallest id.
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "gameId"
            ORDER BY "addedAt" ASC, "id" ASC
        ) AS rn
    FROM "GameAvailability"
    WHERE "source" = 'OTHER_PLATFORM'
)
DELETE FROM "GameAvailability"
USING ranked
WHERE "GameAvailability"."id" = ranked."id" AND ranked.rn > 1;

-- Code-owned fallback record every migrated row points at. Created by exact
-- normalized name so later creation paths reuse it; the same fixed id keeps
-- the backfill deterministic.
INSERT INTO "AlternativeSource" ("id", "name", "normalizedName", "createdAt", "updatedAt")
VALUES (
    'unspecified-other-source',
    'Unspecified other source',
    'unspecified other source',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("normalizedName") DO NOTHING;

-- Every remaining OTHER_PLATFORM row now references the unspecified record.
UPDATE "GameAvailability"
SET "alternativeSourceId" = (
    SELECT "id" FROM "AlternativeSource"
    WHERE "normalizedName" = 'unspecified other source'
)
WHERE "source" = 'OTHER_PLATFORM';

-- CreateIndex
CREATE UNIQUE INDEX "GameAvailability_gameId_source_alternativeSourceId_key" ON "GameAvailability"("gameId", "source", "alternativeSourceId");

-- AddForeignKey
ALTER TABLE "GameAvailability" ADD CONSTRAINT "GameAvailability_alternativeSourceId_fkey" FOREIGN KEY ("alternativeSourceId") REFERENCES "AlternativeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
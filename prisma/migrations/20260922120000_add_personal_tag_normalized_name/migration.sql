-- Persist the tag identity used by all server-side tag operations.
-- Existing rows are trimmed and case-folded before the unique key is added.
ALTER TABLE "PersonalTag" ADD COLUMN "normalizedName" TEXT;

-- Keep the oldest tag for each normalized identity and union its memberships.
WITH ranked_tags AS (
  SELECT
    "id",
    first_value("id") OVER (
      PARTITION BY lower(trim("name"))
      ORDER BY "id"
    ) AS canonical_id
  FROM "PersonalTag"
)
INSERT INTO "GameTag" ("gameId", "tagId")
SELECT gt."gameId", rt.canonical_id
FROM "GameTag" gt
JOIN ranked_tags rt ON rt."id" = gt."tagId"
WHERE rt."id" <> rt.canonical_id
ON CONFLICT ("gameId", "tagId") DO NOTHING;

WITH ranked_tags AS (
  SELECT
    "id",
    first_value("id") OVER (
      PARTITION BY lower(trim("name"))
      ORDER BY "id"
    ) AS canonical_id
  FROM "PersonalTag"
)
DELETE FROM "PersonalTag" pt
USING ranked_tags rt
WHERE pt."id" = rt."id"
  AND rt."id" <> rt.canonical_id;

UPDATE "PersonalTag"
SET
  "name" = trim("name"),
  "normalizedName" = lower(trim("name"));

ALTER TABLE "PersonalTag" ALTER COLUMN "normalizedName" SET NOT NULL;
CREATE UNIQUE INDEX "PersonalTag_normalizedName_key" ON "PersonalTag"("normalizedName");

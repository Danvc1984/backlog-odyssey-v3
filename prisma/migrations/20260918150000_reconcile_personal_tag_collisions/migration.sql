-- Reconcile normalized PersonalTag collisions created before the collection migration was hardened.
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

-- Preserve editable collection membership as unified personal tags.
-- Existing tags win normalized collisions so migrated memberships reuse one ID.
WITH collection_names AS (
  SELECT lower(trim("name")) AS normalized_name, min(trim("name")) AS canonical_name
  FROM "Collection"
  WHERE "isSystem" = false
  GROUP BY lower(trim("name"))
), existing_tags AS (
  SELECT DISTINCT ON (lower(trim("name")))
    lower(trim("name")) AS normalized_name,
    "id" AS tag_id
  FROM "PersonalTag"
  ORDER BY lower(trim("name")), "id"
)
INSERT INTO "PersonalTag" ("id", "name")
SELECT md5('tag:' || cn.normalized_name), cn.canonical_name
FROM collection_names cn
LEFT JOIN existing_tags et ON et.normalized_name = cn.normalized_name
WHERE et.tag_id IS NULL
ON CONFLICT ("name") DO NOTHING;

-- Merge any pre-existing tag collisions before adding migrated memberships.
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
    lower(trim("name")) AS normalized_name,
    first_value("id") OVER (
      PARTITION BY lower(trim("name"))
      ORDER BY "id"
    ) AS canonical_id
  FROM "PersonalTag"
)
INSERT INTO "GameTag" ("gameId", "tagId")
SELECT cm."gameId", rt.canonical_id
FROM "CollectionMembership" cm
JOIN "Collection" c ON c."id" = cm."collectionId" AND c."isSystem" = false
JOIN ranked_tags rt ON rt.normalized_name = lower(trim(c."name"))
  AND rt."id" = rt.canonical_id
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

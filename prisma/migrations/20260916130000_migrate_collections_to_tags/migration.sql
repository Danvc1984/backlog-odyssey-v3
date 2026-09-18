-- Preserve editable collection membership as unified personal tags.
INSERT INTO "PersonalTag" ("id", "name")
SELECT md5('tag:' || lower(trim("name"))), min(trim("name"))
FROM "Collection"
WHERE "isSystem" = false
GROUP BY lower(trim("name"))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "GameTag" ("gameId", "tagId")
SELECT cm."gameId", pt."id"
FROM "CollectionMembership" cm
JOIN "Collection" c ON c."id" = cm."collectionId" AND c."isSystem" = false
JOIN "PersonalTag" pt ON lower(trim(pt."name")) = lower(trim(c."name"))
ON CONFLICT ("gameId", "tagId") DO NOTHING;

-- Manual collections were migrated to PersonalTag/GameTag in the preceding migration.
-- Keep calculated shelves and normalized personal tags as the only collection model.
DROP TABLE IF EXISTS "CollectionMembership";
DROP TABLE IF EXISTS "Collection";

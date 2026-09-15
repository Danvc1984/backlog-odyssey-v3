-- RAWG data is intentionally discarded by the clean provider transition.
-- The text casts keep cleanup valid if a failed attempt has already changed a
-- provider column to the replacement enum before stopping.
DELETE FROM "EnrichmentJob" WHERE "provider"::text = 'RAWG';
DELETE FROM "SyncRun" WHERE "provider"::text = 'RAWG';
DELETE FROM "MetadataSnapshot" WHERE "provider"::text = 'RAWG';
DELETE FROM "WishlistMetadataSnapshot" WHERE "provider"::text = 'RAWG';
UPDATE "ExternalGameId" SET "matchMethod" = 'INFERRED' WHERE "matchMethod"::text = 'MANUAL_RAWG_SEARCH';
UPDATE "WishlistEntry" SET "steamAppIdProvenance" = NULL WHERE "steamAppIdProvenance"::text = 'RAWG_SUGGESTION';

ALTER TABLE "EnrichmentJob" DROP COLUMN IF EXISTS "selectedRawgId";

ALTER TABLE "ExternalGameId" ALTER COLUMN "matchMethod" DROP DEFAULT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MatchMethod_new') THEN
    CREATE TYPE "MatchMethod_new" AS ENUM ('EXACT_STEAM_APP_ID', 'MANUAL_IGDB_SEARCH', 'MANUAL_ITAD_LOOKUP', 'INFERRED');
  END IF;
END $$;
ALTER TABLE "ExternalGameId" ALTER COLUMN "matchMethod" TYPE "MatchMethod_new" USING ("matchMethod"::text::"MatchMethod_new");
ALTER TYPE "MatchMethod" RENAME TO "MatchMethod_old";
ALTER TYPE "MatchMethod_new" RENAME TO "MatchMethod";
DROP TYPE IF EXISTS "MatchMethod_old";
ALTER TABLE "ExternalGameId" ALTER COLUMN "matchMethod" SET DEFAULT 'EXACT_STEAM_APP_ID';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PriceIdentityProvenance_new') THEN
    CREATE TYPE "PriceIdentityProvenance_new" AS ENUM ('STEAM_IMPORT', 'USER', 'IGDB_SUGGESTION');
  END IF;
END $$;
ALTER TABLE "WishlistEntry" ALTER COLUMN "steamAppIdProvenance" TYPE "PriceIdentityProvenance_new" USING ("steamAppIdProvenance"::text::"PriceIdentityProvenance_new");
ALTER TYPE "PriceIdentityProvenance" RENAME TO "PriceIdentityProvenance_old";
ALTER TYPE "PriceIdentityProvenance_new" RENAME TO "PriceIdentityProvenance";
DROP TYPE IF EXISTS "PriceIdentityProvenance_old";

ALTER TABLE "WishlistMetadataSnapshot" ALTER COLUMN "provider" DROP DEFAULT;
DROP INDEX IF EXISTS "MetadataSnapshot_gameId_provider_idx";
DROP INDEX IF EXISTS "EnrichmentJob_gameId_provider_key";
DROP INDEX IF EXISTS "SyncRun_one_active_rawg_batch_key";
DROP INDEX IF EXISTS "SyncRun_provider_status_idx";
DROP INDEX IF EXISTS "WishlistMetadataSnapshot_wishlistEntryId_provider_idx";
DROP INDEX IF EXISTS "CompatibilitySnapshot_gameId_provider_key";
DROP INDEX IF EXISTS "WishlistCompatibilitySnapshot_wishlistEntryId_provider_key";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Provider_new') THEN
    CREATE TYPE "Provider_new" AS ENUM ('PROTONDB', 'ARE_WE_ANTICHEAT_YET', 'STEAM_DECK_VERIFIED', 'IGDB', 'ITAD', 'STEAM', 'WALLHAVEN');
  END IF;
END $$;
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['MetadataSnapshot', 'EnrichmentJob', 'SyncRun', 'WishlistMetadataSnapshot', 'CompatibilitySnapshot', 'WishlistCompatibilitySnapshot'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns AS c
      WHERE c.table_schema = current_schema() AND c.table_name = tbl
        AND c.column_name = 'provider' AND c.udt_name = 'Provider'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN "provider" TYPE "Provider_new" USING ("provider"::text::"Provider_new")', tbl);
    END IF;
  END LOOP;
END $$;
ALTER TYPE "Provider" RENAME TO "Provider_old";
ALTER TYPE "Provider_new" RENAME TO "Provider";
DROP TYPE IF EXISTS "Provider_old";
CREATE UNIQUE INDEX "CompatibilitySnapshot_gameId_provider_key" ON "CompatibilitySnapshot"("gameId", "provider");
CREATE UNIQUE INDEX "EnrichmentJob_gameId_provider_key" ON "EnrichmentJob"("gameId", "provider");
CREATE INDEX "MetadataSnapshot_gameId_provider_idx" ON "MetadataSnapshot"("gameId", "provider");
CREATE INDEX "SyncRun_provider_status_idx" ON "SyncRun"("provider", "status");
CREATE INDEX "WishlistMetadataSnapshot_wishlistEntryId_provider_idx" ON "WishlistMetadataSnapshot"("wishlistEntryId", "provider");
CREATE UNIQUE INDEX "WishlistCompatibilitySnapshot_wishlistEntryId_provider_key" ON "WishlistCompatibilitySnapshot"("wishlistEntryId", "provider");
ALTER TABLE "WishlistMetadataSnapshot" ALTER COLUMN "provider" SET DEFAULT 'IGDB';

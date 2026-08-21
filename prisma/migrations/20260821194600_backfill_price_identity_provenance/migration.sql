-- Backfill provenance for identities that already exist without one.
UPDATE "WishlistEntry"
SET "steamAppIdProvenance" = 'USER'
WHERE "steamAppId" IS NOT NULL;

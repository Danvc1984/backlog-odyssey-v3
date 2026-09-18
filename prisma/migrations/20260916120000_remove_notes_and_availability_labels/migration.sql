-- Removed personal notes and per-game availability labels from the product contract.
ALTER TABLE "LibraryEntry" DROP COLUMN "notes";
ALTER TABLE "WishlistEntry" DROP COLUMN "notes";
ALTER TABLE "GameAvailability" DROP COLUMN "displayName";

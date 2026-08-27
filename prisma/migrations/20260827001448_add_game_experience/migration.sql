-- CreateEnum
CREATE TYPE "GameExperience" AS ENUM ('PC_GAMING', 'MULTIPLAYER_COOP', 'COUCH_GAMING', 'ON_THE_GO');

-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "gameExperience" "GameExperience";

-- AlterTable
ALTER TABLE "WishlistEntry" ADD COLUMN     "gameExperience" "GameExperience";

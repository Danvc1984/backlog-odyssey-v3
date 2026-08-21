/*
  Warnings:

  - You are about to drop the column `sourcePreference` on the `WishlistEntry` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PriceIdentityProvenance" AS ENUM ('STEAM_IMPORT', 'USER', 'RAWG_SUGGESTION');

-- AlterTable
ALTER TABLE "WishlistEntry" DROP COLUMN "sourcePreference",
ADD COLUMN     "steamAppIdProvenance" "PriceIdentityProvenance";

-- AlterEnum
BEGIN;
CREATE TYPE "RecommendationDimension_new" AS ENUM ('GENRE', 'TAG', 'EXPERIENCE', 'DURATION', 'PUBLISHER', 'ERA', 'SERIES', 'MATURITY');
ALTER TABLE "RecommendationPreference" ALTER COLUMN "dimension" TYPE "RecommendationDimension_new" USING ("dimension"::text::"RecommendationDimension_new");
ALTER TYPE "RecommendationDimension" RENAME TO "RecommendationDimension_old";
ALTER TYPE "RecommendationDimension_new" RENAME TO "RecommendationDimension";
DROP TYPE "public"."RecommendationDimension_old";
COMMIT;

-- AlterTable
ALTER TABLE "LibraryEntry" DROP COLUMN "preferredEnvironment";

-- AlterEnum
BEGIN;
CREATE TYPE "RecommendationRole_new" AS ENUM ('BEST_FIT_1', 'BEST_FIT_2', 'HANDHELD_PICK', 'OUT_OF_THE_BOX', 'CHANGE_OF_PACE', 'DEAL');
ALTER TABLE "RecommendationItem" ALTER COLUMN "role" TYPE "RecommendationRole_new" USING ("role"::text::"RecommendationRole_new");
ALTER TYPE "RecommendationRole" RENAME TO "RecommendationRole_old";
ALTER TYPE "RecommendationRole_new" RENAME TO "RecommendationRole";
DROP TYPE "RecommendationRole_old";
COMMIT;

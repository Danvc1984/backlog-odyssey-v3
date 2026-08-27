-- CreateEnum
CREATE TYPE "RecommendationRole" AS ENUM ('BEST_FIT_1', 'BEST_FIT_2', 'OUT_OF_THE_BOX', 'CHANGE_OF_PACE', 'DEAL');

-- AlterTable
ALTER TABLE "RecommendationItem" ADD COLUMN     "role" "RecommendationRole";

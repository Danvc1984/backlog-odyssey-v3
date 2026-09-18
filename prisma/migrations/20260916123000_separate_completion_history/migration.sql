CREATE TYPE "PlayState_new" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

ALTER TABLE "LibraryEntry" ALTER COLUMN "playState" DROP DEFAULT;
ALTER TABLE "LibraryEntry" ALTER COLUMN "playState" TYPE "PlayState_new"
  USING (CASE WHEN "playState"::text = 'PLAYED_BEFORE' THEN 'COMPLETED' ELSE "playState"::text END::"PlayState_new");
ALTER TYPE "PlayState" RENAME TO "PlayState_old";
ALTER TYPE "PlayState_new" RENAME TO "PlayState";
DROP TYPE "PlayState_old";
ALTER TABLE "LibraryEntry" ALTER COLUMN "playState" SET DEFAULT 'NOT_STARTED';

ALTER TABLE "LibraryEntry" ADD COLUMN "completedBefore" BOOLEAN NOT NULL DEFAULT false;
UPDATE "LibraryEntry" SET "completedBefore" = true WHERE "playState" = 'COMPLETED';

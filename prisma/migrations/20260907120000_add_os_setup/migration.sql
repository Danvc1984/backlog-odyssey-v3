-- Rename the existing Linux environment without recreating the enum type.
ALTER TYPE "Environment" RENAME VALUE 'BAZZITE' TO 'LINUX';

CREATE TYPE "PrimaryOs" AS ENUM ('LINUX', 'WINDOWS');
CREATE TYPE "HandheldOs" AS ENUM ('NONE', 'LINUX', 'WINDOWS');

ALTER TABLE "AppSettings"
  ADD COLUMN "primaryOs" "PrimaryOs" NOT NULL DEFAULT 'LINUX',
  ADD COLUMN "hasWindowsFallback" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "handheldOs" "HandheldOs" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AppSettings"
SET
  "primaryOs" = CASE
    WHEN "desktopOs" = 'WINDOWS' THEN 'WINDOWS'::"PrimaryOs"
    ELSE 'LINUX'::"PrimaryOs"
  END,
  "hasWindowsFallback" = ("fallbackOs" = 'WINDOWS'),
  "handheldOs" = CASE
    WHEN "portableDevice" IN ('STEAM_DECK', 'BAZZITE', 'LINUX') THEN 'LINUX'::"HandheldOs"
    WHEN "portableDevice" = 'WINDOWS' THEN 'WINDOWS'::"HandheldOs"
    ELSE 'NONE'::"HandheldOs"
  END,
  "onboardingCompleted" = true;

ALTER TABLE "AppSettings"
  DROP COLUMN "desktopOs",
  DROP COLUMN "portableDevice",
  DROP COLUMN "fallbackOs";

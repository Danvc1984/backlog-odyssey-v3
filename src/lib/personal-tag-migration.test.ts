import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const freshMigrationSql = readFileSync(
  new URL(
    "../../prisma/migrations/20260916130000_migrate_collections_to_tags/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const repairMigrationSql = readFileSync(
  new URL(
    "../../prisma/migrations/20260918150000_reconcile_personal_tag_collisions/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const normalizedNameMigrationSql = readFileSync(
  new URL(
    "../../prisma/migrations/20260922120000_add_personal_tag_normalized_name/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
function readEnvironmentValue(name: string): string | undefined {
  const processValue = process.env[name];
  if (processValue) return processValue;

  try {
    const envFile = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    const line = envFile
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

const connectionString =
  readEnvironmentValue("DIRECT_URL") ?? readEnvironmentValue("DATABASE_URL");
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("collection-to-tag migrations", () => {
  it("unifies fresh and already-applied normalized tag collisions", async () => {
    const pool = new Pool({ connectionString });
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TEMP TABLE "PersonalTag" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE
        );
        CREATE TEMP TABLE "GameTag" (
          "gameId" TEXT NOT NULL,
          "tagId" TEXT NOT NULL REFERENCES "PersonalTag"("id") ON DELETE CASCADE,
          PRIMARY KEY ("gameId", "tagId")
        );
        CREATE TEMP TABLE "Collection" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "isSystem" BOOLEAN NOT NULL
        );
        CREATE TEMP TABLE "CollectionMembership" (
          "gameId" TEXT NOT NULL,
          "collectionId" TEXT NOT NULL
        );
      `);
      await client.query(
        `INSERT INTO "PersonalTag" ("id", "name") VALUES ($1, $2)`,
        ["tag-000-existing", "Backlog"],
      );
      await client.query(
        `INSERT INTO "Collection" ("id", "name", "isSystem") VALUES ($1, $2, false)`,
        ["collection-backlog", " backlog "],
      );
      await client.query(
        `INSERT INTO "CollectionMembership" ("gameId", "collectionId") VALUES ($1, $2)`,
        ["game-1", "collection-backlog"],
      );

      await client.query(freshMigrationSql);

      const freshTags = await client.query<{ id: string; name: string }>(
        `SELECT "id", "name" FROM "PersonalTag" ORDER BY "id"`,
      );
      const freshMemberships = await client.query<{ gameId: string; tagId: string }>(
        `SELECT "gameId", "tagId" FROM "GameTag" ORDER BY "gameId"`,
      );
      expect(freshTags.rows).toEqual([
        { id: "tag-000-existing", name: "Backlog" },
      ]);
      expect(freshMemberships.rows).toEqual([
        { gameId: "game-1", tagId: "tag-000-existing" },
      ]);

      await client.query(
        `INSERT INTO "PersonalTag" ("id", "name") VALUES ($1, $2)`,
        ["tag-999-duplicate", " BACKLOG "],
      );
      await client.query(
        `INSERT INTO "GameTag" ("gameId", "tagId") VALUES ($1, $2), ($3, $2)`,
        ["game-1", "tag-999-duplicate", "game-2"],
      );

      await client.query(repairMigrationSql);
      await client.query(normalizedNameMigrationSql);

      const repairedTags = await client.query<{ id: string; name: string; normalizedName: string }>(
        `SELECT "id", "name", "normalizedName" FROM "PersonalTag" ORDER BY "id"`,
      );
      const repairedMemberships = await client.query<{ gameId: string; tagId: string }>(
        `SELECT "gameId", "tagId" FROM "GameTag" ORDER BY "gameId", "tagId"`,
      );
      expect(repairedTags.rows).toEqual([
        { id: "tag-000-existing", name: "Backlog", normalizedName: "backlog" },
      ]);
      expect(repairedMemberships.rows).toEqual([
        { gameId: "game-1", tagId: "tag-000-existing" },
        { gameId: "game-2", tagId: "tag-000-existing" },
      ]);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      await pool.end();
    }
  });
});

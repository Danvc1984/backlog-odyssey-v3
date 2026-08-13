import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Migrations run against the direct connection (not the pooler).
  datasource: {
    url: env("DIRECT_URL"),
  },
  // Seed is run through `prisma db seed`.
  migrations: {
    seed: "pnpm tsx prisma/seed.ts",
  },
});
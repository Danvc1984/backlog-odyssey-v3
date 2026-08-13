# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] fixed - AGENTS.md "What this is" still has placeholder text

**File:** AGENTS.md:9
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The project description block was never filled in after `/onboard`. It still reads "A description of your project and the problem it solves." Every agent session reads this file first; a placeholder here wastes context and gives no project grounding.
**Suggested fix:** Replace the placeholder with a 1-2 sentence project description (can be lifted from project-overview.md line 3).
**Resolution:** Replaced with actual project description lifted from project-overview.md.

### F-02 [P3] fixed - Empty `src/lib/auth/` directory committed

**File:** src/lib/auth/
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** Empty directories are noise in git. Likely an artifact of scaffolding that was never cleaned up.
**Suggested fix:** Remove the directory (`rm -r src/lib/auth/`).
**Resolution:** Directory removed.

### F-03 [P2] open - Uncommitted changes to 5 files since last commit

**File:** working tree (AGENTS.md, README.md, .gitignore, blueprint/build-plan.md, blueprint/context/coding-standards.md, blueprint/context/project-overview.md, blueprint/project-plan.md)
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The `/onboard` and `/overview` outputs were never committed. If the working tree is lost, all blueprint tuning is gone.
**Suggested fix:** Review the diff and commit the onboarded state.
**Resolution:**

### F-04 [P2] fixed - `MetadataSnapshot.provider` uses `String` not the `Provider` enum

**File:** prisma/schema.prisma:232
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The schema defines a `Provider` enum (lines 93-101) used by `CompatibilitySnapshot` and `SyncRun`, but `MetadataSnapshot.provider` is a plain `String`. This allows invalid provider values and loses type safety. The PRD's data model (section 15) lists RAWG, Steam, and ITAD as metadata providers, all of which are in the enum.
**Suggested fix:** Change `provider String` to `provider Provider` on MetadataSnapshot.
**Resolution:** Changed to `provider Provider` enum type.

### F-05 [P2] fixed - `SteamConnection` uses `cuid()` but is described as a singleton

**File:** prisma/schema.prisma:167
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The project overview says "SteamConnection (singleton)" and the PRD says "one SteamID64". But unlike `AppSettings` (id=1) and `WallpaperState` (id=1), `SteamConnection` uses `@default(cuid())`. Multiple rows could be created accidentally. There is no `@@unique` constraint preventing duplicates beyond `steamId64`.
**Suggested fix:** Either use `id Int @id @default(1)` to match the singleton pattern, or add application-level guard logic and document why cuid is intentional.
**Resolution:** Changed to `id Int @id @default(1)` to match the singleton pattern used by AppSettings and WallpaperState.

### F-06 [P3] closed - `AppSettings` timezone string does not match PRD

**File:** prisma/schema.prisma:157
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The PRD (section 5.2) says "UTC-6 (Central Time, Mexico)". The schema defaults to `"America/Mexico_City"` which is IANA and correct for date-fns/luxon/Temporal, but the project overview says "UTC-6". This is fine if intentional (IANA handles DST correctly), but worth confirming the choice matches the PRD intent, since Mexico eliminated DST in 2023 and `America/Mexico_City` is now permanently UTC-6.
**Suggested fix:** Confirm IANA is the intended format. No code change needed if so, but note it in the schema comment.
**Resolution:** Confirmed intentional. Added clarifying comment to schema: "IANA; Mexico eliminated DST in 2023, permanently UTC-6".

### F-07 [P3] accepted - Vite config ESM/CJS warning in test runner

**File:** vitest.config.ts
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** Vitest prints a warning: "Your Vite config uses features that are unsupported by `configLoader: 'native'`". The config uses ESM import syntax in a `.ts` file without `"type": "module"` in package.json. This is cosmetic today but will break when Vite makes native the default.
**Suggested fix:** Either rename to `vitest.config.mts` or add `"type": "module"` in package.json (verify no side effects).
**Resolution:** Accepted as-is. The `.mts` rename triggers a rolldown native binding error in the current environment. `"type": "module"` in package.json would need broader verification. The warning is cosmetic; revisit when Vite makes native config loading the default.

### F-08 [P3] fixed - `blueprint/context/ai-interaction.md` boilerplate comment not removed

**File:** blueprint/context/ai-interaction.md:3-6
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The file still has the original Blueprint boilerplate blockquote: "This blueprint is an overlay layer, added on top of an already-scaffolded app. Never run a framework scaffolder..." This is setup guidance that `/onboard` typically removes or replaces. It adds noise to every AI interaction since this file is always in context.
**Suggested fix:** Remove the boilerplate blockquote or replace with a project-specific note.
**Resolution:** Boilerplate blockquote removed.

### F-09 [P2] fixed - `coding-standards.md` references Clerk in example comments

**File:** blueprint/context/coding-standards.md:129
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The testing section says "vi.mock() for external dependencies (Prisma, Clerk, etc.)". This project uses Auth.js, not Clerk. This is leftover from the Blueprint template and could confuse agents.
**Suggested fix:** Replace "Clerk" with "Auth.js" in the example.
**Resolution:** Replaced "Clerk" with "Auth.js".

### F-10 [P2] fixed - No Prisma migrations exist yet

**File:** prisma/migrations/
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The schema is comprehensive (486 lines, 25 models) but no migration has been generated. The app cannot start against a real database until `pnpm prisma:migrate` is run. This is expected for an early-stage project that hasn't connected to a database yet, but should be done before feature 1 implementation begins.
**Suggested fix:** Run `pnpm prisma:migrate` when a database is available, or confirm this will be part of feature 1 setup.
**Resolution:** Initial migration `20260813193002_init` generated and applied to local PostgreSQL (Postgres.app). Database seeded with AppSettings and WallpaperState singletons.

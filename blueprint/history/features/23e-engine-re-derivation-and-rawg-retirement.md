# Feature: Engine re-derivation and RAWG retirement

**From build-plan:** feature 23e
**Build attempt:** 1
**Branch:** `feature/engine-re-derivation-and-rawg-retirement`
**Status:** verified

## Goal

Complete the IGDB provider transition: recommendation and preference evidence must derive from IGDB snapshots, compatibility must queue only after successful IGDB persistence, and RAWG must no longer exist in runtime code, schema enums, environment configuration, attribution, or user-facing provider status.

## In scope

- Re-key recommendation candidate, profile, preference, tune-value, quality, and known genre/tag loading from RAWG payloads to validated IGDB payloads.
- Evaluate IGDB genres, themes, keywords, multiplayer/game modes, attributed ratings with sample counts, release era, publishers, and collection/franchise only where each improves an existing recommendation dimension or visible explanation.
- Preserve current deterministic baseline, privacy boundaries, recommendation event retention, rotation, calibration, compatibility rules, and no-fallback behavior.
- Queue catalog compatibility only after an IGDB snapshot persists successfully; queue failure remains best-effort and cannot fail enrichment.
- Replace RAWG provider freshness/attribution and stale-metadata presentation with IGDB equivalents, including a retry path for stale snapshots.
- Remove RAWG runtime/client, actions, queues, tests, schema enum values and fields, provider records, imports, and environment configuration; create the required Prisma migration.
- Document the clean provider-transition procedure: personal-data export retaining all external IDs, database wipe, empty-schema restore, Steam re-import, and IGDB enrichment.

## Out of scope

- Feature 28 handheld recommendation role and Tune-this-run redesign.
- New recommendation dimensions, scoring weights, providers, automated restore, cron work, or deployment/CI setup.
- Changing the personal-data export's empty-schema restriction or restoring provider snapshots.
- Rewriting historical migration files.

## Build loop

- Work each checked step on `feature/engine-re-derivation-and-rawg-retirement`.
- Present the diff and focused test evidence after every step for review before continuing. Checkpoint commits may be made only after approval and passing required checks.
- The final feature commit and build-plan completion remain `/complete` responsibilities.

## Build steps

- [x] 1. **Define the IGDB recommendation evidence adapter**
  - Replace RAWG payload parsing at recommendation/profile boundaries with a validated IGDB adapter that maps only supported evidence to existing dimensions: genres, themes/keywords as tags, game and multiplayer modes, publisher, release era, collection/franchise, and quality.
  - Use `total_rating` with its count as quality evidence and `aggregated_rating` only as its fallback. Missing, malformed, or low-confidence evidence must reduce confidence or omit that signal, never fabricate a preference or rating.
  - Keep personal tags, game experience, environment, duration, and maturity behavior unchanged unless the existing IGDB payload provides the same supported input.
  - Add focused unit tests for mapping, fallback, malformed/missing payload, and sample-count confidence behavior.
  - **Done when:** play and buy reranking plus profile rebuilding use IGDB evidence without importing `rawg-metadata-payload`, and focused Vitest coverage proves the stated signal rules.

- [x] 2. **Rewire recommendation queries and visible factors**
  - Query only `IGDB` snapshots for catalog and wishlist recommendation inputs and known genre/tag values.
  - Update factor labels, scoring inputs, and quality explanations to identify the applicable IGDB evidence rather than RAWG or Metacritic terminology.
  - Preserve deterministic ordering, existing preference semantics, soft-evidence safeguards, existing duration evidence, and current no-data caveats.
  - Add or update pipeline, rerank, profile, and query tests for catalog and wishlist IGDB inputs, empty evidence, and legacy RAWG rows being ignored.
  - **Done when:** generated recommendation runs and preference controls consume current IGDB evidence, omit retired RAWG evidence, and retain existing behavior when metadata is absent.

- [x] 3. **Finalize IGDB enrichment follow-up and stale states**
  - Confirm the catalog compatibility follow-up runs only after identity and IGDB snapshot persistence succeeds, remains gated by the configured setup, and cannot invalidate a successful enrichment result.
  - Replace stale RAWG snapshot messaging, operation/freshness data, and provider attribution with IGDB naming and data. Provide the existing retry/enrichment action for stale IGDB evidence without overwriting data unless the current overwrite rules permit it.
  - Update focused enrichment, compatibility, operation-view, and UI-state tests for success, failed persistence, inactive compatibility, stale data, and retry behavior.
  - **Done when:** a successful IGDB enrichment is the sole metadata trigger for compatible catalog games, failures never enqueue compatibility, and users see IGDB attribution plus an actionable stale-evidence retry state.

- [x] 4. **Retire RAWG storage and runtime surface**
  - Remove RAWG actions, API/client modules, enrichment jobs/batches/import queue, payload/view helpers, RAWG-only UI paths, tests, and references from live imports.
  - Update Prisma schema and generated-client inputs through a migration to remove retired RAWG-only enum members and fields, including legacy matching/provenance values where no remaining import/export contract requires them. Do not edit prior migrations.
  - Remove retired RAWG environment-variable handling and update affected export validation so it accepts only still-supported persisted identities/provenance.
  - Add migration-safe tests or contract coverage for remaining IGDB/provider paths and run Prisma migration status before review.
  - **Done when:** the application contains no live RAWG provider path or user-facing RAWG status, Prisma schema/client/migration are aligned, and all remaining provider flows use IGDB or their documented non-metadata provider.

- [x] 5. **Document and verify the clean restart**
  - Add a concise operator-facing clean-restart guide in the repository documentation: export personal data, wipe the database, restore only to an empty schema, re-link/re-import Steam, then manually run IGDB enrichment. State that provider snapshots, credentials, prices, compatibility, and activity rebuild rather than restore.
  - Run `pnpm typecheck`, `pnpm test`, and `pnpm build`; record real results and any environment-bound limitation.
  - **Done when:** the documented sequence preserves personal records and external IDs without claiming provider snapshots restore, and the required automated checks pass.

## Files / areas

- `src/lib/recommendations/` - profile dimensions, reranking, run pipeline, queries, factor presentation, and focused tests.
- `src/actions/recommendations.ts` - remove RAWG payload dependency from recommendation actions.
- `src/lib/igdb-job-runner.ts`, `src/lib/compat-queue.ts`, and compatibility tests - successful-IGDB follow-up boundary.
- `src/lib/today-operations.ts` and provider/metadata UI consumers - IGDB freshness, attribution, stale retry presentation.
- `src/lib/rawg-*`, `src/actions/rawg-*`, and their tests - retirement targets after callers move.
- `prisma/schema.prisma`, a new `prisma/migrations/*/migration.sql`, generated Prisma artifacts as required by repository convention, and export schema/tests - retired storage contracts.
- Repository documentation - clean-restart procedure.

## Data / contracts

- `MetadataSnapshot.provider` is `IGDB` for all active metadata reads. A valid recommendation payload must pass `parseIgdbMetadataPayload`; malformed or absent data contributes no provider signal.
- Quality uses IGDB `ratings.total` with a sample count, falling back to `ratings.aggregated`; it must remain attributed and confidence-aware.
- Compatibility queueing occurs only after `persistIgdbSnapshot` succeeds. Queueing is best-effort and setup-gated.
- Export/import continues to preserve personal data and all external IDs, but never provider snapshots, credentials, prices, compatibility evidence, operation history, or activity cache.
- Existing RAWG data is intentionally discarded during the documented clean restart rather than migrated or interpreted as IGDB evidence.

## Testing

- Add Vitest coverage beside recommendation, profile, query, enrichment/compatibility, provider-view, and export contract code that changes.
- Run focused tests during each logic step.
- Final gate: `pnpm typecheck`, `pnpm test`, and `pnpm build`. No combined Verify command is currently configured and no browser-test command exists.

## Notes for the AI

- Keep all server actions authenticated with `requireUser`; do not trust client-supplied identity.
- Use Zod or existing validated parser boundaries for persisted unknown JSON. Do not use `any`.
- Do not alter historic Prisma migrations. Create a forward migration with `pnpm prisma:migrate` when schema changes are made.
- Preserve `{ success, data, error }` action results and user-friendly failures.
- This is one planned feature by explicit user direction. Keep individual implementation steps small and reviewable; do not split or renumber `build-plan.md`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9444,"specSha256":"262d2c5af1fdc54732f318a40358bb30cdaf02027e534e56096ef881b281cd98","branch":"refs/heads/feature/engine-re-derivation-and-rawg-retirement","head":"ba2582845e5af3bb916594bb3e77179c8bf41bb0","baseRef":"refs/heads/main","baseCommit":"a90e97ef4b05ced7029637641bca4e30317f75a9","sourceTree":"5471ea546c0a56454246b34345a7312baee858c1","absentOptional":[]} -->

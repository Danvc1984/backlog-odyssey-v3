# Feature: Unified personal tags and collection shelves

**From build-plan:** feature 32
**Build attempt:** 1
**Branch:** feature/unified-personal-tags-and-collection-shelves
**Status:** verified

## Goal

Make personal tags the sole owner-managed grouping model. Every tag, including a tag with no games, becomes a browsable Collections shelf; tag administration is centralized without weakening Game Detail's quick assignment flow, Library filtering, or the distinct read-only system and IGDB shelves. Personal tags also become an optional, explainable Tune signal whose selections survive active-state and preset workflows while historical recommendation runs remain immutable.

## In scope

- Keep `PersonalTag` plus `GameTag` as the only manual grouping model and remove remaining legacy `Collection`/membership contracts from the current schema, export, restore, and UI.
- Preserve display capitalization while enforcing trimmed, case-insensitive tag identity atomically.
- Support empty-tag creation, rename, explicit merge into an existing normalized name, and confirmed deletion from a `Manage tags` dialog on the Collections page.
- Show game counts in tag management and retain Game Detail create-or-reuse, assignment, and removal.
- Make merge union and deduplicate memberships, retarget current Tune state and named presets to the survivor, and delete the absorbed tag in one transaction.
- Make deletion remove memberships plus current Tune-state and named-preset references in one transaction.
- Never rewrite historical `RecommendationRun.context` tag names on rename, merge, or deletion.
- Keep every tag as a browsable shelf, support alphabetical and game-count shelf ordering, and default to alphabetical.
- Preserve Library personal-tag filtering and keep calculated system shelves plus IGDB series/franchise shelves read-only and visually distinct.
- Add personal tags under Tune's `More filters`, visually separate from IGDB genres/themes/keywords, with no tags selected by default.
- Treat multiple selected personal tags as an any-match signal with one soft capped bonus; matching additional selected tags must not stack points.
- Carry personal tags through tab-local current Tune state, named presets, generated run context, explanations, reset, export/restore, and focused tests.

## Out of scope

- User-authored manual collections or custom collection colors/icons.
- Editing calculated system shelves or IGDB series/franchise shelves.
- Changing IGDB metadata tags, genres, themes, keywords, or recommendation-profile learning.
- Migrating a deployed database or accepting legacy exports; this project will use the planned clean database rebuild and the current strict export-version contract.
- Multi-user sharing, permissions, or tenant administration.
- Changes to recommendation roles, base ranking, Library filters other than preserving existing tag behavior, or later deployment/CI work.

## Build loop

- Implement one checked step at a time and keep the app working after each step.
- Run the focused Vitest files named by the step, then `pnpm typecheck`; run `pnpm build` where route or server/client composition changes.
- Present each completed step for review before continuing.
- Do not create checkpoint commits unless the user explicitly requests them. `/complete` creates the final feature commit.
- The repository has no declared `verify` script, so final verification uses the documented typecheck, test, and build commands directly.

## Build steps

- [x] 1. Finalize the tag-only data and serialization contracts.
  - Add one persisted normalized tag-name key derived from the trimmed display name using the repository's existing locale-lowercase normalization, with a database uniqueness constraint; retain the user's trimmed capitalization in `name`.
  - Keep `GameTag` unique by `(gameId, tagId)` and cascading from deleted tags.
  - Remove remaining legacy manual `Collection` and collection-membership shapes and compatibility conversion from the current export/restore contract. Increment the strict export schema version so older documents are rejected rather than migrated, and keep tags plus memberships restorable in dependency order.
  - Use Prisma schema/migrations and the planned clean rebuild; do not use `db push` or add runtime migration of deployed data.
  - **Done when:** Prisma models and the strict export document expose only tag-based manual grouping, duplicate normalized names cannot be persisted, old-version/legacy-collection documents are rejected, and focused schema/export/restore/migration tests plus `pnpm typecheck` pass.

- [x] 2. Build authenticated, atomic tag lifecycle actions and preserve Game Detail behavior.
  - Centralize validation and normalization for create-or-reuse, rename, merge, delete, assignment, and removal so every write uses the same identity rule.
  - Require the authenticated app owner from the server session before lookup or mutation; this single-owner repository has no client-supplied owner or tenant identifier.
  - Return the repository-standard `{ success, data, error }` shape with stable invalid, missing, conflict/merge-required, and unexpected-error outcomes.
  - A non-conflicting rename keeps the tag ID and memberships. Renaming to an existing normalized name must not mutate until an explicit merge confirmation is submitted.
  - In one Prisma transaction, merge memberships into the existing surviving tag without duplicates, replace absorbed display-name references in `RecommendationTuneState` and every `RecommendationPreset.tune`, and remove the absorbed tag. Deletion removes the tag/memberships and removes its references from current Tune state and named presets in the same transaction.
  - Do not update `RecommendationRun.context`; its recorded tag names are historical evidence.
  - Keep Game Detail's quick create-or-reuse, assignment, and removal reachable and case-insensitive under the new contract.
  - **Done when:** action tests prove auth gating, validation, capitalization, case-insensitive create/reuse, atomic uniqueness, rename, explicit merge, membership union/deduplication, active Tune/preset rewrites, deletion cleanup, historical-run immutability, not-found/conflict errors, and friendly unexpected failures; focused tests and `pnpm typecheck` pass.

- [x] 3. Add centralized tag management and shelf ordering on Collections.
  - Add `Manage tags` to the Tag shelves section and a dialog that lists every tag with its game count, including zero-game tags.
  - Support create, rename, merge confirmation, and delete confirmation without navigating to a tag shelf. Disable duplicate submissions, show pending labels, keep the dialog's displayed data current after success, and surface action errors without closing the dialog.
  - For invalid or conflicting names, associate feedback with the name control, announce it, and move focus to the relevant control or confirmation. Render names as React text only.
  - Provide alphabetical and game-count shelf ordering, defaulting to alphabetical; define game-count ties alphabetically for a stable result. The page's no-tags state must still expose `Manage tags` so the first empty shelf can be created.
  - Keep tag shelves browsable at `/collections/[id]`; show a clear empty shelf state for zero memberships. Keep calculated and IGDB shelves read-only and visually separate, and preserve existing Library personal-tag filtering.
  - Replace the detail-page-only deletion entry point with the centralized management flow without leaving an unreachable component or action.
  - **Done when:** `/collections` visibly handles loading/pending, no-tags, empty-tag, populated, invalid, merge-confirmation, delete-confirmation, denied/action-error, and unexpected-error behavior; sort controls produce stable alphabetical/count order; tag shelf navigation and Library filtering still work; focused component/action tests, `pnpm typecheck`, and `pnpm build` pass.

- [x] 4. Complete personal-tag Tune behavior across UI, ranking, context, and persistence.
  - Load available personal tags into Tune's `More filters` for both recommendation tabs and visually label them separately from IGDB-derived genres/themes/keywords. Start with no personal tags selected unless restored from that tab's current Tune state or an explicitly loaded preset.
  - Persist selections in the existing tab-local `RecommendationTuneState` and `RecommendationPreset.tune` contracts; reset clears them with the other Tune criteria.
  - Populate candidate personal-tag evidence from `GameTag`, record selected display names in newly generated `RecommendationRun.context`, and retain those names as immutable historical snapshots.
  - Match selected tags with any-match semantics and award one soft bonus capped at the personal-tag criterion's contribution; two or more matching selected tags must not add more than one match. Produce one understandable personal-tag explanation and avoid duplicate factor labels.
  - Gracefully ignore stale tag names found only in historical run context; current state and presets should have been repaired by lifecycle transactions.
  - **Done when:** UI and recommendation tests prove inactive-by-default behavior, visual/semantic separation, tab-local current state, preset save/load, reset, any-match non-stacking scoring, candidate loading, current run context, one explanation, merge/delete repair, and immutable historical context; focused tests and `pnpm typecheck` pass.

- [x] 5. Close integration gaps and run the feature gates.
  - Update export-data, strict schema documentation, empty-schema restore checks/counts, seeds/fixtures, and generated Prisma client artifacts for the final tag-only model and Tune payload.
  - Remove dead collection compatibility code, obsolete components/imports, and stale copy while preserving calculated and IGDB collection routes.
  - Verify migration state with `pnpm prisma:migrate` only when a configured development database is available; otherwise record that database prerequisite for `/check` rather than claiming migration evidence.
  - **Done when:** `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; no current runtime/export/restore reference treats manual `Collection` as an owner-managed model; and the running-app checks remaining for `/check` are explicitly identified.

- [x] 6. Resolve independent-review findings.
  - Remove the tag manager's lint-invalid synchronous effect state synchronization without weakening post-action UI updates.
  - Preserve the personal-tag Tune explanation and its separate capped contribution when combined criteria reach the overall Tune score cap.
  - Add regression coverage for combined personal-tag and regular-criteria explanations, then rerun lint, focused tests, typecheck, and build.
  - **Done when:** F-01 and F-02 are repaired, their focused tests and all declared quality gates pass, and the findings ledger records both as fixed pending independent re-review.

- [x] 7. Resolve the second independent-review findings.
  - Remove the absorbed tag from the manager immediately after a successful merge and refresh the surviving row's exact count.
  - Move focus to the conflicting tag name control when merge confirmation is required.
  - Add or update focused action coverage for the merge result count, then rerun lint-relevant tests, typecheck, and build.
  - **Done when:** F-03 and F-04 are repaired, their focused tests and all declared quality gates pass, and the findings ledger records both as fixed pending independent re-review.

- [x] 8. Resolve the Tune cache invalidation finding.
  - Invalidate the shared known personal-tag values cache after Game Detail creates or reuses a tag so Tune options reflect the quick-assignment flow immediately.
  - Add focused action coverage for cache invalidation without changing authenticated or idempotent tag behavior.
  - **Done when:** F-05 is repaired, focused tests plus typecheck/build pass, and the findings ledger records it as fixed pending independent re-review.

## Files / areas

- `prisma/schema.prisma`, a feature migration under `prisma/migrations/`, `prisma/seed.ts`, and generated Prisma artifacts.
- `src/actions/personal-tags.ts`, `src/actions/personal-tags.test.ts`, and the tag operations in `src/actions/game-detail.ts` / `src/actions/game-detail.test.ts`.
- `src/lib/system-collections.ts`, `src/lib/system-collections.test.ts`, `src/app/(app)/collections/page.tsx`, and `src/app/(app)/collections/[id]/page.tsx`.
- `src/components/games/TagsSection.tsx`, `LibraryFilters.tsx`, `PersonalTagDeleteDialog.tsx`, and new or replacement tag-management UI colocated with the Collections surface.
- `src/components/recommendations/TuneThisRunPanel.tsx`; `src/lib/recommendations/types.ts`, `tune.ts`, `pipeline-helpers.ts`, run/preset actions and queries, with their focused tests.
- `src/lib/export-schema.ts`, `export-data.ts`, `import-restore.ts`, their schema-document tests, and `src/app/api/export/route.ts` / `src/app/api/import/route.ts` only where the contract wiring requires it.

## Data / contracts

- `PersonalTag` owns an immutable ID, a trimmed display `name`, and a persisted unique normalized key. The key is derived by the shared server helper as trimmed locale-lowercase text; empty-after-trim names are invalid.
- `GameTag(gameId, tagId)` is the many-to-many membership and remains composite-unique. A game may have many tags and a tag may have zero games.
- Create-or-reuse returns the existing tag for the normalized key without changing its displayed capitalization. Rename preserves the tag ID unless the user confirms merge into an already-existing normalized key.
- The existing tag is the survivor when a rename target already exists. Merge unions memberships, rewrites active Tune and named-preset references to the survivor's displayed name, deduplicates those arrays, then deletes the absorbed tag atomically.
- Delete removes the tag, cascading memberships, and removes matching references from both current tab Tune states and named presets atomically. It does not delete games.
- `RecommendationRun.context` is append-only historical JSON for this feature. New runs record selected personal-tag display names; lifecycle changes never rewrite prior values.
- A selected personal-tag set is optional and empty by default. Candidate matching is case-insensitive through canonical current tag identity, uses any-match semantics, and yields at most one personal-tag scoring contribution and one explanation regardless of match count.
- The export document remains a strict, versioned full snapshot. Its next version contains `tags` and `gameTags`, contains no manual `collections` or `collectionMemberships`, and retains current Tune state, presets, and historical recommendation contexts. Prior versions are rejected.
- All mutations are authenticated server actions. Tag names are validated server-side, rendered as text rather than HTML, and action errors use the existing friendly result shape without exposing internals.

## Testing

- Extend action tests for create/reuse, assign/remove, rename, conflict, confirmed merge, deletion, authorization, transaction boundaries, preset/current-state rewrites, historical context preservation, and friendly failures.
- Extend system-collection and UI tests for zero-count shelves, stable sort modes/ties, management empty state, pending/disabled controls, accessible validation, confirmations, and error retention.
- Extend Tune, pipeline, recommendation action/query, and type tests for candidate tag loading, inactive defaults, tab isolation, presets, reset, current context, any-match capped scoring, and explanation output.
- Update export schema/data/documentation and restore tests for the new strict version, absence of legacy collection fields, tag dependency order, Tune/preset references, rejection of old documents, and empty-schema safeguards.
- Run focused Vitest files after each step, then final `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- `/check` must exercise create/rename/merge/delete (including an empty tag), both shelf orders, an empty shelf, Game Detail assignment, Library filtering, Tune/preset/reset behavior, and export plus empty-database restore in the running app.

## Notes for the AI

- The repository is partially prepared: tags already generate shelves, legacy collection tables are absent from the current Prisma schema, personal-tag Tune fields exist, and export currently emits empty legacy collection arrays. Treat that as current reality to finish and tighten, not proof that this feature is complete.
- Preserve the distinction between personal tags and IGDB metadata `tags`; do not overload the existing Tune `tags` field or edit provider evidence.
- Use Prisma transactions for merge/delete plus JSON Tune/preset repair, and rely on a database unique constraint rather than check-then-write for normalized identity.
- Reuse existing dialog, toast, button, and form primitives and the app's Dawn/Sunset semantic tokens. Do not add inline styles.
- Do not start a dev server during implementation planning or claim live, migration, visual, export/restore, or integration evidence until it is actually observed.
- Migration runtime verification was not run during implementation; `/check` must use a configured development database before claiming `pnpm prisma:migrate` evidence.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":17383,"specSha256":"69a7d4242fc807f6fb75a148ac4919945c5cc456ac2f059c67a98357743b836f","branch":"refs/heads/feature/unified-personal-tags-and-collection-shelves","head":"fdef3fa07d34706d1da40e540205dba0e2faba10","baseRef":"refs/heads/main","baseCommit":"e4a618c8e6d6c19561ab490d5643e4f22e588452","sourceTree":"b6d9554af8bedb580acc507209f03ee733ec9c2e","absentOptional":[]} -->

## Findings

### 32/F-01 [P2] closed - Tag manager state synchronization

**Found:** 2026-09-21 by /audit (quality). **Resolution:** the manager has no prop-to-state synchronization effect; its local rows update after successful actions. Re-examined and closed by the independent review.

### 32/F-02 [P1] closed - Personal-tag explanation at score cap

**Found:** 2026-09-21 by /audit (quality, tests). **Resolution:** personal-tag contribution remains separate from the capped regular Tune contribution; combined-criteria regression coverage passed.

### 32/F-03 [P1] closed - Absorbed tag remained visible after merge

**Found:** 2026-09-21 by /audit (quality, tests). **Resolution:** merge success removes the absorbed row, refreshes the survivor's count, and removes its draft.

### 32/F-04 [P2] closed - Merge conflict focus

**Found:** 2026-09-21 by /audit (quality, tests). **Resolution:** the conflict path uses shared action-error focus handling and moves focus to the invalid name input.

### 32/F-05 [P2] closed - Quick tag creation left Tune options stale

**Found:** 2026-09-21 by /audit (quality, performance, tests). **Resolution:** Game Detail tag upsert invalidates the shared known-values cache; focused action coverage passed.

## Independent review

**Target commit:** `fdef3fa07d34706d1da40e540205dba0e2faba10`
**Base commit/ref:** `e4a618c8e6d6c19561ab490d5643e4f22e588452` / `main`
**Spec hash:** `69a7d4242fc807f6fb75a148ac4919945c5cc456ac2f059c67a98357743b836f`
**Builder:** codex / `gpt-5.6-luna`
**Requested reviewer:** codex / `gpt-5.6-luna` / automatic
**Actual reviewer:** codex / `gpt-5.6-luna` / automatic / fresh subagent
**Reviewed:** 2026-09-21T19:36:13Z
**Check:** passed

The fresh review covered quality, security, performance, and tests for the complete feature delta. `pnpm typecheck`, `pnpm test` (131 files, 1269 tests), `pnpm build`, and `git diff --check` passed. User-confirmed manual acceptance covered tag lifecycle, shelf ordering, empty shelves, Game Detail assignment, Library filtering, Tune controls, export, empty-schema reset, and restore. No new findings were raised.

Remaining risk: `pnpm lint` has three unchanged base-commit violations in `src/actions/recommendations.test.ts` and `src/components/recommendations/RecommendationSpotlightCarousel.tsx`, outside this feature delta.

## How to try it

Open **Collections** and use **Manage tags** to create an empty tag, rename it, confirm a merge, and delete it. Assign a tag on a Game Detail page, filter Library by that shelf, and open **Today → Tune this run → More filters** to select personal tags separately from IGDB tags.

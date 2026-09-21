# Feature: Personal-data and availability simplification

**From build-plan:** feature 31
**Build attempt:** 1
**Branch:** feature/personal-data-and-availability-simplification
**Status:** verified

## Goal

Finish the personal-data and availability cleanup without changing catalog/wishlist boundaries or recommendation semantics. Personal data should be compact and understandable, reusable platform names should have one Settings-owned definition, and the current export/import contract should contain only the fields the rebuilt database accepts.

## In scope

- Keep catalog and wishlist records free of notes and keep `GameAvailability` free of a per-game display label. The existing migration and Prisma model already reflect this; no second migration or compatibility column is needed.
- Keep `AlternativeSource` definitions, including create, rename, archive, restore, and removal, exclusively in Settings. Game creation, Game Detail, wishlist acquisition, and recommendation controls may select or remove saved sources, but may not create, rename, archive, or delete source definitions or retain an unfinished source draft.
- Require new `OTHER_PLATFORM` assignments and acquisitions to identify a saved active `AlternativeSource`. Existing assigned archived sources remain visible with an `Archived` marker and may be preserved or removed, but cannot be selected again after removal. Use the reusable source's canonical `name` everywhere a platform is displayed or included in recommendation context.
- Keep `Change platform` on Game Detail only. Do not add platform administration or a platform-change action to Library cards. Preserve the existing Library-card Delete action, destructive confirmation, and Undo behavior.
- Merge the Game Detail Play state and Personal Profile surfaces into one compact personal-data section with the two visual groups:
  - **Journey:** current play state, previously completed, main game, play soon, replay, and hidden.
  - **Preferences:** interest, rating, priority, game experience, preferred environment, and handheld suitability.
- Preserve the current four play states, independent completion-history behavior, main-game constraint, authenticated server actions, and existing save/error feedback. The combined surface must still show the not-in-library empty state.
- Replace permanent personal-field helper paragraphs on Game Detail and Wishlist Detail with accessible information popovers that work through pointer, keyboard, and touch, with an associated label and a clear close/focus behavior.
- Group wishlist interest, game experience, and handheld suitability under a Wishlist Detail **Personal fit** surface. Keep target price, identity, offers, acquisition, and seller/provider information in the purchase area.
- Make the current export/import schema authoritative directly: removed notes and availability display labels are neither emitted nor restored, and documents carrying removed fields or legacy shapes are rejected rather than normalized. Preserve the current versioned schema and unrelated personal-tag/recommendation export behavior owned by existing work.
- Sweep recommendation inputs, acquisition transfer, forms, details, and export/import so no removed field or ad hoc platform label remains. Recommendation source explanations continue to use the saved source canonical name.

## Out of scope

- New play-history persistence, changes to current-state or prior-completion rules, recommendation roles, dismissal behavior, or scoring beyond removing obsolete personal/source inputs.
- Personal-tag management, tag shelf ordering, collection-model cleanup, or tag targeting from feature 32. Preserve the repository's current tag/export behavior while changing only this feature's removed fields and source contract.
- New providers, compatibility evidence, pricing rules, Steam identity behavior, deployment, cron, CI, or a browser-test harness.
- Backward-compatible import of old notes, per-game display labels, legacy play-state aliases, or other retired export shapes. There is no migration or restore bridge for those contracts.
- Library-card platform controls or deletion redesign.

## Build loop

Implement one small step at a time on `feature/personal-data-and-availability-simplification`. Review the diff and run the focused Vitest coverage after each logic-bearing step. Use `pnpm typecheck` and `pnpm test` as applicable; no project-wide Verify command is declared yet, and feature 33 owns consolidating one. No browser-test command is configured, so UI claims require the build/typecheck gates and later owner manual review. Follow the repository's configured step-review/checkpoint policy when it is available. `/complete` owns the final feature commit and archive.

## Build steps

- [x] **1. Freeze the personal and source contracts at the server boundary.** Confirm the existing notes/display-label removal in `prisma/schema.prisma` and `prisma/migrations/20260916120000_remove_notes_and_availability_labels/migration.sql` without adding another migration. Remove any remaining obsolete action inputs, query selections, generated payload assumptions, or unreachable row-editor path. Make source mutations validate authenticated ownership through `requireUser`, reject missing/unknown/archived alternative sources for new assignments, and stop acquisition or game flows from auto-creating an unspecified source outside Settings. Preserve `{ success, data, error }` results and atomic acquisition/state writes. Add focused action tests for invalid source IDs, archived sources, duplicate assignments, and successful active-source assignment.
  - **Done when:** no current action can persist a new `OTHER_PLATFORM` row without a saved active source or accept notes/display labels, Settings remains the only source-definition mutation surface, and the affected game/source/acquisition tests pass with `pnpm test -- src/actions/game-detail.test.ts src/actions/games.test.ts src/actions/sources.test.ts src/actions/wishlist-acquisition.test.ts`.

- [x] **2. Complete availability, acquisition, and canonical-source UI behavior.** Update Game Detail availability controls, manual game creation, and wishlist acquisition to select only Steam, ROM where applicable, or saved active alternative sources. Link users to Settings when a required source is absent; do not retain a draft while they leave the flow. Show assigned archived sources with their canonical name and an `Archived` marker, allow removal, and keep them unavailable for re-selection. Ensure library cards retain only their existing Edit, state, and Delete/Undo actions, while Game Detail remains the only platform-change location. Update source presentation and recommendation-facing source labels to use the saved canonical name, including loading, empty, denied, invalid, and action-error feedback.
  - **Done when:** a newly created/acquired game can only receive a selected active reusable source, an archived assigned source is visible but cannot be newly checked, removing it removes the option, Settings links are reachable, and typecheck plus focused UI/action tests pass.

- [x] **3. Consolidate Game Detail personal data into Journey and Preferences.** Replace the separate `Play state` and `Personal Profile` cards with one compact personal-data section. Move handheld suitability into Preferences, retain every existing journey toggle and current four-state behavior, preserve main-game and replay semantics, and keep not-in-library, saving, invalid, denied, and failed-save feedback observable. Add the reusable accessible information-popover pattern and apply it to the personal-field help text instead of permanent helper paragraphs. Keep labels associated with controls and make pointer, keyboard, and touch activation usable without changing server-action contracts.
  - **Done when:** Game Detail visibly exposes exactly the Journey and Preferences groups in one section, all listed values still save and reload through the existing actions, helper text is available through an accessible popover rather than a permanent paragraph, and `pnpm typecheck` plus the affected game-detail tests pass.

- [x] **4. Add the Wishlist Detail Personal fit surface and preserve the purchase boundary.** Refactor Wishlist Detail and its edit controls so interest, game experience, and handheld suitability are presented as Personal fit with the same accessible help treatment. Keep target price, confirmed identity, offers, acquisition, and seller/provider information in the purchase area; preserve base-game/DLC validation, acquisition source selection, parent play-state controls, and all current empty, loading, invalid, denied, and error feedback. Use canonical alternative-source names in acquisition confirmation and do not introduce source administration in the wishlist flow.
  - **Done when:** Wishlist Detail and its edit/acquisition dialogs expose Personal fit separately from purchase information, active/archived source rules remain enforced, and wishlist/detail/acquisition tests plus `pnpm typecheck` pass.

- [x] **5. Make export/import and recommendation boundaries reject the retired contract, then run the repository sweep.** Keep the current direct export version and schema fields that are already present, but make the relevant Zod objects reject unknown removed fields instead of stripping them, and ensure restore cannot receive notes or per-game display labels through any path. Verify exported catalog, wishlist, availability, source, recommendation, and acquisition data contains canonical source identity and no removed fields. Sweep recommendation pipeline inputs, retained explanations, catalog transfer, import fixtures, and tests for obsolete fields or free-text source labels while preserving tag and recommendation data outside this feature.
  - **Done when:** export output contains no notes/display labels, current documents restore successfully, documents with retired fields or legacy shapes fail clearly before mutation, recommendation/acquisition tests use canonical source names, and both `pnpm typecheck` and `pnpm test` pass.

## Files / areas

- `prisma/schema.prisma` and `prisma/migrations/20260916120000_remove_notes_and_availability_labels/migration.sql`: existing authoritative removal of notes and per-game availability labels; no replacement fields.
- `src/actions/game-detail.ts`, `src/actions/games.ts`, `src/actions/wishlist.ts`, and `src/actions/sources.ts`: authenticated validation, active/archived source rules, acquisition transfer, and source-definition boundaries.
- `src/lib/sources/store.ts`, `src/lib/sources/known-sources.ts`, `src/lib/recommendations/run-pipeline.ts`, `src/lib/recommendations/tune.ts`, and related tests: canonical source identity and removal of implicit unspecified-source creation or labels.
- `src/components/games/AvailabilityEditor.tsx`, `src/components/games/AvailabilityRowForm.tsx`, `src/components/games/CreateGameDialog.tsx`, `src/components/games/GameDetailHero.tsx`, `src/components/games/LibraryGameCard.tsx`, and `src/components/sources/AlternativeSourcesCard.tsx`: source selection, archived presentation, Settings-only administration, and Library action boundaries.
- `src/app/(app)/games/[id]/page.tsx`, `src/components/games/PlayStateSection.tsx`, `src/components/games/PersonalFieldsForm.tsx`, and the new or existing shared popover UI area: consolidated Journey/Preferences composition and accessible help.
- `src/app/(app)/wishlist/[id]/page.tsx`, `src/components/wishlist/WishlistDetailHero.tsx`, `src/components/wishlist/EditWishlistDialog.tsx`, `src/components/wishlist/WishlistEntryActions.tsx`, and `src/components/wishlist/AcquireWishlistDialog.tsx`: Personal fit, purchase grouping, and acquisition source presentation.
- `src/lib/export-data.ts`, `src/lib/export-schema.ts`, `src/lib/import-restore.ts`, `src/app/api/export/route.ts`, `src/app/api/import/route.ts`, and their tests: direct current-schema export, strict rejection, and all-or-nothing restore.

## Data / contracts

- `LibraryEntry` has no `notes`; `WishlistEntry` has no `notes`; `GameAvailability` has no `displayName`. These fields are not recreated, accepted, exported, or restored.
- A new `OTHER_PLATFORM` availability or acquisition identifies one `AlternativeSource` by ID. The source must exist and have `archivedAt = null`. Steam and ROM retain their existing built-in source kinds; source definitions remain reusable and owner-scoped by the existing single-user authenticated boundary.
- An already assigned archived source remains readable and removable. It is displayed with its saved canonical `AlternativeSource.name`; after removal it cannot be selected until restored in Settings.
- Server actions continue to call `requireUser`, validate with Zod, avoid client-supplied identity, and return the existing `{ success, data, error }` shape. Related source/acquisition/state writes remain transactionally atomic.
- The existing direct export version is authoritative. Export/import includes only the current schema's fields, including source IDs and canonical source records, and rejects retired fields or legacy documents before any restore mutation. Provider snapshots and credentials retain their existing exclusion rules.
- Personal controls retain the current enum/value ranges: play state `NOT_STARTED | IN_PROGRESS | COMPLETED | ABANDONED`, interest `1..5`, rating `1..10`, priority `NONE | LOW | MEDIUM | HIGH`, existing experience/environment enums, and nullable handheld suitability. No new persisted personal field is introduced.

## Testing

- Extend existing Vitest suites next to the affected actions and pure helpers: source validation and archive behavior, game availability, manual creation, wishlist acquisition, canonical source presentation, export schema strictness, and import refusal/transaction behavior.
- Cover happy, empty, invalid, missing-source, archived-source, duplicate, unauthenticated/denied, and unexpected-error paths applicable to each server flow. Include export assertions that removed keys are absent and restore assertions that retired keys are rejected before writes.
- UI composition is verified through typecheck/build and owner manual review because no browser-test command is configured. Do not claim live visual, browser, or persisted-database evidence in this planning spec.

## Notes for the AI

- The repository already contains the notes/display-label migration and much of the Settings-only source-selection work from prior audit repair. Treat that as current evidence, not as proof that the full feature is complete: the Game Detail sections are still separate, helper paragraphs are still permanent, archived assignments lack the required visible marker, and acquisition paths can still create/use an unspecified source.
- Preserve the existing `AlternativeSource` canonical names, icon metadata, archive behavior, recommendation source tune, and Library Delete/Undo flow. Do not add per-game labels back under another name.
- `EXPORT_VERSION` is already the current direct schema version after prior cleanup. Do not add legacy normalization or a second compatibility layer; tighten the current schema and tests instead. Preserve unrelated collection/tag keys until their owning planned work is explicitly addressed.
- Do not start a dev server during implementation or planning. No project-wide Verify command is declared; use the package scripts named in the build loop.
- No material product question remains in the packet. Prefer small shared UI/action helpers and existing Prisma transaction patterns over a new data model or route.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":15641,"specSha256":"bb62b48863756ce31015d2881c1d32d3516349b668b7caeaf577523a732eac26","branch":"refs/heads/feature/personal-data-and-availability-simplification","head":"cf10ce05adae6cf6187a226f7c3782e1b0b840cc","baseRef":"refs/heads/main","baseCommit":"cf10ce05adae6cf6187a226f7c3782e1b0b840cc","sourceTree":"da48051dda53a0279ed3d223bf78e79b69aa1241","absentOptional":[]} -->

## Manual try guide

### Start

Run pnpm dev from the project root and open the local app at http://localhost:3500.

### Open and do

1. Open /settings. Create, archive, restore, and remove an alternative source; confirm source definitions are administered there.
2. Open a Game Detail page at /games/[id]. Confirm Preferences no longer includes Preferred environment. Review the compact Journey and Preferences layout, information popovers, and saved personal fields.
3. Open a Wishlist Detail page at /wishlist/[id]. Confirm the hero places Acquire, Compare offers, and Edit together. Confirm Personal fit contains interest, game experience, handheld suitability, and identity, but not Acquire or Edit.
4. Confirm Offers remains separate and still shows identity-required/offer states correctly.
5. On an empty or disposable data set, export and verify the JSON contains no retired notes or per-game availability display labels. Do not intentionally import a rejected document into populated data.

### Expect

- Saved active alternative sources can be selected; archived assignments remain marked and cannot be newly selected.
- Personal-field help opens accessibly from its info controls.
- Hero Edit opens the existing wishlist edit dialog, and Acquire opens the acquisition flow.
- No console or network errors occur during these flows.

### Watch For

- Preferred environment still visible on Game Detail.
- Acquire or Edit still rendered inside Personal fit.
- Identity/actions duplicated in a separate card.
- Archived source available for new selection, or retired fields emitted by export.

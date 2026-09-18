# Feature: Current play state and prior-completion history

**From build-plan:** feature 30
**Build attempt:** 1
**Branch:** feature/current-play-state-and-prior-completion-history
**Status:** verified

## Goal

Make current play state and prior completion independent, consistent across every state-changing flow, and visible in recommendations, progress, shelves, and personal-data export. A replay can be in progress while remaining visibly previously completed, without counting twice or losing completion evidence.

## In scope

- Keep the four current states `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, and `ABANDONED`; retain `LibraryEntry.completedBefore` as an independent user-editable flag.
- Apply one atomic transition rule everywhere a library entry changes state:
  - Any transition away from `COMPLETED` sets `completedBefore = true`.
  - A transition from `COMPLETED` to `IN_PROGRESS` clears `replayCandidate`, consuming replay when the game is started.
  - The same replay-consumption behavior applies to `Start playing` from a recommendation and to DLC acquisition when it moves the parent into progress. If a request tries to set a replay flag and start the game at once, the automatic consumption rule wins.
  - Clearing `completedBefore` remains an explicit correction the user can make later; it must not alter `playState`.
- Make Taste Setup's played answer set only `completedBefore = true`, regardless of the current state, without inferring or changing `playState`.
- Preserve the existing DLC acquisition controls (`No change`, `Not started`, `In progress`, `Plan to play`) and its separate `Mark parent as replay candidate` option while applying the same history and replay rules to the parent update.
- Consolidate current completion and prior completion into one positive recommendation-learning signal per game, while retaining a prior-completion signal alongside a current abandonment signal as distinct positive and negative evidence. Preserve existing event weights and decay unless this deduplication requires a focused helper.
- Use current state only for active-backlog progress: `COMPLETED` is the completed numerator, `NOT_STARTED` and `IN_PROGRESS` are active backlog, and `ABANDONED` is excluded. A prior-only flag must not increase progress or the denominator.
- Rename the calculated `Completed` shelf to `Previously completed` and query `playState = COMPLETED OR completedBefore = true`. It must overlap intentionally with `In progress` and `Backlog`; a completed replay candidate remains eligible for Play Next.
- Update state controls, start flows, recommendation eligibility and affinity, event/profile derivation, Taste Setup, shelves, counts, acquisition behavior, catalog merge preservation, export/import, and focused tests without adding a legacy state migration or compatibility alias.

## Out of scope

- A new play-history table or per-session history model; the existing current fields and recommendation events remain the persistence model.
- Changes to DLC ownership semantics, catalog/wishlist separation, recommendation roles, dismissal behavior, or the later personal-data/availability cleanup in feature 31.
- Backward-compatible acceptance or normalization of legacy `PLAYED_BEFORE` state values. The current four-state export/import contract is authoritative because the database is rebuilt.
- Browser-test harness setup, deployment, CI, or a visual redesign.

## Build loop

Implement one build step at a time on the feature branch. After each step, run its focused Vitest coverage and review the resulting diff before continuing. Use the repository's existing `pnpm typecheck` and `pnpm test` checks as applicable; no project-wide `Verify` command is declared yet, and feature 33 owns consolidating one. No browser-test command is configured, so UI evidence is limited to the build/typecheck gates and manual review after implementation. `/complete` owns the final feature commit and archive.

## Build steps

- [x] **1. Centralize persistence-safe completion and replay transitions.** Confirm the existing `PlayState`/`completedBefore` model contract, add a small repository-native transition helper or equivalent transaction-local rule, and route `updatePlayState`, recommendation start, DLC parent acquisition, and any other direct state mutation through it. Preserve authenticated server-action boundaries and keep the state/history/replay mutation atomic with main-game changes where applicable. Add action tests for leaving `COMPLETED`, starting a replay, explicit history correction, no-op/same-state updates, and failed or missing entries.
  - **Done when:** every supported state mutation makes the asserted `LibraryEntry` write in one transaction, `COMPLETED -> IN_PROGRESS` clears `replayCandidate`, other transitions away from `COMPLETED` preserve `completedBefore`, and `pnpm test -- src/actions/game-detail.test.ts src/actions/recommendations.test.ts src/actions/wishlist-acquisition.test.ts` passes.

- [x] **2. Align recommendation learning and candidate behavior with independent history.** Update event/profile derivation to emit one completion signal per game for current or prior completion while retaining abandonment as separate evidence; update Play Next and DLC-buy affinity eligibility to use the independent history correctly without making `IN_PROGRESS` eligible. Make Taste Setup's played answer flag history only. Add deterministic pure tests for current-only, prior-only, replay/in-progress, completed-plus-abandoned, and skipped/liked Taste Setup cases, including the existing decay behavior.
  - **Done when:** recommendation tests prove no double-counted completion, a prior completion plus current abandonment yields both signals, starting a recommended replay consumes replay, and Taste Setup never changes the selected game's current state; focused recommendation/profile tests pass.

- [x] **3. Reconcile progress, shelves, and state-facing UI data.** Make Today/library health calculations count only current `COMPLETED` as completed progress, exclude abandoned entries, and keep prior-only games from double-counting. Change the calculated shelf definition and collection rendering to `Previously completed` with the OR predicate, while preserving intentional overlap and existing current-state filters. Update labels/types and the game-detail state controls only where needed to expose the independent correction without inventing another state; retain accessible labels and existing server-action error/toast behavior.
  - **Done when:** pure health and system-collection tests cover all four states plus prior-only and overlapping cases, shelf counts and queries use the OR predicate and the new label, and `pnpm typecheck` passes with the affected pages/components.

- [x] **4. Preserve the contract through merge and export/import boundaries, then run the repository sweep.** Include `completedBefore` in catalog merge personal-field snapshots and verify every direct `playState`, replay, completed-before, acquisition, start, shelf, and recommendation query found in the repository follows the feature rules. Make the current export/import schema carry the four states and independent flag directly, without accepting a legacy play-state alias; update restore fixtures and schema tests while leaving feature 31's broader schema cleanup for that feature.
  - **Done when:** merge, export, import, acquisition, state-control, recommendation, and shelf tests pass; `pnpm typecheck` and `pnpm test` both pass; no in-scope code path can reintroduce a legacy state or count `completedBefore` as current progress.

## Files / areas

- `prisma/schema.prisma` and the existing completion-history migration: authoritative `PlayState` enum and `LibraryEntry.completedBefore` contract; add no new history model.
- `src/actions/game-detail.ts`, `src/actions/recommendations.ts`, and `src/actions/wishlist.ts`: authenticated and atomic state mutations, recommendation start, Taste Setup, and DLC parent acquisition.
- `src/lib/recommendations/events.ts`, `profile.ts`, `play-next.ts`, `buy.ts`, related pipeline/types, and their tests: transition events, deduplicated completion evidence, replay eligibility, and base-game affinity.
- `src/lib/today-data-health.ts`, `src/components/today/TodaySummary.tsx`, `src/components/games/LibraryHealthStrip.tsx`, and related tests: current-state progress counts.
- `src/lib/system-collections.ts`, collections pages, library state filters, and system-collection tests: `Previously completed` shelf name, predicate, counts, and overlap.
- `src/components/games/PlayStateSection.tsx`, `src/components/recommendations/TasteSetupPanel.tsx`, `src/components/recommendations/StartPlayingButton.tsx`, and `src/components/wishlist/AcquireWishlistDialog.tsx`: visible state/history/replay controls and existing accessibility/error surfaces.
- `src/lib/catalog-operations.ts` and tests: merge preservation of completion history.
- `src/lib/export-schema.ts`, `src/lib/export-data.ts`, `src/lib/import-restore.ts`, and export/import tests: direct current schema and restore behavior.

## Data / contracts

- `LibraryEntry.playState` is one of `NOT_STARTED | IN_PROGRESS | COMPLETED | ABANDONED`; `completedBefore` is a separate boolean defaulting to false. There is no `PLAYED_BEFORE` state in the current contract.
- Leaving `COMPLETED` is history-preserving even when the destination is `NOT_STARTED` or `ABANDONED`. Only entry into `IN_PROGRESS` consumes `replayCandidate`. Directly clearing `completedBefore` is a correction and does not infer a state.
- `Previously completed` is the calculated predicate `{ OR: [{ playState: "COMPLETED" }, { completedBefore: true }] }`; `ABANDONED` is not included unless it also has prior completion. Current-state shelves remain current-state predicates.
- Active-backlog progress is based on current state: completed count is `playState === COMPLETED`; total includes `NOT_STARTED`, `IN_PROGRESS`, and `COMPLETED`; abandoned and prior-only entries do not contribute.
- Recommendation learning keeps one positive completion contribution per game from current/prior completion and keeps abandonment negative evidence distinct. No new persisted event kind is introduced; use existing event/profile payloads and timestamps.
- Taste Setup's played answer writes only `completedBefore`; its answer event remains recommendation evidence, while skipped and liked behavior stays otherwise unchanged.
- Server actions continue to call `requireUser`, validate input with Zod, scope reads/writes through the authenticated single-owner Prisma data, and return the existing `{ success, data, error }` shapes. State/history/replay writes that belong together must be transactionally atomic.
- Export and restore include `completedBefore` and only the four current states. Removed or legacy state values are not accepted as a new compatibility contract.

## Testing

- Extend existing Vitest suites rather than adding a new runner: action tests for transition and acquisition atomicity, recommendation/profile/play-next/buy tests for learning and eligibility, Today data-health tests for progress, system-collection tests for shelf predicates and counts, catalog-operation tests for merge preservation, and export-schema/import-restore tests for the direct schema.
- Cover happy, empty, correction, replay, abandoned, invalid/missing-entry, and error-preservation paths that are applicable to each action. Keep time-dependent profile assertions deterministic with fixed dates or fake timers.
- There is no configured browser-test command. Do not claim live visual or persisted-database evidence in this planning spec; implementation review should manually inspect Game Detail, Taste Setup, acquisition, Today progress, and Collections after the automated gates pass.

## Notes for the AI

- The repository already contains `completedBefore`, the four-state Prisma enum, partial transition handling, a completion-history migration, and current-state-related tests. Treat these as incomplete implementation evidence to tighten rather than as proof that feature 30 is complete.
- Existing `today-data-health` names its completed bucket `completedBefore` even though the requested semantics are current-state completion; normalize the public shape/labels or otherwise make that distinction explicit rather than preserving a misleading count.
- Do not pull feature 31's notes/source-label removal or feature 32's tag-management work into this branch. Preserve the current `completed` shelf id if routing stability requires it, changing its user-facing name and predicate rather than creating a duplicate shelf.
- No material open product question remains in the feature packet. Prefer a small shared transition helper and existing Prisma transaction patterns over a new abstraction layer.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12839,"specSha256":"ae5c0731926be4e089a8f6107ac0837ae75e13c78e624e3d92c6e589397fd435","branch":"refs/heads/feature/current-play-state-and-prior-completion-history","head":"dcba4246beebb88f2b66865703352bc9bfd408f7","baseRef":"refs/heads/main","baseCommit":"dcba4246beebb88f2b66865703352bc9bfd408f7","sourceTree":"771dfafec124579cc37485dfc49120f251825cb1","absentOptional":[]} -->

## Verification

- `pnpm typecheck` passed.
- `pnpm test` passed: 130 files and 1,254 tests.
- `pnpm build` passed.
- No live browser verification was performed by the agent.

## Manual try

1. Run `pnpm dev` and open `http://localhost:3500` with the configured authenticated account.
2. On a base-game detail page, set a game to **Completed**, enable **Replay candidate**, then change it to **In progress** and reload. Confirm **Completed before** is enabled and **Replay candidate** is cleared.
3. Open **Collections** and confirm **Previously completed** includes the game; inspect **Today** to confirm prior-only history does not increase current completed progress.
4. If a DLC wish exists, acquire it with the parent set to **In progress** and replay enabled, then reload and confirm replay is consumed.
5. Export from **Settings** and confirm entries use only the four current states plus `completedBefore`.

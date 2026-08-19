# Feature: Post-import RAWG enrichment

**From build-plan:** feature 8d
**Status:** complete

## Goal

Queue every newly created Steam catalog game for durable RAWG enrichment after a
successful import, without delaying or rolling back the Steam import, duplicating
active work, overwriting metadata, or starting provider requests automatically.

## In scope

- A server-only reusable helper that attaches known eligible catalog game IDs to
  the current RAWG batch or creates a queued RAWG batch when none is active.
- Post-commit use of that helper from the Steam owned-game import flow, based
  only on games created by that import invocation.
- Import result and Settings feedback that report Steam import counts separately
  from RAWG queue outcomes, including safe degraded queue scheduling.
- Unit coverage for queue eligibility, active-batch reuse, duplicate protection,
  and an import that remains successful if RAWG queue scheduling fails.

## Out of scope

- Calling RAWG, processing a queued job, polling, or adding a worker or
  scheduler. The existing detail and catalog batch runners own execution only
  when the owner opens their controls.
- Enriching pre-existing Steam games, manual games, wishlist entries, DLC, or
  games updated by a later import. The global library action remains the way to
  queue those intentionally.
- Replacing an existing RAWG snapshot, selecting ambiguous matches, adopting a
  RAWG title, or changing Steam import identity and playtime rules.
- Steam sync-triggered RAWG work. The project rule that manual Steam sync does
  not start enrichment remains unchanged.
- New queue schema, provider configuration, library-panel redesign, or a live
  RAWG request in tests.

## Build steps

- [x] **Step 1 - Extract the post-import RAWG queue contract** - Added a
  server-only helper that accepts server-known game IDs, filters to eligible
  base-library games with no RAWG snapshot and no active RAWG job, then either
  joins the active RAWG `SyncRun` or creates one and queues the selected jobs.
  *Done when:* Vitest proves invalid or duplicate IDs cannot create duplicate
  jobs, games with metadata or active work are skipped, an active batch is
  reused, a new batch is created only for eligible work, and the helper never
  contacts RAWG or changes catalog data.

- [x] **Step 2 - Schedule only newly imported Steam games after commit** - The
  Steam import transaction returns each newly created game ID, then invokes the
  queue helper only after that transaction and Steam connection summary commit.
  It returns structured Steam and RAWG-queue counts. *Done when:* action tests
  prove one new Steam game is queued, an existing Steam game remains an update
  only, duplicate input IDs are harmless, and a queue-helper failure still
  returns a successful Steam import with a safe queue warning and no rollback.

- [x] **Step 3 - Report queue scheduling in Settings** - The Steam import toast
  distinguishes imported and updated games from RAWG jobs queued, skipped, or
  deferred. Disabled controls and refresh behavior remain intact. *Done when:*
  a controlled import showed the import result and queue outcome in separate
  toasts, without a provider call or error when no games were newly imported.

## Files / areas

- `src/lib/rawg-import-queue.ts` and `src/lib/rawg-import-queue.test.ts` -
  server-only queue helper, eligibility, active-batch reuse, and typed outcome.
- `src/actions/steam-import.ts` - returns newly created game IDs from the
  transaction, schedules them after commit, and exposes separate results.
- `src/actions/steam-import.test.ts` - import identity, post-commit scheduling,
  queue-failure preservation, and action-result contract coverage.
- `src/components/steam/SteamConnectionCard.tsx` - concise success or warning
  feedback from the new result shape.

## Data / contracts

- `queueRawgForImportedGames(gameIds)` is server-only and receives only IDs
  returned from the successful Steam import transaction. It normalizes duplicate
  IDs, verifies each game is a `BASE_GAME` with a `LibraryEntry`, and selects
  only records without a RAWG `MetadataSnapshot` or active RAWG job.
- A queued job uses the existing `EnrichmentJob` contract and current
  `RAWG_JOB_MAX_ATTEMPTS` state. It is associated with an active RAWG `SyncRun`,
  or with a newly created `RUNNING` RAWG `SyncRun` when eligible work exists.
- Steam import persistence completes first. Queue scheduling is a separate
  post-commit operation. A scheduling exception returns a safe
  `rawgQueue.status = "DEFERRED"` result without exposing provider details and
  never turns a committed Steam import into a failure.
- The helper never calls a RAWG HTTP boundary and cannot change catalog or
  personal fields.

## Verification

- `pnpm test` - 25 files and 282 tests passing.
- `pnpm typecheck`, `pnpm lint`, `pnpm exec next build --webpack`, and
  `git diff --check` passing.
- Controlled Settings import: 0 new games and 147 updated games, with separate
  Steam and RAWG queue toasts and no browser console errors.

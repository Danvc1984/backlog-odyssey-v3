# Fix: deduplicate batch layer and split oversized functions

**Type:** Fix
**Fixes:** F-16, F-17, F-18, F-19

## The problem

The remaining open and unverified findings, all refactor-sized but mechanical:

- **F-17 (batch layer)** - after the job-runner layer (79863d1), three more
  copies remain between the RAWG and compatibility pipelines:
  - Batch-start actions ~85% line-for-line (`rawg-batch-enrichment.ts:47-161`
    vs `compat-batch-enrichment.ts:50-158`): active-batch check, game query,
    eligibility filter, `syncRun.create` with summary, job upsert loop, P2002
    -> already-running recovery, identical result kinds.
  - Batch runners duplicate the read/refresh/claim core
    (`rawg-batch-runner.ts` vs `compat-batch-runner.ts`): read SyncRun by
    provider, filter hidden, summarize visible jobs, terminal update, claim
    ready jobs with capped concurrency.
  - Run-record lifecycle copy-paste (`price-refresh.ts` vs
    `wishlist-compat-sweep.ts`): `recoverAbandonedRuns`, P2002 -> already-running
    start, finalize with status-from-counts, shared 15-minute abandoned window.
- **F-18** - `updateRecommendations` (src/actions/recommendations.ts:459-766)
  runs one ~293-line `$transaction` doing pruning/profile, play pipeline
  (candidates, exposure, calibration, baseline, tune, source tune, rerank,
  roles), buy pipeline, context assembly, and run creation.
- **F-19** - `planMergeMutations`
  (src/lib/catalog-operations.ts:804-1131) plans every merge relationship in
  one function through shared snapshot helpers.
- **F-16** - the wishlist and library list pages load every row with full RAWG
  payloads (`wishlist/page.tsx:43-70`, `library/page.tsx:175-224`) and ship
  them into client cards that consume a fraction of each payload:
  `WishlistCard` reads only `backgroundImageUrls[0]` and `description`
  (WishlistCard.tsx:53-60); `LibraryGameCard.extractCoverArtMeta` reads the
  grouped cover fields it already types (`CoverArtMeta`). The same pattern
  exists in `collections/[id]/page.tsx:119`. Row counts are bounded by a
  single user's library, so the fix is payload projection, not pagination.

## The fix

Five steps, all behavior-preserving relocations; tests assert identical
results throughout.

1. **Batch-start skeleton** - `startProviderEnrichmentBatch` in
   `src/lib/enrichment-batch-start.ts` (server-only) parameterized by
   provider, per-game eligibility selector, and queued-job data builder. Both
   actions become guard + call; they keep Zod schemas, `requireUser`, result
   shapes, and provider-specific counts (`skippedExistingMetadata` vs
   `skippedIneligible`); the P2002 catch delegates to the helper.
2. **Run-record lifecycle** - `src/lib/run-record-lifecycle.ts` with
   `recoverAbandonedRun`, `startSingleRun`, `finalizeRun` over a minimal
   Prisma-delegate interface plus timestamp-field name; `price-refresh.ts`
   and `wishlist-compat-sweep.ts` consume them; `ABANDONED_RUN_MS` moves
   there.
3. **Batch-runner core** - shared `readSyncRunBatch` / `refreshSyncRunBatch` /
   `claimReadyEnrichmentJobs` helpers (provider, select, summarize, concurrency
   as parameters); runners keep their provider views (RAWG: persisted-summary
   path, awaiting-match, pending follow-ups; compat: populated-view filter,
   failed-games override filter, get-latest tri-query). Do not force the
   views together.
4. **updateRecommendations split** - move the transaction body into
   `src/lib/recommendations/run-pipeline.ts`: `pruneAndRebuild`,
   `buildPlayPipeline` (candidates -> calibration -> tune -> source tune ->
   rerank -> roles -> items), `buildBuyPipeline`, `persistRecommendationRuns`
   (context JSONs + `recommendationRun.create` pair). The action stays the
   guard + transaction wrapper; the body reads as short orchestration. Pure
   relocation - no scoring, filter, or ordering change. Existing
   `updateRecommendations` tests must pass unmodified.
5. **planMergeMutations split** - per-relationship planners in
   `src/lib/catalog-operations.ts` next to the function
   (`planExternalIdMutations`, `planAvailabilityMutations`,
   `planCollectionMutations`, `planTagMutations`, `planMetadataMutations`,
   `planOneToOneMutations`, `planWishlistMutations`, `planCompatMutations`,
   `planEnvMutations`) sharing a small planner context (survivor, discarded,
   plan, records, pushMove/pushDelete incl. the wishlist cascade). No
   behavior change; the comprehensive existing suite must pass unmodified.
6. **List-page payload projection (F-16)** - server-side extraction helpers
   beside the pages: `wishlistCardMetadataView(payload)` returning
   `{ imageUrl, description }` and reuse of `LibraryGameCard`'s
   `CoverArtMeta` shape via an extracted `libraryCardMetadataView(payload)`.
   The pages call them while mapping rows and pass the small views; the card
   props change from `payload: unknown` to the extracted views, so the
   multi-KB payloads stop crossing the client boundary. No `take`/pagination:
   row counts are single-user-bounded, and the transfer cost was the finding.
   Apply the same projection to the collections/[id] grid.

Must not break: batch queue behavior (P2002 overlap protection, counts
shapes), poll/status endpoints, follow-up lists, price-refresh/compat-sweep
run records, recommendation run snapshots and context JSON, merge snapshot
records and mutation ordering, and card rendering (cover images, cover meta,
description previews must render identically), plus the existing tests named
above.

## Build steps

Each step ends with `pnpm typecheck && pnpm test && pnpm lint` green and the
touched suites passing without assertion changes (import adjustments only).

1. [x] Batch-start skeleton + rewire both actions.
2. [x] Run-record lifecycle helpers + rewire both files.
3. [x] Batch-runner shared core + rewire both runners.
4. [x] `run-pipeline.ts` extraction for `updateRecommendations`.
5. [x] `planMergeMutations` per-relationship planners.
6. [x] List-page payload projection for wishlist, library, and collections grids.

## Verify

- Automated: `pnpm typecheck`, `pnpm test`, `pnpm lint`, plus `pnpm build`
  after the final step; no new test files required except small unit tests
  for the two payload-view helpers (step 6); existing suites cover every path
  and only import-level adjustments are allowed.
- Manual on `pnpm dev`: start a RAWG batch and a compatibility sweep with
  progress and terminal outcomes; global wishlist price action and compat
  sweep from Settings report unchanged counts; recommendation runs produce
  identical Play Next/Buy snapshots; a merge executes with the same
  preview/undo flow.

## Findings

### deduplicate-batch-layer/F-20 [P2] closed - Today page transfers full RAWG payloads for the whole library on every render

**File:** src/app/(app)/today/page.tsx:136
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** The hottest route loads every visible base game with its full `metadataSnapshots.payload` (today/page.tsx:136-153) but uses only `backgroundImageUrls[0]` (154-161); `listKnownGenreTagValues` (src/actions/recommendations.ts:1138-1158) additionally rescans every game and wishlist payload to rebuild genre/tag sets on every render; `wishlistEntry.findMany` (today/page.tsx:163) pulls all offer rows. Pattern confirmed statically; magnitude not measured at runtime (single-user library tempers it, but this scales with library size on the post-login landing page). Same pattern exists in collections/[id]/page.tsx:119.
**Suggested fix:** Select only the fields the hero cards need (e.g., a payload projection or stored cover URL), cache the genre/tag set (revalidate on enrichment), and `Promise.all` independent queries.
**Resolution:** Restricted the Today hero query to visible main/in-progress base games, added a ten-minute memo for genre/tag suggestions, and grouped independent Today queries into a parallel wave. Manual `/today` verification confirmed the spotlight, offers, recommendation sections, and tune suggestions remain available.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit f07cf67 - hero query narrowed to main/in-progress games; genre/tag scan TTL-cached with no-cache-on-failure. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-21 [P3] closed - Today page runs roughly 14 sequential awaits on its hot path

**File:** src/app/(app)/today/page.tsx:59
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** From `latestPlayNextRun` (59) through `activityCatalogRows` (214), nearly all independent queries are awaited in sequence; per-query latency adds up on every Today render. Only the activity rows truly depend on prior work.
**Suggested fix:** Group independent queries into 2-3 `Promise.all` waves; keep the activity-dependency chain last.
**Resolution:** Grouped independent Today data loads into one `Promise.all` wave and kept the dependent activity catalog lookup as the only second wave. Manual `/today` verification confirmed the rendered flow remains functional.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit f07cf67 - independent queries grouped into one Promise.all wave; activity rows remain the only dependent query. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-22 [P3] closed - Steam OpenID connect flow has no state or nonce binding

**File:** src/app/api/steam/callback/route.ts:16
**Found:** 2026-09-03 by /audit (scope: full; lens: security)
**Why it matters:** The callback accepts any Steam-signed `claimed_id` and upserts the single SteamConnection (route.ts:28-39); the only app-side check is `openid.return_to` against the request-derived origin. An attacker who completes their own Steam OpenID login can get the logged-in owner's browser to replay that signed response at this endpoint, rebinding the connection to the attacker's Steam account so later imports sync the wrong library. Exploit requires the owner to be logged in and visit attacker-controlled content; impact is data pollution, not read access, hence P3 for this single-user app.
**Suggested fix:** Generate a random per-connect token, store it (or sign it into `state` carried through the round trip), and require it to match in the callback before upserting.
**Resolution:** Added a cryptographically random state nonce, HttpOnly/Secure/SameSite=Lax cookie binding, timing-safe callback validation, and cookie clearing on success or error. Manual verification confirmed the normal Steam connection redirect and rejection after editing `state`.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit d823c57 - per-connect nonce in an HttpOnly/Secure/SameSite cookie echoed through signed return_to, timing-safe match, cookie cleared on success and error, upsert gated behind state + return_to + signature checks. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-23 [P3] closed - Server actions return raw error messages to the client

**File:** src/actions/prices.ts:50
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** Catch blocks across actions return `err instanceof Error ? err.message : ...`, surfacing Prisma/internal error text in toasts (representatives: prices.ts:50, recommendations.ts:1156, steam.ts:22). Standards say user-friendly error messages; single-user app limits the leak, but internal messages reach the UI.
**Suggested fix:** Map known error classes to friendly messages and log the raw error server-side; keep `lastErrorMessage` on run records as the diagnostic surface.

**Resolution:** Added `ActionError` and `friendlyActionError`, converted user-facing domain throws, and replaced raw action error returns with unchanged friendly fallbacks while preserving run-record diagnostics. Awaiting `/audit` re-review.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 098139f - ActionError + friendlyActionError added; 81 catch ternaries replaced (zero remaining), 40 user-facing throws converted, the 2 internal bug-guards left as plain Error and now log server-side. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-24 [P3] closed - Wishlist detail serializes the full RAWG payload into a client component for two fields

**File:** src/app/(app)/wishlist/[id]/page.tsx:270
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** `WishlistIdentity` (client component) receives the whole multi-KB snapshot payload but only reads `storeLink` and `storeLinkDismissedAt` (via src/lib/wishlist-identity-view.ts). Every detail view ships the full payload in the RSC flight data.
**Suggested fix:** Extract `{ storeLink, storeLinkDismissedAt, fetchedAt }` server-side and pass that object.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit a13f41c - page passes the extracted identity view from wishlistIdentitySnapshotView; no payload crosses the client boundary. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-25 [P3] closed - Batch poll loop re-reads the full job list twice per 2-second tick

**File:** src/components/games/RawgBatchEnrichmentPanel.tsx:148
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** While a batch runs, the client polls every 2s (GET, plus POST); each status read loads all enrichment jobs with joined game rows, and the RAWG side also rescans all pending follow-up batches (rawg-batch-runner.ts:87-125) twice per tick. Bounded at personal scale; grows with library size and poll duration.
**Suggested fix:** Longer interval plus a counts-based status payload; run the pending-follow-ups rescan only when the batch turns terminal.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit a13f41c - pending-follow-ups rescan gated on isTerminal; both panels poll POST-only while RUNNING. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-26 [P3] closed - Wishlist compatibility sweep runs strictly serial per entry

**File:** src/lib/wishlist-compat-sweep.ts:159
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** The sweep awaits each entry's refresh (two parallel provider calls each) one at a time, so the calling action blocks for N × provider latency. Batch runners cap concurrency at 5; this path has none.
**Suggested fix:** Reuse the existing small-concurrency pattern (e.g., chunks of 5) from the batch runners.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit a13f41c - sweep processes entries in chunks of 5 with per-entry failure isolation. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-27 [P3] closed - compat-job-runner retry and exhaustion branches lack tests

**File:** src/lib/compat-job-runner.test.ts:1
**Found:** 2026-09-03 by /audit (scope: full; lens: tests)
**Why it matters:** 3 tests / 10 assertions cover a 252-line runner whose retry state machine is exactly where wrong-answer bugs live. Untested: attempt exhaustion going terminal instead of RETRY_WAIT (compat-job-runner.ts:105), non-retryable errors going terminal, claim failure returning current status (:214), and PERSISTENCE_FAILED (:234).
**Suggested fix:** Add focused tests for the exhaustion matrix (retryable + max attempts, non-retryable, claim-loss, persistence failure), mirroring the stronger rawg-job-runner coverage where applicable.
**Resolution:** Added focused coverage for retry exhaustion, non-retryable provider errors, claim loss and claim filters, persistence failure, and provider error precedence. Full Vitest suite passes with 1030 tests.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit fec76b2 - runner now has 7 tests covering exhaustion, non-retryable matrix, claim race, PERSISTENCE_FAILED, and first-provider-error-wins. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-28 [P3] closed - Fake timers restored as a trailing statement in recommendations tests

**File:** src/actions/recommendations.test.ts:1414
**Found:** 2026-09-03 by /audit (scope: full; lens: tests)
**Why it matters:** `vi.useRealTimers()` is the last line of the test (1414), not an `afterEach`. Any failure before it leaks frozen fake timers into the rest of the file, producing cascading failures that mask real regressions. `src/lib/itad-retry.test.ts:11-13` shows the correct pattern.
**Suggested fix:** Move timer restore into an `afterEach` (or try/finally) for the affected describe block.
**Resolution:** Moved fake-timer restoration to `afterEach` in `rotateRecommendationRole` and removed the trailing restore from the cooldown test. Recommendations tests and the full suite pass.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit fec76b2 - timer restore moved to afterEach plus try/finally in the TTL test; no trailing restores remain. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-29 [P3] closed - Small cleanups: unused imports, duplicate constant export, unneeded client directive

**File:** src/app/(app)/today/page.tsx:35
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** Five unused imports/vars reported by lint (today/page.tsx:35-36, CompatibilitySection.tsx:10, MetadataSection.tsx:2, RecommendationItemCard.tsx:67); `ABANDONED_RUN_MS` exported identically from two files with no cross-import (price-refresh.ts:16, wishlist-compat-sweep.ts:56); `SourceIcon.tsx` is pure presentational but marked `'use client'` (src/components/sources/SourceIcon.tsx:1). All trivial, all noise in review.
**Suggested fix:** One cleanup pass: delete the five unused bindings, keep a single source for `ABANDONED_RUN_MS`, drop the directive.
**Resolution:** Removed the unused bindings, centralized `ABANDONED_RUN_MS` in `price-refresh.ts`, and removed the unnecessary client directive from `SourceIcon.tsx`. Lint and typecheck pass.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 2d64b2b - lint reports zero warnings; single ABANDONED_RUN_MS; SourceIcon directive removed. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-30 [P3] closed - steam-sync returns success:false with non-null data

**File:** src/actions/steam-sync.ts:62
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** Sole deviation from the `{ success, data: null, error }` action contract; every other failure path returns `data: null`. Callers keying on `data` on failure can be surprised.
**Suggested fix:** Return `data: null` and keep the counts in the SyncRun record (already persisted) or a diagnostics field.
**Resolution:** The no-owned-games failure now returns `data: null`; counts remain persisted on the FAILED `SyncRun` row. The focused sync test passes.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 2d64b2b - steam-sync failure branch returns data: null. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-31 [P3] closed - Line clamping implemented with inline styles in four card components

**File:** src/components/wishlist/WishlistCard.tsx:159
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `-webkit-line-clamp` is applied via inline `style` objects in WishlistCard.tsx:159, LibraryGameCard.tsx:189, PlayNextRailCard.tsx:118, RecommendationItemCard.tsx:125, while the standard says no inline styles and Tailwind ships `line-clamp-*` utilities.
**Suggested fix:** Replace with `line-clamp-2` / `line-clamp-3` classes.
**Resolution:** Replaced the four inline clamp style objects with the equivalent Tailwind `line-clamp-2` and `line-clamp-3` classes. Build passes.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 2d64b2b - four cards use line-clamp-2/3 utilities. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-32 [P3] closed - Wishlist create/update accepts any non-empty steamAppId string

**File:** src/actions/wishlist.ts:21
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** The manual-entry schemas validate `steamAppId` as `z.string().trim().min(1)` (lines 21, 35), while the identity flow enforces `/^\d{1,10}$/` (src/actions/wishlist-identity.ts:36). Downstream uses are URL-encoded (no injection), but malformed IDs can enter the same column through two doors.
**Suggested fix:** Reuse the identity flow's regex in the create/update schemas.
**Resolution:** Create and update now enforce the same 1-10 digit Steam App ID regex as the identity flow, with focused rejection tests.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 2d64b2b - both wishlist schemas enforce ^\d{1,10}$ with focused tests. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-33 [P3] closed - Em dash in generated recommendation copy

**File:** src/lib/recommendations/recommendation-copy.ts:36
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Suggested fix:** Switch the separator to `": "` and update the four test assertions.
**Resolution:** Changed the generated separator to `": "` and updated all four copy assertions. The full test suite passes.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 2d64b2b - separator is ': ' and the four assertions were updated. Repair verified against the new code; no new defect introduced.

### deduplicate-batch-layer/F-34 [P3] closed - Pure-function tests live in the actions-layer catalog-operations test file

**File:** src/actions/catalog-operations.test.ts:91
**Found:** 2026-09-03 by /audit (scope: full; lens: tests; test-count assessment)
**Why it matters:** The actions test imports both the actions and the lib planning functions, so the describes at lines 91-378 (suggestSurvivor, resolvePersonalFields, planExternalIdUnion, planOneToOneConflicts, buildMergeProposal) test `src/lib/catalog-operations.ts` one layer below the file's name. No case duplication with `src/lib/catalog-operations.test.ts` (different functions), so it is placement drift, not redundancy. Both files misstate what they cover.
**Suggested fix:** When touching this area (e.g., alongside an F-17-style cleanup), relocate those describes into `src/lib/catalog-operations.test.ts`. Pure relocation, no behavior change; not worth a standalone pass.
**Resolution:** 2026-09-03 by /fix (commit 79863d1): the five pure-function describes were relocated verbatim into `src/lib/catalog-operations.test.ts` (312 lines out of the actions test, 330 in), which now hosts them.
**Resolution:** Closed 2026-09-03 by /audit (scope: full; lens: all): re-examined the repair in commit 79863d1 - five pure-function describes relocated verbatim into the lib test file. Repair verified against the new code; no new defect introduced.

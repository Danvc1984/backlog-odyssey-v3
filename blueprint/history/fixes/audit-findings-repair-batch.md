# Fix: Repair batch for open audit findings (F-01..F-17)

**Type:** Fix
**Fixes:** F-01, F-02, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12,
F-13, F-14, F-15, F-17

## The problem

`blueprint/context/findings.md` held 14 confirmed open findings from the
2026-08-21 full audit (one perf, three quality, two behavioral perf-adjacent,
eight quality/tests). The user chose one batched fix with multiple reviewed
steps instead of one fix per finding. F-16 stayed out as an unverified lead.

## The fix

One branch, fifteen reviewed steps ordered trivial-first and riskiest-last:

| Steps | Findings | Area |
|---|---|---|
| 1-3 | F-10, F-11, F-09 | Lint cleanup, dead wishlist input surface, single ITAD chunk constant |
| 4 | F-12 | Hot-filter indexes + migration |
| 5-9 | F-15, F-13, F-14, F-02, F-08 | Test coverage (epoch guard, allowlist gate, RAWG payload parser, DLC import, link guards) |
| 10-11 | F-01, F-04 | Bounded store-details concurrency; shared unresolved-DLC upsert and flow context |
| 12-13 | F-07, F-06 | Chunked price-refresh persistence; batched/chunked Steam import and sync |
| 14 | F-05 | Merge transaction collapsed to an ordered mutation-batch table |
| 15 | F-17 | Companion repair found by /audit: catch-path enrichment queueing |

## Verify

- Full suite: 43 files, 427/427 passed.
- `pnpm typecheck` clean; `pnpm lint` 0 problems; `pnpm build` passed.
- Migration 20260822003840 applied (`prisma migrate status`: up to date).
- Two audits re-reviewed the batch; all repaired findings closed. Manual try
  path: signed-in Steam playtime sync, wishlist price refresh (counts
  unchanged), and a catalog merge with undo.

## Findings

### audit-findings-repair-batch/F-01 [P2] closed - Steam store API details lookup uses unbounded concurrency

**File:** src/lib/steam-api.ts:183
**Found:** 2026-08-20 by /audit (scope: current; lens: performance)
**Why it matters:** In `fetchOwnedGameDetails`, `Promise.all(appids.map(...))` triggers simultaneous outbound HTTP requests to `store.steampowered.com/api/appdetails` for every owned game without bounding, risking rate limits and dropped DLC classifications on large libraries.
**Resolution:** Fixed on this branch: chunked pool of 8 concurrent appdetails requests; test proves peak concurrency stays within the bound across 40 lookups. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-02 [P3] closed - Missing test coverage for happy-path Steam DLC import when base game is present

**File:** src/actions/steam-import.test.ts:190
**Found:** 2026-08-20 by /audit (scope: current; lens: tests)
**Why it matters:** Only the fallback path (DLC without base game routed to UnresolvedSteamDlc) was tested; the base-present creation path had no assertions.
**Resolution:** Fixed on this branch: base-present DLC creation test plus known-DLC availability-only update test. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-04 [P2] closed - Steam import and sync duplicate the unresolved-DLC upsert and connection guards

**File:** src/actions/steam-import.ts:63
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** The unresolvedSteamDlc.upsert payload and the connection/API-key guard blocks were byte-identical duplicates across steam-import.ts and steam-sync.ts; changing one side silently left the other stale.
**Resolution:** Fixed on this branch: new src/lib/steam-flow.ts with upsertUnresolvedSteamDlc and requireSteamFlowContext; call-site branching unchanged. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-05 [P2] closed - executeMergeTransaction is ~215 lines with fifteen copy-paste mutation blocks

**File:** src/actions/catalog-operations.ts:226
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** Fifteen structurally identical Promise.all mutation blocks inside a data-integrity-critical merge path roughly 213 lines long; every new relation meant another hand-copied block.
**Resolution:** Fixed on this branch: loadReviewedPair and applyMergeMutations extracted; ordered batch table over all 20 mutation groups; function now 62 lines; operations unchanged. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-06 [P2] closed - Whole-library Steam imports and syncs run inside one interactive transaction with per-row queries

**File:** src/actions/steam-import.ts:147
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** Import and sync executed per-game work for hundreds of games inside a single interactive transaction, holding one pooled connection for minutes with all-or-nothing failure semantics.
**Resolution:** Fixed on this branch: batch identity read plus 50-game chunk transactions in both flows; in-run identity map preserves dedupe and DLC ordering. The repair initially introduced F-17, repaired as step 15. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-17 [P2] closed - Mid-run import failure leaves committed chunks without RAWG enrichment

**File:** src/actions/steam-import.ts:149
**Found:** 2026-08-22 by /audit (scope: current; lens: quality)
**Why it matters:** With chunked commits, a mid-run chunk failure returned an error while earlier chunks stayed committed, but queueRawgForImportedGames never ran for those surviving games and retries queue nothing either.
**Resolution:** Fixed on this branch: createdGameIds hoisted above the try; catch-path best-effort queue call with masked queue errors; test asserts the committed chunk's 50 ids reach the queue exactly once. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-07 [P2] closed - Full price refresh runs synchronously in one Server Action with sequential per-entry transactions

**File:** src/actions/prices.ts:33
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** The refresh action awaited provider latency plus one sequential deleteMany+createMany transaction per wishlist entry inside a single blocking HTTP request: timeout-prone with no progress feedback.
**Resolution:** Fixed on this branch (smallest step): one transaction per 200-entry chunk sharing a single now; six-bucket counts intact; cross-chunk survival tested. Larger run-id/poll redesign noted as follow-up if timeouts still bite. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-08 [P2] closed - Unresolved-DLC link guards have no error-path tests

**File:** src/actions/unresolved-dlc.test.ts
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** Three guard branches preventing a DLC from being parented under another DLC were untested, and the happy-path test never asserted its returned data shape.
**Resolution:** Fixed on this branch: three guard tests with exact errors and no-write assertions; data shape asserted. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-09 [P3] closed - ITAD 200-item chunk contract defined three ways

**File:** src/lib/price-refresh.ts:180
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** The provider cap lived as PRICES_CHUNK_SIZE, LOOKUP_CHUNK_SIZE, and a hardcoded slice loop; a cap change needed three hand edits.
**Resolution:** Fixed on this branch: generic chunkItadIds fed by the sole PRICES_CHUNK_SIZE default; other definitions removed. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-10 [P3] closed - Leftover DEBUG comment and unused-variable lint warnings in price-refresh

**File:** src/lib/price-refresh.ts:136
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** An empty DEBUG comment and two unused-variable warnings violated the standards in one file.
**Resolution:** Fixed on this branch: all three removed; lint reports 0 problems. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-11 [P3] closed - Dead input surface and dead exports around wishlist creation

**File:** src/actions/wishlist.ts:20
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** createWishlistEntrySchema accepted a rawgId the action never read (which also tripped strict parsing when a RAWG candidate was selected), backed by three zero-importer type exports.
**Resolution:** Fixed on this branch: schema field, three exports, and the dialog payload removed. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-12 [P3] closed - Missing indexes on PriceRefresh and SyncRun hot filters

**File:** prisma/schema.prisma:471
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** PriceRefresh status/requestedAt recovery filters and SyncRun provider/status page filters ran unindexed on append-only tables.
**Resolution:** Fixed on this branch: both indexes added via additive migration 20260822003840. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-13 [P3] closed - Google email allowlist logic is untested

**File:** src/lib/auth.ts:22
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** The signIn allowlist comparison and session-stripping branch are the entire single-user security gate; a flipped operator would pass the suite unnoticed.
**Resolution:** Fixed on this branch: predicate cases extended and real async callbacks driven via a config-capturing next-auth mock (11 tests total). Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-14 [P3] closed - Legacy and corrupt RAWG candidate-payload branches untested

**File:** src/lib/rawg-job-view.ts:72
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** candidatePageFromPayload's legacy-array and garbage fallbacks drive hasMoreCandidates in the enrichment UI with no test pinning them.
**Resolution:** Fixed on this branch: four parser branches plus derivation asserted in rawg-job-view.test.ts. Closed by /audit 2026-08-22 (scope: current).

### audit-findings-repair-batch/F-15 [P3] closed - lastPlayedDate(0) epoch-guard untested

**File:** src/lib/steam-utils.ts:1
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** A regression returning new Date(0) for never-played games would stamp epoch dates across the library silently.
**Resolution:** Fixed on this branch: direct unit tests cover 0, negative, and positive timestamps. Closed by /audit 2026-08-22 (scope: current).

# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] open - Steam store API details lookup uses unbounded concurrency

**File:** src/lib/steam-api.ts:183
**Found:** 2026-08-20 by /audit (scope: current; lens: performance)
**Why it matters:** In `fetchOwnedGameDetails`, `Promise.all(appids.map(...))` triggers simultaneous outbound HTTP requests to `store.steampowered.com/api/appdetails` for every owned game in the user's library without concurrency bounding. For accounts with hundreds of games, this risks hitting Steam rate limits (HTTP 429), timeouts, or dropped DLC classifications.
**Suggested fix:** Bound concurrency (e.g. using a chunked pool or batch size of 5-10 requests) or throttle requests so large libraries do not flood the Steam Store API concurrently.
**Resolution:** Re-examined 2026-08-21 by /audit (scope: full): still present; anchor moved to :183 as the module grew. Amplified by running on every import and every daily playtime sync, with failures silently swallowed (:202-204). Status unchanged: open.

### F-02 [P3] open - Missing test coverage for happy-path Steam DLC import when base game is present

**File:** src/actions/steam-import.test.ts:190
**Found:** 2026-08-20 by /audit (scope: current; lens: tests)
**Why it matters:** `src/actions/steam-import.test.ts` tests the fallback path where a Steam DLC has no base game and is routed to `UnresolvedSteamDlc`, but does not have a test asserting that a Steam DLC whose base game is present is successfully created as a `Game` with `type: DLC` and attached `baseGameId`.
**Suggested fix:** Add a unit test in `src/actions/steam-import.test.ts` mocking a base game in `externalGameId` and asserting DLC creation with correct relation linking.
**Resolution:** Re-examined 2026-08-21 by /audit (scope: full): still missing; no `baseGameId` assertion exists in the file. The sibling branch where an already-known DLC updates availability without a libraryEntry upsert (steam-import.ts:39-45) is also uncovered. Status unchanged: open.

### F-04 [P2] open - Steam import and sync duplicate the unresolved-DLC upsert and connection guards

**File:** src/actions/steam-import.ts:63
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** The `unresolvedSteamDlc.upsert` payload (create/update with `status: "PENDING"`, `discardedAt: null` reset) is byte-identical between steam-import.ts:63-76 and steam-sync.ts:84-97, and the connection-missing plus `STEAM_WEB_API_KEY` guard blocks are likewise duplicated (steam-import.ts:126-144 vs steam-sync.ts:28-46). These blocks encode the source-specific reappear rules; when one side changes, the other silently keeps stale behavior.
**Suggested fix:** Extract `upsertUnresolvedSteamDlc(tx, externalId, game)` and a shared connection/key context helper into `src/lib/`, keeping each source's reappear rules explicit at the call sites.
**Resolution:**

### F-05 [P2] open - executeMergeTransaction is ~215 lines with fifteen copy-paste mutation blocks

**File:** src/actions/catalog-operations.ts:226
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** Lines 296-411 are fifteen structurally identical `await Promise.all(mutationPlan.X.map(...))` blocks differing only in delegate and operation, inside a data-integrity-critical merge path roughly 213 lines long (guideline: under 50). Adding a relation means another hand-copied block in the riskiest transaction in the app.
**Suggested fix:** Drive moves/deletes from a descriptor table `{ key, delegate, mode }` applied in one loop, collapsing the function to a fraction of the size while keeping ordering explicit.
**Resolution:**

### F-06 [P2] open - Whole-library Steam imports and syncs run inside one interactive transaction with per-row queries

**File:** src/actions/steam-import.ts:147
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** First import executes `importGame` per game (findUnique + create/upsert + availability write, 2-5 statements each) for hundreds of games inside a single `prisma.$transaction` (steam-import.ts:147-163); `syncSteamPlaytime` repeats the shape per game on every daily sync (steam-sync.ts:50-125). One pooled connection is held for minutes, any failure rolls back everything and restarts from zero, and concurrent page loads contend for remaining pool connections. Confirmed by code reading; wall-clock impact at ~500 games is a runtime hypothesis.
**Suggested fix:** Batch-read identities with one `externalGameId.findMany({ where: { externalId: { in: [...] } } })`, then commit in chunks (e.g. 50 games per transaction) so partial progress survives and connections recycle.
**Resolution:**

### F-07 [P2] open - Full price refresh runs synchronously in one Server Action with sequential per-entry transactions

**File:** src/actions/prices.ts:33
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** `updatePrices` awaits identity lookup plus ceil(n/200) ITAD price fetches plus one sequential `deleteMany`+`createMany` transaction per entry (price-refresh.ts:200-225) while the client blocks on the single request (PriceRefreshPanel.tsx:48). At hundreds of wishlist entries this becomes hundreds of sequential DB transactions plus provider latency inside one HTTP request: timeout-prone with no progress feedback, unlike the RAWG panel which queues and polls.
**Suggested fix:** Smallest step: persist deals per 200-entry chunk in one transaction sharing a single `now`. Larger: return a run id immediately and let the existing PriceRefresh poll path report counts.
**Resolution:**

### F-08 [P2] open - Unresolved-DLC link guards have no error-path tests

**File:** src/actions/unresolved-dlc.test.ts
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** Three guard branches in src/actions/unresolved-dlc.ts are untested: `"Base game not found"` (:49), `"DLC parent must be a base game"` (:51), and `"Steam base game identity is unavailable"` (:102). These guards are what stop a manual link from parenting a DLC under another DLC, the exact failure mode the review queue exists to prevent. The happy-path test also never asserts the returned data shape.
**Suggested fix:** Three short tests mocking `findUnique` to return null / a DLC-type row / a queue record without `steamBaseAppId`, asserting exact error strings and that `game.create` is never reached.
**Resolution:**

### F-09 [P3] open - ITAD 200-item chunk contract defined three ways

**File:** src/lib/price-refresh.ts:180
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** The provider cap lives as `PRICES_CHUNK_SIZE = 200` in src/lib/itad-api.ts:5, `LOOKUP_CHUNK_SIZE = 200` in src/lib/itad-identity.ts:11, and a hardcoded `index += 200` slice loop in price-refresh.ts:180-181 that bypasses the exported `chunkItadIds` helper entirely. If the cap ever changes, three sites need hand-editing and one of them does not reference the constant at all.
**Suggested fix:** Make `PRICES_CHUNK_SIZE` the sole definition feeding `chunkItadIds`, and use `chunkItadIds(priced)` in price-refresh.
**Resolution:**

### F-10 [P3] open - Leftover DEBUG comment and unused-variable lint warnings in price-refresh

**File:** src/lib/price-refresh.ts:136
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** Line 136 is an empty `// DEBUG:` comment left above `voucher`, and `pnpm lint` reports two warnings in the same file: unused destructured `entry` at :192 (a loop that just does `counts.failed += 1`) and unused `err` binding at :221. All three violate the standards (no unused variables, comments only for non-obvious why).
**Suggested fix:** Delete the comment, replace the loop with `counts.failed += chunk.length`, and drop the catch parameter.
**Resolution:**

### F-11 [P3] open - Dead input surface and dead exports around wishlist creation

**File:** src/actions/wishlist.ts:20
**Found:** 2026-08-21 by /audit (scope: full; lens: quality)
**Why it matters:** `createWishlistEntrySchema` accepts an optional `rawgId` that the action never reads (RAWG identity flows exclusively through wishlist-rawg/wishlist-identity now), misleading callers into thinking create-with-RAWG works. Unused exports back this up: `CreateWishlistEntryInput` (wishlist.ts:63), `AcquireWishlistDlcInput` (wishlist.ts:67), and `OriginString` (src/lib/catalog-operations.ts:665) have zero importers.
**Suggested fix:** Remove `rawgId` from the create schema and delete the three dead type exports.
**Resolution:**

### F-12 [P3] open - Missing indexes on PriceRefresh and SyncRun hot filters

**File:** prisma/schema.prisma:471
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** `PriceRefresh` is filtered by `status` + `requestedAt < cutoff` for abandoned-run recovery and sorted by `requestedAt` for latest-run display with no index; `SyncRun` is filtered by `provider` + `status` on library page loads and queue paths, also unindexed. Both tables grow one row per run forever. Cheap insurance today; real drag later.
**Suggested fix:** Add `@@index([status, requestedAt])` to PriceRefresh and `@@index([provider, status])` to SyncRun in a normal migration.
**Resolution:**

### F-13 [P3] open - Google email allowlist logic is untested

**File:** src/lib/auth.ts:22
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** The `signIn` callback allowlist comparison and session-stripping branch are the entire single-user security gate, yet no test covers them; a flipped operator or dropped check would pass the suite unnoticed.
**Suggested fix:** Extract an `isAllowedEmail(email)` predicate into testable code and cover match, unset-env, and missing-profile-email branches.
**Resolution:**

### F-14 [P3] open - Legacy and corrupt RAWG candidate-payload branches untested

**File:** src/lib/rawg-job-view.ts:72
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** `candidatePageFromPayload`'s fallback branches are exercised by nothing: the legacy plain-array payload fabricates `nextPage: 2` (driving `hasMoreCandidates: true` in the enrichment UI) and garbage payloads collapse to empty candidates. A wrong answer flips the "more candidates" affordance.
**Suggested fix:** Small `rawg-job-view.test.ts` covering paged-valid, legacy non-empty array, empty array, and garbage inputs, asserting `nextPage` and `hasMoreCandidates`.
**Resolution:**

### F-15 [P3] open - lastPlayedDate(0) epoch-guard untested

**File:** src/lib/steam-utils.ts:1
**Found:** 2026-08-21 by /audit (scope: full; lens: tests)
**Why it matters:** Zero is the dominant real-world value for never-played Steam games, but no direct or indirect test asserts `lastPlayedDate(0)` returns null; a regression returning `new Date(0)` would stamp epoch dates across the library silently.
**Suggested fix:** Two-line test beside the steam-import suite covering 0, negative, and positive timestamps.
**Resolution:**

### F-16 [P3] unverified - Wishlist and library pages load unbounded rows including full RAWG payloads

**File:** src/app/(app)/wishlist/page.tsx:26
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** Both pages use `findMany` with no `take`; wishlist serializes each entry's full RAWG snapshot payload plus the whole base-game list into client components, and `readPendingRawgFollowUps` rescans batches on every status read (src/lib/rawg-batch-runner.ts:86). Fine at current scale, grows linearly and unbounded. Not confirmed as a defect: RSC payload sizes and query timing at realistic row counts were not measured at runtime.
**Suggested fix:** When it bites: select only card fields (strip payloads to needed keys) and cap or paginate lists. Track until measured.
**Resolution:**

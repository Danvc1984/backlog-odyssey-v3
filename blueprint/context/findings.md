# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-16 [P3] unverified - Wishlist and library pages load unbounded rows including full RAWG payloads

**File:** src/app/(app)/wishlist/page.tsx:26
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** Both pages use `findMany` with no `take`; wishlist serializes each entry's full RAWG snapshot payload plus the whole base-game list into client components, and `readPendingRawgFollowUps` rescans batches on every status read (src/lib/rawg-batch-runner.ts:86). Fine at current scale, grows linearly and unbounded. Not confirmed as a defect: RSC payload sizes and query timing at realistic row counts were not measured at runtime.
**Suggested fix:** When it bites: select only card fields (strip payloads to needed keys) and cap or paginate lists. Track until measured.
**Resolution:** Re-checked 2026-09-03 by /audit (scope: full; lens: performance): code unchanged, still unbounded (`wishlist/page.tsx:43`, `library/page.tsx:175`). Same payload-scan pattern confirmed in more places (today/page.tsx:136,163; collections/[id]/page.tsx:119; detail payload to client in wishlist/[id]/page.tsx:270, tracked as F-20/F-24). Still unverified at runtime.


### F-18 [P2] open - updateRecommendations spans roughly 320 lines inside a 1282-line action module

**File:** src/actions/recommendations.ts:449
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `updateRecommendations` (lines 449-769) is one `$transaction` doing pruning, profile update, tune, calibration, exposure, play rerank, buy rerank, and snapshots, in a module that also carries 15 other exports. Far past the 50-line guideline and the hardest code in the app to change safely.
**Suggested fix:** Split the transaction body into named per-concern helpers in `src/lib/recommendations/` (calibration, exposure, rerank) with their own tests; keep the action as the guard + transaction wrapper.

### F-19 [P2] open - planMergeMutations spans roughly 327 lines in a 1131-line module

**File:** src/lib/catalog-operations.ts:804
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `planMergeMutations` (lines 804-1131) plans the entire merge mutation set in one function, and the module mixes snapshot envelopes, TTL/state, personal-field resolution, merge planning, and delete planning. Merge is the most destructive operation in the app; its planning code should be the easiest to read.
**Suggested fix:** Extract per-relationship planners (external IDs, availability, tags, collections, wishlist) into small functions beside it; no behavior change.

### F-20 [P2] fixed - Today page transfers full RAWG payloads for the whole library on every render

**File:** src/app/(app)/today/page.tsx:136
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** The hottest route loads every visible base game with its full `metadataSnapshots.payload` (today/page.tsx:136-153) but uses only `backgroundImageUrls[0]` (154-161); `listKnownGenreTagValues` (src/actions/recommendations.ts:1138-1158) additionally rescans every game and wishlist payload to rebuild genre/tag sets on every render; `wishlistEntry.findMany` (today/page.tsx:163) pulls all offer rows. Pattern confirmed statically; magnitude not measured at runtime (single-user library tempers it, but this scales with library size on the post-login landing page). Same pattern exists in collections/[id]/page.tsx:119.
**Suggested fix:** Select only the fields the hero cards need (e.g., a payload projection or stored cover URL), cache the genre/tag set (revalidate on enrichment), and `Promise.all` independent queries.
**Resolution:** Restricted the Today hero query to visible main/in-progress base games, added a ten-minute memo for genre/tag suggestions, and grouped independent Today queries into a parallel wave. Manual `/today` verification confirmed the spotlight, offers, recommendation sections, and tune suggestions remain available.

### F-21 [P3] fixed - Today page runs roughly 14 sequential awaits on its hot path

**File:** src/app/(app)/today/page.tsx:59
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** From `latestPlayNextRun` (59) through `activityCatalogRows` (214), nearly all independent queries are awaited in sequence; per-query latency adds up on every Today render. Only the activity rows truly depend on prior work.
**Suggested fix:** Group independent queries into 2-3 `Promise.all` waves; keep the activity-dependency chain last.
**Resolution:** Grouped independent Today data loads into one `Promise.all` wave and kept the dependent activity catalog lookup as the only second wave. Manual `/today` verification confirmed the rendered flow remains functional.

### F-22 [P3] fixed - Steam OpenID connect flow has no state or nonce binding

**File:** src/app/api/steam/callback/route.ts:16
**Found:** 2026-09-03 by /audit (scope: full; lens: security)
**Why it matters:** The callback accepts any Steam-signed `claimed_id` and upserts the single SteamConnection (route.ts:28-39); the only app-side check is `openid.return_to` against the request-derived origin. An attacker who completes their own Steam OpenID login can get the logged-in owner's browser to replay that signed response at this endpoint, rebinding the connection to the attacker's Steam account so later imports sync the wrong library. Exploit requires the owner to be logged in and visit attacker-controlled content; impact is data pollution, not read access, hence P3 for this single-user app.
**Suggested fix:** Generate a random per-connect token, store it (or sign it into `state` carried through the round trip), and require it to match in the callback before upserting.
**Resolution:** Added a cryptographically random state nonce, HttpOnly/Secure/SameSite=Lax cookie binding, timing-safe callback validation, and cookie clearing on success or error. Manual verification confirmed the normal Steam connection redirect and rejection after editing `state`.

### F-23 [P3] open - Server actions return raw error messages to the client

**File:** src/actions/prices.ts:50
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** Catch blocks across actions return `err instanceof Error ? err.message : ...`, surfacing Prisma/internal error text in toasts (representatives: prices.ts:50, recommendations.ts:1156, steam.ts:22). Standards say user-friendly error messages; single-user app limits the leak, but internal messages reach the UI.
**Suggested fix:** Map known error classes to friendly messages and log the raw error server-side; keep `lastErrorMessage` on run records as the diagnostic surface.

### F-24 [P3] fixed - Wishlist detail serializes the full RAWG payload into a client component for two fields

**File:** src/app/(app)/wishlist/[id]/page.tsx:270
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** `WishlistIdentity` (client component) receives the whole multi-KB snapshot payload but only reads `storeLink` and `storeLinkDismissedAt` (via src/lib/wishlist-identity-view.ts). Every detail view ships the full payload in the RSC flight data.
**Suggested fix:** Extract `{ storeLink, storeLinkDismissedAt, fetchedAt }` server-side and pass that object.

### F-25 [P3] fixed - Batch poll loop re-reads the full job list twice per 2-second tick

**File:** src/components/games/RawgBatchEnrichmentPanel.tsx:148
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** While a batch runs, the client polls every 2s (GET, plus POST); each status read loads all enrichment jobs with joined game rows, and the RAWG side also rescans all pending follow-up batches (rawg-batch-runner.ts:87-125) twice per tick. Bounded at personal scale; grows with library size and poll duration.
**Suggested fix:** Longer interval plus a counts-based status payload; run the pending-follow-ups rescan only when the batch turns terminal.

### F-26 [P3] fixed - Wishlist compatibility sweep runs strictly serial per entry

**File:** src/lib/wishlist-compat-sweep.ts:159
**Found:** 2026-09-03 by /audit (scope: full; lens: performance)
**Why it matters:** The sweep awaits each entry's refresh (two parallel provider calls each) one at a time, so the calling action blocks for N × provider latency. Batch runners cap concurrency at 5; this path has none.
**Suggested fix:** Reuse the existing small-concurrency pattern (e.g., chunks of 5) from the batch runners.

### F-27 [P3] open - compat-job-runner retry and exhaustion branches lack tests

**File:** src/lib/compat-job-runner.test.ts:1
**Found:** 2026-09-03 by /audit (scope: full; lens: tests)
**Why it matters:** 3 tests / 10 assertions cover a 252-line runner whose retry state machine is exactly where wrong-answer bugs live. Untested: attempt exhaustion going terminal instead of RETRY_WAIT (compat-job-runner.ts:105), non-retryable errors going terminal, claim failure returning current status (:214), and PERSISTENCE_FAILED (:234).
**Suggested fix:** Add focused tests for the exhaustion matrix (retryable + max attempts, non-retryable, claim-loss, persistence failure), mirroring the stronger rawg-job-runner coverage where applicable.

### F-28 [P3] open - Fake timers restored as a trailing statement in recommendations tests

**File:** src/actions/recommendations.test.ts:1414
**Found:** 2026-09-03 by /audit (scope: full; lens: tests)
**Why it matters:** `vi.useRealTimers()` is the last line of the test (1414), not an `afterEach`. Any failure before it leaks frozen fake timers into the rest of the file, producing cascading failures that mask real regressions. `src/lib/itad-retry.test.ts:11-13` shows the correct pattern.
**Suggested fix:** Move timer restore into an `afterEach` (or try/finally) for the affected describe block.

### F-29 [P3] open - Small cleanups: unused imports, duplicate constant export, unneeded client directive

**File:** src/app/(app)/today/page.tsx:35
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** Five unused imports/vars reported by lint (today/page.tsx:35-36, CompatibilitySection.tsx:10, MetadataSection.tsx:2, RecommendationItemCard.tsx:67); `ABANDONED_RUN_MS` exported identically from two files with no cross-import (price-refresh.ts:16, wishlist-compat-sweep.ts:56); `SourceIcon.tsx` is pure presentational but marked `'use client'` (src/components/sources/SourceIcon.tsx:1). All trivial, all noise in review.
**Suggested fix:** One cleanup pass: delete the five unused bindings, keep a single source for `ABANDONED_RUN_MS`, drop the directive.

### F-30 [P3] open - steam-sync returns success:false with non-null data

**File:** src/actions/steam-sync.ts:62
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** Sole deviation from the `{ success, data: null, error }` action contract; every other failure path returns `data: null`. Callers keying on `data` on failure can be surprised.
**Suggested fix:** Return `data: null` and keep the counts in the SyncRun record (already persisted) or a diagnostics field.

### F-31 [P3] open - Line clamping implemented with inline styles in four card components

**File:** src/components/wishlist/WishlistCard.tsx:159
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `-webkit-line-clamp` is applied via inline `style` objects in WishlistCard.tsx:159, LibraryGameCard.tsx:189, PlayNextRailCard.tsx:118, RecommendationItemCard.tsx:125, while the standard says no inline styles and Tailwind ships `line-clamp-*` utilities.
**Suggested fix:** Replace with `line-clamp-2` / `line-clamp-3` classes.

### F-32 [P3] open - Wishlist create/update accepts any non-empty steamAppId string

**File:** src/actions/wishlist.ts:21
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** The manual-entry schemas validate `steamAppId` as `z.string().trim().min(1)` (lines 21, 35), while the identity flow enforces `/^\d{1,10}$/` (src/actions/wishlist-identity.ts:36). Downstream uses are URL-encoded (no injection), but malformed IDs can enter the same column through two doors.
**Suggested fix:** Reuse the identity flow's regex in the create/update schemas.

### F-33 [P3] open - Em dash in generated recommendation copy

**File:** src/lib/recommendations/recommendation-copy.ts:36
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** User-facing copy uses `" — "` as the separator (line 36) and the test suite locks the character in. The writing standard bans em dashes in generated content; trivial to keep consistent.
**Suggested fix:** Switch the separator to `": "` and update the four test assertions.

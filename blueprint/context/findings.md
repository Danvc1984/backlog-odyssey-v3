# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-16 [P3] fixed - Wishlist and library pages load unbounded rows including full RAWG payloads

**File:** src/app/(app)/wishlist/page.tsx:26
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** Both pages use `findMany` with no `take`; wishlist serializes each entry's full RAWG snapshot payload plus the whole base-game list into client components, and `readPendingRawgFollowUps` rescans batches on every status read (src/lib/rawg-batch-runner.ts:86). Fine at current scale, grows linearly and unbounded. Not confirmed as a defect: RSC payload sizes and query timing at realistic row counts were not measured at runtime.
**Suggested fix:** When it bites: select only card fields (strip payloads to needed keys) and cap or paginate lists. Track until measured.
**Resolution:** Re-checked 2026-09-03 by /audit (scope: full; lens: performance): code unchanged, still unbounded (`wishlist/page.tsx:43`, `library/page.tsx:175`). Same payload-scan pattern confirmed in more places (today/page.tsx:136,163; collections/[id]/page.tsx:119; detail payload to client in wishlist/[id]/page.tsx:270, tracked as F-20/F-24). Still unverified at runtime.
**Resolution:** 2026-09-03 by /implement: projected wishlist, library, and collection card metadata on the server, so only the fields consumed by cards cross the client boundary. Added unit coverage for both metadata view helpers; the full test suite, typecheck, lint, and Webpack build pass.

### F-17 [P2] fixed - RAWG and compatibility pipelines duplicate runner, batch, and action scaffolding

**File:** src/lib/rawg-job-runner.ts:70 (vs src/lib/compat-job-runner.ts:56)
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** The RAWG and compatibility enrichment pipelines are parallel implementations of the same machinery: identical `retryDelay` and retryable-error predicates, same claim-`updateMany`/RETRY_WAIT/terminal-update shapes, near-identical batch runners (`rawg-batch-runner.ts` vs `compat-batch-runner.ts`), ~85% line-for-line batch-start actions (`src/actions/rawg-batch-enrichment.ts:47-161` vs `compat-batch-enrichment.ts:50-158`), and run-record lifecycle copy-paste (`price-refresh.ts` vs `wishlist-compat-sweep.ts`, including a duplicated `ABANDONED_RUN_MS`). A retry or claim bug fixed in one pipeline will predictably be missed in the other.
**Suggested fix:** Extract one shared job-runner and one batch-sweep skeleton parameterized by provider and eligibility; share the run-record lifecycle helpers. Smallest useful first step: the identical job-runner helpers (retryDelay, retryable predicate, claim, terminal updates).
**Resolution:** 2026-09-03 by /fix (commit 79863d1): the job-runner layer is deduplicated - `src/lib/enrichment-job-shared.ts` now owns `jobRetryDelay`, the retryable predicate, the claim where-shape, and the RETRY_WAIT/terminal/SUCCEEDED update-data builders used by both runners, with its own unit tests. Remaining open scope: batch-start actions (~85% line-for-line), batch runners, and the price-refresh/wishlist-compat-sweep run-record lifecycle including the duplicated `ABANDONED_RUN_MS`.
**Resolution:** 2026-09-03 by /implement: shared batch-start, batch-runner, and run-record lifecycle helpers now serve both RAWG and compatibility flows while preserving provider-specific views and result shapes. Full tests, typecheck, lint, and Webpack build pass.

### F-18 [P2] fixed - updateRecommendations spans roughly 320 lines inside a 1282-line action module

**File:** src/actions/recommendations.ts:449
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `updateRecommendations` (lines 449-769) is one `$transaction` doing pruning, profile update, tune, calibration, exposure, play rerank, buy rerank, and snapshots, in a module that also carries 15 other exports. Far past the 50-line guideline and the hardest code in the app to change safely.
**Suggested fix:** Split the transaction body into named per-concern helpers in `src/lib/recommendations/` (calibration, exposure, rerank) with their own tests; keep the action as the guard + transaction wrapper.
**Resolution:** 2026-09-03 by /implement: moved the transaction pipeline into named orchestration and helper functions under `src/lib/recommendations/`; the action now retains only authentication, transaction wrapping, and error shaping. Existing recommendation tests pass without assertion changes.

### F-19 [P2] fixed - planMergeMutations spans roughly 327 lines in a 1131-line module

**File:** src/lib/catalog-operations.ts:804
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `planMergeMutations` (lines 804-1131) plans the entire merge mutation set in one function, and the module mixes snapshot envelopes, TTL/state, personal-field resolution, merge planning, and delete planning. Merge is the most destructive operation in the app; its planning code should be the easiest to read.
**Suggested fix:** Extract per-relationship planners (external IDs, availability, tags, collections, wishlist) into small functions beside it; no behavior change.
**Resolution:** 2026-09-03 by /implement: split the merge plan into per-relationship planners sharing a small context and snapshot pushers. The comprehensive catalog suites pass without assertion changes.


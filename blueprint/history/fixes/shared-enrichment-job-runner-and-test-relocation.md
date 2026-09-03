# Fix: shared enrichment job-runner helpers and test relocation

**Type:** Fix
**Fixes:** F-17, F-34

## The problem

- **F-17 (job-runner layer)** - `src/lib/rawg-job-runner.ts` and
  `src/lib/compat-job-runner.ts` independently implement the same retry state
  machine: identical `retryDelay` (70-72 vs 56-58), identical retryable-error
  predicate (62-68 vs 51-54), same claim `updateMany` where-shape
  (142-157 vs 189-201), same RETRY_WAIT update shape (119-129 vs 106-119),
  same terminal FAILED update (91-111 vs 78-98), same SUCCEEDED update shape
  (255-269 vs 238-251). A retry/claim bug fixed in one will be missed in the
  other.
- **F-34** - `src/actions/catalog-operations.test.ts` imports both the actions
  and the lib planning functions; the describes at lines 91-378
  (suggestSurvivor, resolvePersonalFields, planExternalIdUnion,
  planOneToOneConflicts, buildMergeProposal) test
  `src/lib/catalog-operations.ts` one layer below the file's name.

## The fix

- Create `src/lib/enrichment-job-shared.ts` (server-only) holding the pure,
  provider-independent pieces both runners share:
  - `jobRetryDelay(attempt)` - the exponential backoff.
  - `isRetryableJobProviderError(error: { category: string; status?: number })`
    - NETWORK, HTTP 429, HTTP 5xx.
  - `jobClaimWhere({ jobId, provider, maxAttempts, now })` - the claim filter
    including the hidden-game guard and QUEUED/RETRY_WAIT-due OR.
  - `jobRetryUpdateData({ progress, attempt, code, message })`,
    `jobTerminalUpdateData({ progress, code, message })`,
    `jobSuccessUpdateData({ progress })` - update-data builders; each runner
    spreads them and adds its own extras (rawg clears `candidatePayload`).
  Keep per-runner: provider selects, view mappers, progress mappings, the
  AMBIGUOUS/NOT_FOUND outcomes, provider calls, and persistence. The runners'
  update calls remain in place but consume the shared builders.
- Add a focused unit test file for the shared helpers (backoff boundaries,
  retryable matrix: 429 yes, 500 yes, 404 no, NETWORK yes, MALFORMED no;
  claim where shape).
- F-34: move the five pure-function describes from
  `src/actions/catalog-operations.test.ts` into
  `src/lib/catalog-operations.test.ts` verbatim (plus any fixtures they need).
  The actions test keeps the guarded action tests. Pure relocation.

Scope note: this session removes the duplicated retry/claim machinery - the
risk F-17 names. The batch-start action and batch-runner boilerplate
duplication remains open under F-17 and can be a follow-up session; do not
fold it into this diff.

Must not break: both runners' update payloads as asserted by their existing
tests (builders must produce byte-identical data objects), provider selects,
view mapping, and the catalog-operations test coverage.

## Build steps

1. [x] Create `src/lib/enrichment-job-shared.ts` with helpers + tests; rewire both
   runners to consume them.
   **Done when:** `retryDelay`/retryable/claim-where definitions exist in one
   place, both runner test files pass unmodified (or with only import-level
   adjustments), the new helper tests pass, and `pnpm typecheck`, `pnpm test`,
   `pnpm lint` are green.
2. [x] Relocate the five describes per F-34.
   **Done when:** the actions test file no longer imports the lib planning
   functions for those describes, the lib test file hosts them, total test
   count is unchanged, and the suite is green.

## Verify

- Automated: `pnpm typecheck`, `pnpm test`, `pnpm lint`, plus `pnpm build`.
- Manual: not applicable beyond the suite - this is a refactor with identical
  behavior; the enrichment panels still run jobs end-to-end in dev if desired.

## Findings

### shared-enrichment-job-runner-and-test-relocation/F-17 [P2] closed - RAWG and compatibility pipelines duplicate runner, batch, and action scaffolding

**File:** src/lib/rawg-job-runner.ts:70 (vs src/lib/compat-job-runner.ts:56)
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** The RAWG and compatibility enrichment pipelines are parallel implementations of the same machinery: identical `retryDelay` and retryable-error predicates (rawg-job-runner.ts:62-72 vs compat-job-runner.ts:51-58), same claim-`updateMany`/RETRY_WAIT/terminal-update shapes, near-identical batch runners (`rawg-batch-runner.ts` vs `compat-batch-runner.ts`), ~85% line-for-line batch-start actions (`src/actions/rawg-batch-enrichment.ts:47-161` vs `compat-batch-enrichment.ts:50-158`), and run-record lifecycle copy-paste (`price-refresh.ts` vs `wishlist-compat-sweep.ts`, including a duplicated `ABANDONED_RUN_MS`). A retry or claim bug fixed in one pipeline will predictably be missed in the other.
**Suggested fix:** Extract one shared job-runner and one batch-sweep skeleton parameterized by provider and eligibility; share the run-record lifecycle helpers. Smallest useful first step: the identical job-runner helpers (retryDelay, retryable predicate, claim, terminal updates).
**Resolution:** Extracted shared retry, claim, terminal, and success update helpers into `src/lib/enrichment-job-shared.ts`; batch and action scaffolding remain out of scope. Re-reviewed the changed runners and helper with the quality/tests audit; no remaining job-runner duplication or regression was found.

### shared-enrichment-job-runner-and-test-relocation/F-34 [P3] closed - Pure-function tests live in the actions-layer catalog-operations test file

**File:** src/actions/catalog-operations.test.ts:91
**Found:** 2026-09-03 by /audit (scope: full; lens: tests; test-count assessment)
**Why it matters:** The actions test imports both the actions and the lib planning functions, so the describes at lines 91-378 (suggestSurvivor, resolvePersonalFields, planExternalIdUnion, planOneToOneConflicts, buildMergeProposal) test `src/lib/catalog-operations.ts` one layer below the file's name. No case duplication with `src/lib/catalog-operations.test.ts` (different functions), so it is placement drift, not redundancy. Both files misstate what they cover.
**Suggested fix:** When touching this area (e.g., alongside an F-17-style cleanup), relocate those describes into `src/lib/catalog-operations.test.ts`. Pure relocation, no behavior change; not worth a standalone pass.
**Resolution:** Relocated the five pure-function describes and their fixtures to `src/lib/catalog-operations.test.ts`; action-layer tests retain guarded action coverage. Re-reviewed both test files and confirmed the five describes are only in the lib-layer file, with focused tests passing.

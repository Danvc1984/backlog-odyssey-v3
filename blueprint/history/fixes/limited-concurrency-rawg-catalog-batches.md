# Fix: Limited-concurrency RAWG catalog batches

**Type:** Fix
**Status:** review required

## The problem

Catalog-wide RAWG enrichment advanced one eligible job per batch request. The
library trigger ran every two seconds, so a large catalog waited for the
polling cadence plus each provider request one game at a time.

## The fix

The batch now advances up to five eligible RAWG jobs concurrently. The job
runner's atomic claim and retry state remain authoritative. Batch polling is
stable when visible progress changes, and terminal outcomes remain observable.

## Out of scope

- A RAWG bulk-detail API, request shape changes, or provider plan changes.
- More than five concurrent jobs, dynamic concurrency tuning, or a new queue
  worker.
- Database migrations, new Library controls, retry or cancellation UI, and
  changes to the prior failure-result panel.

## Build steps

- [x] Step 1 - Run a bounded group of ready jobs per batch advance.
- [x] Step 2 - Preserve retry behavior under provider rate limits.
- [x] Step 3 - Stabilize RAWG batch polling.
- [x] Step 4 - Raise and prove the five-game boundary.

## Verify

- Focused Vitest coverage for bounded parallel advancement, rate-limit retry,
  stable polling, and the five-game boundary.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, and
  `pnpm exec next build --webpack` passed.
- Manual `/library` verification showed stable polling, no duplicate
  enrichment, no retries, no console errors, and improved request totals.

## Manual evidence

- 61 / 73 requests.
- 40.0 kB / 151 kB transferred.
- 24.0 kB / 513 kB resources.

## Findings

No findings recorded.

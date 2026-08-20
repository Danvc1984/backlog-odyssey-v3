# Fix: Preserve pending RAWG follow-up lists

**Type:** Fix
**Status:** complete

## Problem

The Library displayed only the latest RAWG batch. A newer manual enrichment
could therefore hide unresolved match and failure lists left by a Steam import.

## Resolution

RAWG batch status now aggregates unresolved `AWAITING_MATCH` and `FAILED`
games across relevant batches, deduplicated by game ID. The Library panel
renders those combined lists while preserving the active batch progress.

## Verification

- `pnpm test` - 289 tests.
- `pnpm typecheck`.
- `pnpm lint`.
- `pnpm exec next build --webpack`.
- `git diff --check`.
- Manual Library verification confirmed import and manual pending lists remain
  visible together.

## Findings

No findings recorded.

# Fix: Correct RAWG matching and enable manual match selection

**Type:** Fix

## Delivered

- RAWG matching now uses title search and explicit selected RAWG IDs only.
- Added on-demand candidate review with pagination and selection.
- Simplified detail-page controls: automatic loading without a snapshot, `Choose another match` with an existing snapshot, and an auxiliary refresh button.

## Build steps

- [x] Fix RAWG match resolution and remove Steam App ID collision.
- [x] Allow manual match selection and candidate review on game detail.

## Verification

- `pnpm test` - 302 tests passed.
- `pnpm typecheck` - passed.
- `pnpm lint` - passed.
- `git diff --check` - passed.
- Manual review path: `/games/[id]`, RAWG enrichment panel, candidate selection, and auxiliary refresh.

## Findings

Unresolved findings `F-01` (P2) and `F-02` (P3) remain in the active ledger.

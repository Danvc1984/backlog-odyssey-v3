# Fix: SyncRun crash recovery, disconnect/sync race, and sync route auth order

**Type:** Fix
**Fixes:** F-08, F-09, F-06

## The problem

Steam sync could leave `SyncRun` records stuck in `RUNNING` after a crash, the
Disconnect button could be used during an active sync, and the sync route read
`AppSettings` before authenticating the request.

## The fix

- Created and finalized `SyncRun` records atomically with availability writes.
- Disabled Disconnect while importing or syncing.
- Authenticated before reading application settings in the sync route.

## Build steps

- [x] Atomic SyncRun lifecycle, including the empty-games failure path.
- [x] Disconnect race prevention and sync route authentication order.

## Verify

- `pnpm typecheck` passed.
- `pnpm test` passed: 82 tests.
- `pnpm exec next build --webpack` passed.
- `pnpm lint` remains blocked by unrelated P2 finding F-04.

## Findings

### sync-run-crash-recovery/F-03 [P2] invalid - Uncommitted changes to 5 files since last commit

**Found:** 2026-08-13 by `/audit` (scope: full)
**Resolution:** Re-examined by `/audit` on 2026-08-17. The original working-tree condition was no longer present.


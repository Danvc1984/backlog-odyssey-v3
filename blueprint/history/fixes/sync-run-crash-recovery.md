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
- `pnpm lint` passed with 0 errors after F-04 fix was applied in a separate commit.

## Findings

### sync-run-crash-recovery/F-03 [P2] invalid - Uncommitted changes to 5 files since last commit

**Found:** 2026-08-13 by `/audit` (scope: full)
**Resolution:** Re-examined by `/audit` on 2026-08-17. The original working-tree condition was no longer present.

### sync-run-crash-recovery/F-06 [P2] closed - Steam sync reads settings before authenticating

**Found:** 2026-08-17 by `/audit` (scope: full)
**Why it matters:** An unauthenticated POST could cause a database read before `requireUser()` ran, violating the project rule that every protected server entry point authenticates before accessing application data.
**Resolution:** `requireUser()` moved before the `AppSettings` query in `src/app/api/steam/sync/route.ts`. Closed by `/audit` re-review 2026-08-17 (scope: current). Original defect confirmed gone, no new issue introduced.

### sync-run-crash-recovery/F-08 [P2] closed - SyncRun left in RUNNING status if process crashes after transaction

**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** The `syncRun.update()` ran outside the transaction, leaving a crash window between commit and status write.
**Resolution:** SyncRun create + terminal status updates moved inside the `$transaction` so they commit atomically with availability writes. Closed by `/audit` re-review 2026-08-17 (scope: current). Original defect confirmed gone. A new finding (F-10) was raised for the catch-block's assumption about the committed row.

### sync-run-crash-recovery/F-09 [P3] closed - Disconnect button not disabled during sync

**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** Disconnect could be clicked while a sync was in flight, causing mid-operation failures.
**Resolution:** Added `syncing` to the Disconnect button's `disabled` prop in `src/components/steam/SteamConnectionCard.tsx:114`. Closed by `/audit` re-review 2026-08-17 (scope: current). Original defect confirmed gone.


# Feature: Playtime and recent sync

**From build-plan:** feature 6c
**Status:** not started

## Goal

Sync playtime and last-played timestamps from Steam for already-imported games,
log each run to `SyncRun`, and expose a daily cron endpoint gated by
`AppSettings.steamDailySyncEnabled`. A manual "Sync now" button on Settings
triggers the same action.

## Design reference

None (no visual target).

## In scope

- `syncSteamPlaytime()` server action: fetches owned games from Steam API,
  updates `steamPlaytimeTotal` and `steamLastPlayed` on existing
  `GameAvailability` rows (source=STEAM) matched by `ExternalGameId`
  (namespace=STEAM_APP), creates a `SyncRun` row with provider=STEAM,
  counts, and status
- `POST /api/steam/sync` route handler: auth-guarded cron endpoint, calls
  `syncSteamPlaytime()`, gated by `AppSettings.steamDailySyncEnabled`
- Manual "Sync now" button on `SteamConnectionCard` that calls
  `syncSteamPlaytime()` and shows result toast
- Unit tests for the sync action logic

## Out of scope

- Importing new games (stays in `importSteamGames`)
- Vercel cron config (`vercel.json`) - deferred to feature 18 (Deployment)
- Displaying playtime or last-played in the UI beyond what already exists
- ITAD, ProtonDB, or other provider syncs
- Retry logic or exponential backoff for Steam API failures

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - syncSteamPlaytime server action** - Create `src/actions/steam-sync.ts`
  with `syncSteamPlaytime()`. Reads `SteamConnection` singleton and
  `STEAM_WEB_API_KEY`, calls `fetchOwnedGames()`, then in a transaction:
  for each game, looks up `ExternalGameId` by (STEAM_APP, appid), if found
  updates the matching `GameAvailability` row's `steamPlaytimeTotal` and
  `steamLastPlayed`, if not found skips it (this is sync, not import).
  Creates a `SyncRun` (provider=STEAM) at start with status=RUNNING, updates
  to SUCCESS/FAILED/PARTIAL at end with counts `{ synced, skipped, failed }`
  and diagnostics. Returns `{ success, data, error }`.
  *Done when:* the action compiles, unit tests pass for happy path (updates
  existing games), skip path (unknown appid), error path (Steam API failure),
  and disconnected path.

- [x] **Step 2 - cron endpoint** - Create `POST /api/steam/sync/route.ts`.
  Reads `AppSettings` singleton, returns early if
  `steamDailySyncEnabled` is false. Calls `requireUser()` (same auth guard as
  other protected endpoints), then calls `syncSteamPlaytime()` and returns
  the result as JSON.
  *Done when:* hitting `POST /api/steam/sync` with a valid session returns
  the sync result; hitting it with `steamDailySyncEnabled=false` returns a
  skip message; unauthenticated requests get rejected.

- [x] **Step 3 - manual sync button** - Add a "Sync now" button to
  `SteamConnectionCard.tsx` that calls `syncSteamPlaytime()`. Shows loading
  state, success toast with count ("Synced X games"), and error toast on
  failure. Only visible when connected. Reposition the existing "Import from
  Steam" button so Sync and Import are both accessible but clearly distinct
  (Sync = refresh playtime, Import = bring in new games).
  *Done when:* clicking "Sync now" on Settings triggers the action, shows the
  result toast, and does not create duplicate games.

- [x] **Step 4 - include Steam imports in the library** - Update
  `importSteamGames()` so new and already-imported Steam games always have a
  `LibraryEntry`. Backfill the entry when the existing `ExternalGameId` path
  finds a game that is missing one.
  *Done when:* running Steam import makes imported games appear in `/library`,
  existing games without a `LibraryEntry` are backfilled, and repeated imports
  do not create duplicate library entries.

## Files / areas

- `src/actions/steam-sync.ts` (new) - sync action
- `src/actions/steam-sync.test.ts` (new) - unit tests
- `src/app/api/steam/sync/route.ts` (new) - cron endpoint
- `src/components/steam/SteamConnectionCard.tsx` (modify) - add sync button
- `src/actions/steam-import.ts` (read-only reference) - pattern to follow

## Data / contracts

- `SyncRun` model: `provider=STEAM`, `status` in (RUNNING, SUCCESS, FAILED,
  PARTIAL), `counts: { synced: number, skipped: number, failed: number }`,
  `diagnostics: { error?: string }` (load-bearing: future provider syncs
  will follow this same shape)
- `GameAvailability.steamPlaytimeTotal` (BigInt, minutes) and
  `steamLastPlayed` (DateTime, from `rtime_last_played` Unix timestamp) -
  existing fields, updated in place
- `AppSettings.steamDailySyncEnabled` (Boolean) - existing field, now wired
  to the cron endpoint gate

## Testing

- Vitest is configured and the test gate is on.
- **In-scope logic to test:**
  - `syncSteamPlaytime()` - happy path (updates existing games), skip path
    (unknown appid not imported), error path (Steam API returns empty),
    disconnected path (no SteamConnection), missing API key path
  - `lastPlayedDate()` helper (reuse from `steam-import.ts` or extract to
    shared util)
- **Not unit-tested (UI/integration):**
  - Sync button rendering and toast behavior - verified via browser
  - Cron endpoint auth and gate behavior - verified via browser/curl

## Notes for the AI

- Follow the existing `{ success, data, error }` return pattern from
  `importSteamGames()`.
- Reuse `fetchOwnedGames()` from `src/lib/steam-api.ts` and
  `requireUser()` from `src/lib/auth-guard.ts`.
- The `lastPlayedDate()` helper in `steam-import.ts` converts Unix timestamps
  to Date. Extract it to a shared location or duplicate it; extraction is
  preferred to avoid drift.
- `SyncRun` has no foreign key to `SteamConnection` - it's a standalone log.
  The `provider` field (STEAM) ties them conceptually.
- The cron endpoint uses `requireUser()` for now. When Vercel cron is set up
  in feature 18, this will need a cron secret header check instead; note this
  as a follow-up.
- Do not create new games during sync. If a Steam appid has no matching
  `ExternalGameId`, skip it. Import is `importSteamGames()`'s job.
- `steamPlaytimeTotal` is `BigInt` in Prisma but comes from Steam as a
  plain number (minutes). Cast with `BigInt()`.

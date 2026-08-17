# Feature: Owned game import (6b)

**From build-plan:** feature 6b
**Status:** not started

## Goal

Import the owner's Steam-owned games into the local catalog. Each game becomes a
`Game` (origin `STEAM_IMPORT`) linked to an `ExternalGameId` (namespace
`STEAM_APP`, external ID = the Steam App ID) and a `GameAvailability` row with
playtime and last-played data. Re-importing is idempotent: exact App ID match
means no duplicates, only playtime/last-played are refreshed.

## In scope

- `src/lib/steam-api.ts` - pure fetch wrapper for the Steam Web API
  `GetOwnedGames` endpoint; normalizes the response into typed records
- `src/lib/steam-api.test.ts` - unit tests with mocked `fetch` (happy, empty,
  missing API key, Steam error)
- `src/actions/steam-import.ts` - server action `importSteamGames()` that:
  1. Reads `SteamConnection.steamId64` (returns error when disconnected)
  2. Reads `STEAM_WEB_API_KEY` from env (returns error when missing)
  3. Calls the Steam API, then in a transaction:
     - Skips games that already exist (matched by `ExternalGameId` on
       namespace `STEAM_APP` / `externalId = appid`): only updates
       `GameAvailability.steamPlaytimeTotal` and `steamLastPlayed`
     - Creates new `Game` (origin `STEAM_IMPORT`, type `BASE_GAME`) +
       `ExternalGameId` (namespace `STEAM_APP`, externalId `appid`,
       matchMethod `EXACT_STEAM_APP_ID`) + `GameAvailability` (source `STEAM`,
       `steamAppId`, `steamPlaytimeTotal`, `steamLastPlayed`) for games not yet
       in the catalog
  4. Returns `{ success, data: { imported, updated }, error }`
- `src/actions/steam-import.test.ts` - unit tests for the action (mocked
  prisma and Steam API): happy path, already-connected, disconnected error,
  missing API key error
- Settings page: "Import from Steam" button (visible only when SteamConnection
  exists), shows import result toast after success

## Out of scope

- LibraryEntry creation for imported games - deferred; imported games appear in
  the library once a LibraryEntry is manually created (or 6c adds a sync step)
- Dedup against manually created games - manual games don't have an
  `ExternalGameId` with `STEAM_APP`, so they won't conflict; possible duplicate
  detection is feature 7
- Playtime delta/change tracking - only last-known values are stored; change
  history deferred to 6c's SyncRun logging
- Free-to-play games where `playtime_forever = 0` and
  `has_community_visible_stats = false` - excluded by the Steam API by default
  (`include_played_free_games=1` is not passed)
- Game artwork/icon URL from Steam - the `img_icon_url` is a Steam CDN asset;
  no local artwork storage yet

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Steam API client** - create `src/lib/steam-api.ts` exporting a
  `fetchOwnedGames(steamId64: string, apiKey: string)` async function. It calls
  `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=KEY&steamid=STEAMID64&include_appinfo=1&format=json`
  and returns `{ appid: number, name: string, playtimeForever: number, rtimeLastPlayed: number }[]`.
  Returns empty array on Steam error or missing data rather than throwing. Uses
  `cache: "no-store"` so the call is never stale. *Done when:* `pnpm test` passes with
  tests for happy response (parsed correctly), empty game list, Steam API error
  (returns empty), and malformed response.

- [x] **Step 2 - Import server action** - create `src/actions/steam-import.ts`
  with `importSteamGames()`. Calls `requireUser()`, reads `SteamConnection` (id=1),
  reads `STEAM_WEB_API_KEY` from `process.env`, calls `fetchOwnedGames`, then in
  a single `prisma.$transaction`:
  - For each game: looks up `ExternalGameId` with `namespace="STEAM_APP"` and
    `externalId=String(appid)`. If found: update the linked `GameAvailability`
    row's `steamPlaytimeTotal` and `steamLastPlayed`. If not found: create a
    `Game` (`origin="STEAM_IMPORT"`, `type="BASE_GAME"`, name from API),
    `ExternalGameId` (`namespace="STEAM_APP"`, `externalId=String(appid)`,
    `matchMethod="EXACT_STEAM_APP_ID"`), and `GameAvailability`
    (`source="STEAM"`, `steamAppId=String(appid)`, playtime + last-played).
  - Updates `SteamConnection.lastSyncAt` to now and `counts` to
    `{ imported, updated }`.
  - Returns `{ success, data: { imported, updated }, error }`.
  *Done when:* `pnpm test` passes with tests for: creates new game+external
  id+availability when not already imported; updates playtime when already
  imported; returns error when disconnected; returns error when API key missing.

- [x] **Step 3 - Settings import button** - add an "Import from Steam" button to
  the `SteamConnectionCard.tsx` component. Visible only when `connected` is true.
  Click calls `importSteamGames()`, shows a loading state, then a toast: "Imported
  N new games, updated M existing" on success, or the error message on failure.
  The button replaces the disconnect button's position or sits next to it. Use the
  existing `Import` icon from lucide-react. *Done when:* `/settings` shows the
  button when connected; clicking it triggers the import and shows the result
  toast; the button is not visible when disconnected.

## Files / areas

- `src/lib/steam-api.ts` - Steam Web API fetch wrapper (step 1)
- `src/lib/steam-api.test.ts` - unit tests (step 1)
- `src/actions/steam-import.ts` - import action (step 2)
- `src/actions/steam-import.test.ts` - unit tests (step 2)
- `src/components/steam/SteamConnectionCard.tsx` - add import button (step 3)

## Data / contracts

- `Game` fields set on import: `type="BASE_GAME"`, `origin="STEAM_IMPORT"`, `name`
  (from Steam API). Other fields (`baseGameId`, etc.) are null.
- `ExternalGameId` fields: `namespace="STEAM_APP"`, `externalId` (the Steam App ID
  as a string), `namespaceId=String(appid)` (the App ID, used as the general
  namespace-scoped identifier), `matchMethod="EXACT_STEAM_APP_ID"`. The
  `@@unique([namespace, externalId])` constraint provides idempotency.
- `GameAvailability` fields: `source="STEAM"`, `steamAppId` (the App ID string),
  `steamPlaytimeTotal` (BigInt, minutes from Steam API), `steamLastPlayed` (DateTime
  from `rtime_last_played` Unix timestamp), `displayName` (null for Steam games).
- `SteamConnection.counts` JSON: `{ imported: number, updated: number }` after each
  import run.
- `STEAM_WEB_API_KEY` env var: required for this feature. The action checks
  `process.env.STEAM_WEB_API_KEY` and returns a clear error when unset.

## Testing

- **Unit tests (Vitest):** `fetchOwnedGames` (happy/empty/error/malformed - mocked
  fetch). `importSteamGames` (happy create, already-existing updates playtime,
  disconnected error, missing API key error - mocked prisma and Steam API). Test
  files next to source.
- **Browser verification:** sign in, connect Steam (from 6a), click "Import from
  Steam", verify toast shows count. Visit `/library` to confirm games appear (they
  will only if LibraryEntry exists - note this in the result).

## Notes for the AI

- The Steam Web API key goes in `.env` as `STEAM_WEB_API_KEY`. Add it to
  `.env.example` with a placeholder comment.
- `GameAvailability.steamPlaytimeTotal` is a `BigInt` in Prisma (minutes as
  received from Steam). Store it directly; display formatting is a UI concern.
- `rtime_last_played` from Steam is a Unix timestamp in seconds. Convert with
  `new Date(rtimeLastPlayed * 1000)`.
- The `@@unique([namespace, externalId])` on `ExternalGameId` is the idempotency
  key. Use `findUnique({ where: { namespace_externalId: { namespace: "STEAM_APP",
  externalId: String(appid) } } })` to look up existing games before creating.
- The import runs inside `prisma.$transaction` so all games are imported atomically.
  If one fails, the whole batch rolls back. This is intentional for now; batch
  error handling (skip failures) is a future enhancement.
- `fetchOwnedGames` returns an empty array on Steam errors rather than throwing.
  The action treats this as `{ imported: 0, updated: 0 }` success, not an error,
  so the user sees "Imported 0 games" rather than a failure.
- Follow the existing action pattern: `requireUser()`, `{ success, data, error }`.

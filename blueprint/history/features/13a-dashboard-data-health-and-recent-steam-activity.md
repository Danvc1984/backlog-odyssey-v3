# Feature: Dashboard data health and recent Steam activity

**From build-plan:** feature 13a
**Status:** complete

## Goal

Build the data layer behind the Today dashboard and its first new section:
active-backlog progress excluding abandoned games, separate RAWG-metadata and
recommendation-profile coverage counts, and a persisted 24-hour recent Steam
activity cache filled by one narrow Steam call when Today loads. Recent titles
split into imported and unimported; unimported titles get an explicit
manual-sync suggestion. The narrow query never imports, mutates catalog
records, or performs a full sync.

## Design reference

None. Functional UI under the current look; feature 14 owns visual redesign.

## In scope

- New singleton model `SteamRecentActivityCache` (per the planned 13a model in
  `project-overview.md`): recent Steam entries (app ID, title, last-played
  time, accumulated playtime), successful refresh time, last attempt time, and
  the latest safe failure detail.
- One narrow Steam Web API call (`IPlayerService/GetRecentlyPlayedGames`) with
  tolerant parsing and a discriminated OK/UNAVAILABLE result, following the
  existing `fetchSteamWishlist` pattern.
- Cache refresh logic: attempt at most once every 24 hours keyed on the last
  attempt (success or failure); a claimed attempt is written before the fetch
  so parallel page loads cannot double-fire; entries capped at 10
  deterministically; failures keep previous entries and record a safe error
  detail (never the API key or full request URLs).
- Imported/unimported classification of recent titles by Steam App ID against
  the canonical catalog identity (`ExternalGameId` namespace `STEAM_APP`,
  same join the compatibility queue uses).
- A "Recent Steam activity" section on `/today` with four states: no
  connection (quiet hint linking to Settings), fresh with entries (imported
  and unimported titles, manual-sync suggestion for unimported), fresh-empty,
  and stale-on-error (previous entries retained with the failure note).
- Data-health computation in `src/lib/today-data-health.ts` (loader + pure
  functions, unit-tested, not yet rendered):
  - Active-backlog progress: universe is visible (non-hidden) base games with
    play state `NOT_STARTED`, `IN_PROGRESS`, or `PLAYED_BEFORE`; `ABANDONED`
    is excluded from both numerator and denominator; progress = started
    (`IN_PROGRESS` or `PLAYED_BEFORE`) over total.
  - RAWG-metadata coverage: visible base games with any `MetadataSnapshot`
    row where provider is `RAWG` over the same universe.
  - Recommendation-profile coverage: visible base games, complete when
    interest is present AND at least one of non-`NONE` priority, preferred
    environment, or game experience is present; rating never counts; the
    default play state neither helps nor hurts (the definition from
    `project-overview.md`).
- Unit tests for all new logic (Vitest gate is on).

## Out of scope

- Rendering the coverage counts on Today and the click-open coverage dialogs
  with paginated game titles (feature 13b). This feature delivers the loaders
  and their shapes only.
- Full Today composition: main/in-progress block, offers, provider freshness,
  and operation status (13b).
- Any visual redesign (feature 14).
- Full library sync, `SyncRun` or `EnrichmentJob` writes, and any use of
  `GetOwnedGames`; the narrow query writes only the cache singleton.
- Automatic imports of unimported titles; the suggestion links to the existing
  manual sync on Settings and stops there.
- Background scheduling or cron for the narrow fetch; it refreshes only when
  Today loads and the 24-hour gate is passed. `steamDailySyncEnabled` is not
  consulted.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Schema and migration** - Add the `SteamRecentActivityCache`
  singleton to `prisma/schema.prisma` following the `WallpaperState` pattern
  (`id Int @id @default(1)`, `entries Json?`, `refreshedAt DateTime?`,
  `lastAttemptAt DateTime?`, `lastError String?`, timestamps) and run
  `pnpm prisma:migrate` with name `add_steam_recent_activity_cache`. No
  relations; it never references catalog tables. *Done when:* the migration
  applies cleanly, the generated client exposes the model, and
  `pnpm typecheck` is green.
- [x] **Step 2 - Narrow recent-activity fetch** - In `src/lib/steam-api.ts`
  add `fetchRecentlyPlayedGames(steamId64, apiKey, fetchFn = fetch)` hitting
  `IPlayerService/GetRecentlyPlayedGames/v0001/` with `cache: "no-store"` and
  the existing timeout helper. Return a discriminated
  `{ status: "OK"; games: RecentSteamGame[] } | { status: "UNAVAILABLE" }`.
  Tolerant parse per the contract below: keep entries with a valid integer
  appid and non-empty name, tolerate missing `playtime_2weeks` and
  `rtime_last_played`, skip malformed entries, treat a private profile or
  missing `games` array as OK with an empty list, and any HTTP or parse
  failure as UNAVAILABLE. *Done when:* `steam-api.test.ts` covers the full
  entry shape, missing-field tolerance, malformed-entry skipping,
  private-profile OK-empty, non-OK status, and malformed JSON;
  `pnpm test` green.
- [x] **Step 3 - Cache refresh and view logic** - New
  `src/lib/steam-activity.ts`: constants `ACTIVITY_REFRESH_INTERVAL_MS` (24h)
  and `RECENT_ACTIVITY_MAX_ENTRIES` (10); a Zod schema for stored entries with
  tolerant `safeParse` reads (unknown JSON reads as an empty list, never a
  thrown error); pure `isActivityRefreshDue(cache, now)` (due when
  `lastAttemptAt` is null or older than 24h); pure `capRecentEntries`
  (dedupe by appid, sort last-played desc with nulls last then name asc, cap
  10); `refreshSteamActivityCacheIfStale()` that returns the view and never
  throws: no `SteamConnection` row or no API key returns the
  `NO_CONNECTION`-based view without touching the row; when due it first
  upserts `lastAttemptAt = now` to claim the attempt, then on OK stores the
  capped entries with `refreshedAt` and clears `lastError`, on UNAVAILABLE
  keeps previous entries and sets a safe `lastError`; pure
  `classifyRecentEntries(entries, importedAppIds)` preserving order; pure
  `buildSteamActivityView(cache, importedAppIds)` producing the
  `SteamActivityView` contract below. *Done when:* `steam-activity.test.ts`
  proves due/not-due, claim-before-fetch (the pre-fetch write), success
  writing entries and clearing the error, failure retaining entries with the
  error set, the no-connection path writing nothing, dedupe/sort/cap, and
  every view state; `pnpm test` green.
- [x] **Step 4 - Data-health loader and coverage functions** - New
  `src/lib/today-data-health.ts`: one slim universe query (visible base games
  selecting only the fields below) feeding pure `computeActiveBacklogProgress`,
  `computeRawgCoverage`, and `computeProfileCoverage` per the definitions in
  In scope, plus `loadTodayDataHealth()` returning the
  `TodayDataHealth` contract below. *Done when:* `today-data-health.test.ts`
  covers abandoned exclusion from both sides, hidden exclusion, the
  started-over-total math, RAWG covered/total, and the full
  profile-complete matrix (interest absent; interest with all three absent;
  each of non-`NONE` priority, environment, experience completing it alone;
  `NONE` priority and rating counting for nothing); `pnpm test` green.
- [x] **Step 5 - Recent Steam activity section on Today** - New
  `src/components/today/RecentSteamActivity.tsx` (server-rendered, no client
  component) and wiring in `src/app/(app)/today/page.tsx` after the header:
  call the refresh, build the view, render per state. Fresh-with-entries
  lists imported and unimported titles with a visual distinction; unimported
  titles carry the explicit suggestion "sync from Settings" linking to
  `/settings` (the Steam connection card); stale-on-error keeps entries with
  the failure note and last-checked time; fresh-empty shows a quiet empty
  line; no-connection shows a hint linking to Settings. Last-played dates use
  a local `formatDate` helper like `PriceRefreshPanel`. No new server actions.
  *Done when:* manual walkthrough shows each state correctly, unimported
  titles never appear imported, and `pnpm build` is green.
- [x] **Step 6 - Verification** - Run `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, and `pnpm prisma migrate status`. Manual pass:
  load `/today` with Steam connected and confirm imported/unimported titles
  classify correctly; reload within 24 hours and confirm no second provider
  call; simulate a provider failure (revoke or break the key) and confirm the
  stale-on-error state retains old entries without touching catalog data;
  confirm a fresh-empty profile and the no-connection hint. *Done when:* all
  commands are green and every observation holds.

## Files / areas

- `prisma/schema.prisma` + new migration: `SteamRecentActivityCache`
- `src/lib/steam-api.ts` (+ `steam-api.test.ts`): narrow fetch
- `src/lib/steam-activity.ts` (+ test): refresh gate, cache writes, view
- `src/lib/today-data-health.ts` (+ test): coverage and progress functions
- `src/app/(app)/today/page.tsx`, `src/components/today/RecentSteamActivity.tsx`:
  activity section

## Data / contracts

Load-bearing for 13b - do not reshape later without revisiting the plan:

- `SteamActivityView`:
  `{ state: "NO_CONNECTION" | "FRESH" | "FRESH_EMPTY" | "STALE_ERROR";
  imported: SteamActivityEntry[]; unimported: SteamActivityEntry[];
  checkedAt: Date | null; errorMessage: string | null }` where an entry is
  `{ steamAppId: string; name: string; lastPlayedAt: string | null;
  playtimeForeverMinutes: number; playtimeTwoWeeksMinutes: number | null }`.
- `TodayDataHealth`:
  `{ activeBacklog: { started: number; total: number };
  rawgMetadata: { covered: number; total: number };
  recommendationProfile: { complete: number; total: number } }`. The universes
  (visible base games) are fixed by the overview's coverage definitions; 13b's
  dialogs paginate over the same populations.
- Stored `entries` JSON is an array of the entry shape above (ISO strings for
  dates). Reads are tolerant: unparseable or unknown-shape JSON reads as an
  empty list.
- Imported classification joins `ExternalGameId` on
  `{ namespace: "STEAM_APP", externalId: steamAppId }` - the same identity the
  compatibility queue uses.

## Testing

- Vitest gate is on (`pnpm test`). In-scope logic with required tests:
  - `fetchRecentlyPlayedGames`: response parsing, tolerance, failure
    discrimination (Step 2).
  - Cache gate, claim-before-fetch, success/failure writes, dedupe/sort/cap,
    classification, view states (Step 3).
  - The three coverage/progress pure functions including exclusion and
    completeness matrices (Step 4).
- UI state rendering rides on the Step 5/6 manual walkthrough plus
  `pnpm build`.

## Notes for the AI

- Everything here is server-side; the Today page is a server component and
  existing Today queries read Prisma directly without a user filter (single
  user). Follow that pattern; no new client components or server actions.
- The narrow query writes only `steamRecentActivityCache`. Never create or
  update `Game`, `GameAvailability`, `LibraryEntry`, `SyncRun`,
  `EnrichmentJob`, or `UnresolvedSteamDlc` from this path.
- `refreshSteamActivityCacheIfStale` must catch its own failures and always
  return a view - a provider outage can never break the Today render.
- `lastError` is a safe detail: short message and HTTP status at most; never
  the API key, never full URLs containing the key.
- Playtimes are minutes (plain numbers), not BigInt; BigInt is only for
  `GameAvailability.steamPlaytimeTotal`.
- Steam-API tests inject a fake `fetchFn` (see `fetchSteamWishlist`) and mock
  `@/lib/prisma` plus `server-only` following `compat-queue.test.ts`.
- Use the generated Prisma enums (`PlayState`, `Priority`, `Environment`,
  `GameExperience`) rather than string literals where types allow.
- Migration via `pnpm prisma:migrate`; keep the name from Step 1.

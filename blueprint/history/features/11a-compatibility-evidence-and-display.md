# Feature: Compatibility evidence and display

**From build-plan:** feature 11a (first sub-item of 11)
**Status:** complete

## Goal

Show per-environment compatibility evidence (Bazzite, Steam Deck, Windows) on
every game detail page, sourced from ProtonDB, Deck Verified, and AreWeAntiCheatYet.
Games without a Steam AppID get a manual entry affordance. ROM-only games are
exempt. Personal overrides let the user disagree with provider evidence.

## In scope

- ProtonDB API client (unofficial summary endpoint, `fetchFn` injection for tests)
- Steam Deck Verified API client (scrapes store page HTML for compat info,
  graceful fallback to ProtonDB-only when unavailable)
- AreWeAntiCheatYet API client (public `games.json` dataset)
- Evidence synthesis into `EnvironmentCompatibility` rows per environment
- Manual Steam AppID entry on game detail (writes `ExternalGameId`, reuses
  `parseSteamAppIdInput`)
- ROM-only exemption (no lookup, display "N/A")
- Implicit Windows fallback (READY unless AWAY anti-cheat denied)
- Compatibility section on game detail page with per-environment badges,
  evidence attribution, anti-cheat warnings, and freshness indicator
- Per-game manual refresh action (queues `EnrichmentJob` per provider, retries,
  progress)
- Personal override UI (`compatOverrideStatus`/`compatOverrideReason` on
  `LibraryEntry`)
- 180-day freshness window on `CompatibilitySnapshot.expiresAt`
- Retry states using existing `EnrichmentJob` model (QUEUED/RUNNING/RETRY_WAIT/
  SUCCEEDED/FAILED)

## Out of scope

- Post-RAWG auto-queue for compatibility (deferred to 11b)
- Global compatibility sweep from settings (deferred to 11b)
- Batch progress UI (deferred to 11b)
- Recommendation engine integration (feature 12)
- Today dashboard compatibility warnings (feature 13)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Manual Steam AppID entry on game detail** - Server action
  `setCatalogSteamAppId` that writes an `ExternalGameId` row with
  `namespace: "STEAM_APP"` and `matchMethod: "EXACT_STEAM_APP_ID"` for a
  catalog game. Reuses `parseSteamAppIdInput` from `src/lib/steam-identity.ts`.
  Rejects if another game already owns that AppID. UI affordance on the game
  detail page: when no `STEAM_APP` identity exists, show an inline form (input +
  button) near the availability section. On success, the page re-renders showing
  the confirmed identity. *Done when:* pasting a Steam URL or bare AppID
  persists the identity, a duplicate-AppID conflict is rejected with a clear
  message, and the affordance disappears once an identity exists.

- [x] **Step 2 - ProtonDB and Deck Verified API clients** - Two server-only
  modules in `src/lib/`: `protondb-api.ts` and `deck-verified-api.ts`. Each
  exports a typed result, a provider error type matching the
  `{ category, message, status? }` convention, and a lookup function accepting
  `fetchFn` for testability. ProtonDB hits
  `https://www.protondb.com/api/v1/reports/summaries/{appId}.json` and maps
  `confidence` + `tier` to `CompatibilityStatus`. Deck Verified scrapes the
  Steam store page HTML (`https://store.steampowered.com/app/{appId}`) for the
  Deck compatibility badge (the `data-deckcompatibility` attribute or the
  "Steam Deck Compatibility" section). If the page is unavailable or the game
  has no Deck status, returns `null` (not an error). Both return `null` when the
  game is not found. Unit tests cover tier/category mapping, not-found, network
  error, and malformed response. *Done when:* both modules export typed lookup
  functions with passing tests for every mapping branch and error path.

- [x] **Step 3 - AWAY anti-cheat client and synthesis logic** - `away-api.ts`
  in `src/lib/` fetches the public AreWeAntiCheatYet dataset from
  `https://raw.githubusercontent.com/AreWeAntiCheatYet/AreWeAntiCheatYet/master/games.json`
  (cached in memory with a 24-hour TTL, refreshed when stale). Matches by
  `storeIds.steam` field (string AppID). Maps statuses: `Supported`/`Running` ->
  no override, `Denied`/`Broken` -> override all environments to `REQUIRED`,
  `Planned` -> warning context only. `compat-synthesis.ts` in `src/lib/`
  implements `synthesizeCompatibility()`: takes ProtonDB result, Deck Verified
  result, AWAY result, and game metadata; returns per-environment
  `CompatibilityStatus` + source attribution. Rules: Bazzite = ProtonDB primary,
  Deck Verified fallback; Steam Deck = Deck Verified primary, ProtonDB fallback;
  Windows = `READY` unless AWAY `Denied`/`Broken`; no data = `UNKNOWN`. AWAY
  `Denied`/`Broken` overrides all to `REQUIRED`. Unit tests cover every
  synthesis branch, the override cascade, and the no-data case. *Done when:*
  synthesis produces correct `EnvironmentCompatibility` rows for all input
  combinations with passing tests.

- [x] **Step 4 - Compatibility persistence and per-game refresh action** -
  `compat-refresh.ts` in `src/lib/` orchestrates a per-game compatibility
  refresh: looks up the game's Steam AppID from `ExternalGameId`, calls all
  three API clients, runs synthesis, upserts `CompatibilitySnapshot` (one per
  provider, `expiresAt` = now + 180 days) and `EnvironmentCompatibility` (one
  per environment) in a transaction. Uses `EnrichmentJob` with provider
  `PROTONDB` as the job tracker (the other providers are fast enough to run
  inline within the same job). Job lifecycle: QUEUED -> RUNNING -> SUCCEEDED/
  FAILED, with RETRY_WAIT for retryable errors (network, 429, 5xx), max 3
  attempts, exponential backoff matching the RAWG pattern. Server action
  `refreshGameCompatibility` in `src/actions/compatibility.ts` creates the job
  and kicks the runner. `runCompatJob(jobId)` in `src/lib/compat-job-runner.ts`
  claims and executes. Unit tests cover the synthesis-to-persistence path, job
  lifecycle transitions, and retryable vs terminal errors. *Done when:* calling
  the refresh action for a game with a Steam AppID creates snapshots and
  environment rows, and a transient failure triggers a retry.

- [x] **Step 5 - Compatibility section on game detail page** - New
  `CompatibilitySection` component in `src/components/games/`. The game detail
  page loads `compatSnapshots`, `envCompat`, and the `ExternalGameId` identity
  alongside existing data. Display: three rows (Bazzite, Steam Deck, Windows)
  each with a color-coded status badge (green = READY, amber =
  READY_WITH_TINKERING, red = FALLBACK_RECOMMENDED/REQUIRED, gray = UNKNOWN),
  source attribution text, and a "Refresh" button. ROM-only games (availability
  source `ROM` and no `STEAM` availability) show "N/A" for all environments and
  skip the refresh action. Anti-cheat `REQUIRED` shows a warning banner below
  the rows. Freshness indicator: "Updated X days ago" with amber text when > 150
  days. Personal override display: when `LibraryEntry.compatOverrideStatus` is
  set, show the override badge with reason and a "Clear override" button. The
  override UI: a "Set override" button opens a small form with status dropdown
  and reason text input, writing to `LibraryEntry.compatOverrideStatus` and
  `compatOverrideReason` via a new `setCompatOverride` server action. The
  section is placed between the RAWG metadata grid and the Availability section.
  *Done when:* the section renders for games with and without compatibility
  data, ROM-only games show N/A, the refresh button triggers a job, and
  overrides persist and display correctly.

- [x] **Repair - Tolerate AWAY entries without Steam IDs** - Ignore valid AWAY
  records that belong to other stores while indexing Steam-linked records, so a
  non-Steam catalog row cannot block ProtonDB or Deck Verified persistence.
  *Done when:* the current AWAY dataset is accepted, a Steam-linked record is
  still found, and a compatibility refresh can persist ProtonDB evidence when
  unrelated AWAY records omit `storeIds.steam`.

- [x] **Repair - Edit an existing personal override** - Show an edit affordance
  beside the existing clear action and reuse the override form with the current
  status and reason. *Done when:* an existing override can be changed directly
  from the game detail page without clearing it first.

- [x] **Repair - Distinguish absent personal overrides** - Pass a personal
  override to the compatibility UI only when `compatOverrideStatus` is set, so
  provider-derived rows are not labelled as personal overrides. *Done when:*
  a new game with no override shows provider source attribution and no override
  controls, while an explicit override still shows its status, reason, edit,
  and clear actions.

- [x] **Repair - Reframe compatibility evidence and Windows fallback** - Make
  ProtonDB the sole primary status for both Bazzite and Steam Deck. Treat
  AreWeAntiCheatYet as separate secondary evidence instead of overwriting Linux
  rows. Derive the Windows row from Bazzite: READY means fallback not needed;
  tinkering or degraded ProtonDB evidence means fallback recommended; a Linux
  anti-cheat block or REQUIRED Bazzite result means fallback required; no
  Bazzite evidence also means fallback required. Steam Deck Verified remains persisted as
  secondary evidence only. *Done when:* refresh persistence records ProtonDB
  as the primary Bazzite/Steam Deck evidence, AWAY no longer replaces either
  row, and unit tests cover every Windows fallback outcome.

- [x] **Repair - Display independent evidence and Bazzite-only overrides** -
  Present ProtonDB and the secondary anti-cheat evidence separately on Bazzite,
  and ProtonDB and Steam Deck Verified separately on Steam Deck. Render Windows
  with its fallback-specific labels. Apply a personal override only to the
  effective Bazzite status and derive the displayed Windows fallback from that
  effective result; it must not change Steam Deck evidence. Show the color-coded
  ProtonDB tier below the primary status, one public ProtonDB game link when a
  Steam AppID is known, and an AWAY source link beside its anti-cheat evidence.
  Rename the controls to Bazzite override. *Done when:* each row explains its
  primary and secondary evidence, the ProtonDB tier and provider links are
  visible, an override is visibly scoped to Bazzite, and Windows immediately
  reflects that override after the page refreshes.

- [x] **Repair - Remove redundant Steam Deck evidence and rename outcomes** -
  Stop fetching and persisting Steam Deck Verified evidence, remove the Steam
  Deck compatibility row without deleting old snapshots, and expose only the
  Bazzite and Windows decision path. Rename the user-facing Bazzite statuses to
  `Ready for Linux`, `Ready with tinkering`, `May need fallback`, `Not playable`,
  and `Unknown`; retain Windows-specific fallback labels. Link an AWAY match to
  its official per-game page. *Done when:* a refresh calls only ProtonDB and
  AWAY, the detail page has no Steam Deck row, and an AWAY match opens its game
  page.

## Files / areas

**New files:**
- `src/lib/protondb-api.ts` + test
- `src/lib/deck-verified-api.ts` + test
- `src/lib/away-api.ts` + test
- `src/lib/compat-synthesis.ts` + test
- `src/lib/compat-refresh.ts` + test
- `src/lib/compat-job-runner.ts` + test
- `src/actions/compatibility.ts` + test
- `src/components/games/CompatibilitySection.tsx`

**Modified files:**
- `src/app/(app)/games/[id]/page.tsx` - load compat data, add section
- `src/lib/steam-identity.ts` - no change (reuse `parseSteamAppIdInput` as-is)

## Data / contracts

**CompatibilitySnapshot** (existing model, no schema change):
- `gameId`, `provider` (PROTONDB / STEAM_DECK_VERIFIED / ARE_WE_ANTICHEAT_YET),
  `result` (JSON raw API response), `sourceUrl`, `fetchedAt`, `expiresAt`
- Unique on `[gameId, provider]`

**EnvironmentCompatibility** (existing model, no schema change):
- `gameId`, `environment` (BAZZITE / STEAM_DECK / WINDOWS),
  `status` (CompatibilityStatus enum), `source` (attribution string), `updatedAt`
- Unique on `[gameId, environment]`

**ExternalGameId** (existing model, no schema change):
- `namespace: "STEAM_APP"`, `externalId` (the AppID string),
  `matchMethod: "EXACT_STEAM_APP_ID"`, `gameId`

**EnrichmentJob** (existing model, no schema change):
- `provider: "PROTONDB"`, status/stage enums as already defined

**LibraryEntry** (existing fields, no schema change):
- `compatOverrideStatus` (CompatibilityStatus?), `compatOverrideReason` (String?)

**ProtonDB API response** (external, unofficial, verified):
```json
{ "confidence": "strong", "tier": "gold", "score": 0.76, "bestReportedTier": "platinum", "total": 2694, "trendingTier": "platinum" }
```
Confidence values: `strong`, `moderate`, `weak`, `insufficient`. Tier values:
`native`, `platinum`, `gold`, `silver`, `bronze`, `borked`.
Tier mapping: `native`/`platinum`/`gold` -> READY, `silver` -> READY_WITH_TINKERING,
`bronze` -> FALLBACK_RECOMMENDED, `borked` -> REQUIRED. Confidence `insufficient`
with any tier -> UNKNOWN.

**Deck Verified** (store page scraping, graceful degradation):
Scrapes `https://store.steampowered.com/app/{appId}` HTML for the Deck
compatibility section. Maps: Verified -> READY, Playable ->
READY_WITH_TINKERING, Unsupported -> FALLBACK_RECOMMENDED, Unknown or absent ->
null (not an error). If the store page is unreachable or returns non-HTML,
returns `null` and synthesis falls back to ProtonDB-only for Steam Deck.

**AWAY response** (public GitHub dataset, verified):
```json
[{ "name": "Halo: The Master Chief Collection", "status": "Supported", "anticheats": ["Easy Anti-Cheat"], "storeIds": { "steam": "976730" }, "native": false }]
```
Status values observed: `Supported`, `Denied`, `Running`, `Broken`, `Planned`.
Status mapping: `Supported`/`Running` -> no override, `Denied`/`Broken` ->
REQUIRED override, `Planned` -> warning context.

## Testing

- **API clients** (step 2): unit tests for tier/category mapping, not-found,
  network error, malformed response. Mock `fetchFn`.
- **Synthesis** (step 3): unit tests for every environment x provider
  combination, AWAY override cascade, no-data -> UNKNOWN.
- **Persistence + job runner** (step 4): unit tests for the transaction path,
  job lifecycle transitions (QUEUED->RUNNING->SUCCEEDED, QUEUED->RUNNING->
  RETRY_WAIT->RUNNING->SUCCEEDED, terminal failure), retryable vs non-retryable
  error classification.
- **UI** (step 5): build evidence + manual browser verification. No component
  unit tests (per coding-standards.md: UI rides on screenshot + build).

## Notes for the AI

- **Server-only modules.** All API clients and synthesis logic are `"use server"`
  or `import "server-only"`. Never expose API responses or keys to the client.
- **fetchFn injection.** Every API client accepts an optional `fetchFn` parameter
  for testability, matching the ITAD and RAWG patterns.
- **Reuse `parseSteamAppIdInput`.** The manual AppID entry reuses the existing
  parser from `src/lib/steam-identity.ts` which handles both bare IDs and Steam
  store URLs.
- **Conflict check.** Before writing an `ExternalGameId`, check if another game
  already owns that `[namespace, externalId]` pair. The unique constraint will
  catch it, but the action should return a user-friendly message.
- **AWAY dataset caching.** The AWAY dataset (~500KB JSON) is fetched once and
  cached in a module-level variable with a 24-hour TTL. The cache key is the
  full dataset; no per-game fetching. When the cache is stale, the next request
  triggers a background refresh. The dataset is indexed by `storeIds.steam` for
  O(1) lookup by AppID.
- **Job model reuse.** Compatibility refresh uses `EnrichmentJob` with
  `provider: "PROTONDB"`. The other two providers (Deck Verified, AWAY) run
  inline within the same job execution since they are fast (one HTTP call each).
  The `CompatibilitySnapshot` rows for all three providers are written in one
  transaction.
- **180-day freshness.** `expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 *
  1000)`. The UI shows "Updated X days ago" and warns when > 150 days.
- **ROM-only exemption.** Check `game.availability.some(a => a.source === "ROM")`
  and `!game.availability.some(a => a.source === "STEAM")`. If true, skip all
  lookups and display "N/A".
- **Anti-cheat override priority.** AWAY `Denied` or `Broken` overrides everything,
  including ProtonDB `native` and Deck Verified `Verified`. This is intentional:
  anti-cheat denial means the game cannot run regardless of other compatibility.
- **Personal overrides.** `LibraryEntry.compatOverrideStatus` takes priority over
  all provider evidence when set. The UI shows the override badge and reason.
  Clearing the override reverts to provider-synthesized status.
- **No schema changes.** All models (`CompatibilitySnapshot`,
  `EnvironmentCompatibility`, `ExternalGameId`, `EnrichmentJob`, `LibraryEntry`)
  already exist with the correct fields and relations.

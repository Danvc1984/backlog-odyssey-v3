# Feature: IGDB client and identity foundation

**From build-plan:** 23a, first sub-feature of 23 (IGDB as primary metadata,
artwork, and playtime provider)
**Status:** not started - review required

## Goal

Establish the server-side IGDB provider boundary that the rest of feature 23
builds on: authenticated, rate-limited API access with a persisted Twitch
token cache, identity resolution for catalog games (Steam App ID through
`external_games`, normalized fuzzy search otherwise), match outcomes with
high-confidence automatic fixing and base-game/DLC category safety, guarded
persistence of the IGDB identity, and the locked IGDB-shaped metadata payload
contract. 23b through 23e build snapshot persistence, queueing, UI, playtime,
wishlist flows, and RAWG retirement on top of this contract. Nothing here
changes user-visible behavior.

## In scope

- Prisma additions: `Provider` enum gains `IGDB`, `MatchMethod` gains
  `MANUAL_IGDB_SEARCH`, and a singleton `IgdbTokenCache` model, with a
  migration.
- Server-only IGDB configuration helper reading `IGDB_CLIENT_ID` and
  `IGDB_CLIENT_SECRET`, plus `.env.example` entries.
- Twitch client-credentials token manager: DB-cached singleton token,
  proactive refresh inside a 7-day window, single-flight refresh, and an
  invalidation hook for 401 handling.
- In-process rate limiter: 4 request starts per second and at most 8
  concurrent requests, shared by every IGDB call.
- IGDB request boundary: APICalypse POSTs with bearer auth, 10-second
  timeouts, transport-level retries (network errors, 429 with `Retry-After`,
  5xx) up to three attempts, and one re-auth retry after 401.
- Identity resolution and matching: Steam App ID lookup through
  `external_games`, normalized fuzzy search for entries without an App ID,
  high-confidence automatic fixing with pinned thresholds, and category
  safety that never auto-applies an incompatible base-game/DLC candidate.
- IGDB identity persistence on `ExternalGameId` (namespace `IGDB_GAME`) with
  conflict protection and manual-replacement precedence.
- The `IgdbMetadataPayload` version 1 contract (types) plus the pure mapping
  from an IGDB game response to that payload.

## Out of scope

- Snapshot persistence, artwork and screenshot byte capture, palette
  derivation, and writes to `MetadataSnapshot` or
  `WishlistMetadataSnapshot` (23b and 23d).
- EnrichmentJob wiring for IGDB, queueing, batch runners, retry-action
  registration, polling routes, and any progress UI (23b).
- All UI: load buttons, manual-search dialog with cover candidates,
  overwrite warnings, and attribution display (23b).
- Wishlist IGDB flows, automatic Steam App ID application from fixed
  matches, and retirement of the RAWG store-link and `storesearch` paths
  (23d).
- SteamSpy fallback, duration profiles, and `durationBand` wiring (23c).
- Recommendation re-keying, RAWG client/env/code removal, attribution swap,
  stale-snapshot presentation, and the clean-restart procedure (23e).
- No modifications to existing RAWG files; this feature is additive.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, and the documented build check must pass
   before a step is accepted.

## Build steps

- [x] **Step 1 - Lock the provider contract and add schema support** - Create
  `src/lib/igdb-types.ts` with the namespaces, schema version, match
  contract, candidate shape, payload contract, and error categories listed
  under Data / contracts. Extend the Prisma schema (`Provider` += `IGDB`,
  `MatchMethod` += `MANUAL_IGDB_SEARCH`, new `IgdbTokenCache` model) and
  create the migration. Add `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` to
  `.env.example`. *Done when:* the migration applies via `pnpm prisma:migrate`,
  `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass, no runtime behavior
  changed, and the contract file imports nothing from RAWG modules.

- [x] **Step 2 - In-process IGDB rate limiter** - Add
  `src/lib/igdb-rate-limit.ts`: a module singleton enforcing at most 4 request
  starts per rolling second and at most 8 concurrent in-flight requests, FIFO
  queue, release on both success and rejection. *Done when:* Vitest with fake
  timers proves the 4-per-second spacing, the 8-concurrent cap, FIFO order,
  and release after both resolve and reject.

- [x] **Step 3 - Twitch token cache** - Add `src/lib/igdb-token.ts` with
  `getIgdbConfig()` and `getIgdbAccessToken()`: read the singleton
  `IgdbTokenCache` row; reuse a valid token outside the refresh window;
  proactively refresh inside the 7-day window; allow only one refresh at a
  time (concurrent callers share it); keep the previous token when a refresh
  fails while it is still valid; expose `invalidateIgdbToken()` for 401
  handling; 10-second timeout on the token request. *Done when:* Vitest with
  mocked fetch and Prisma proves reuse, proactive refresh, single-flight,
  failure-preserves-old-token, malformed token responses typed as
  `CONFIGURATION`, and that the client secret and token never appear in
  errors or logs.

- [x] **Step 4 - IGDB request boundary** - Add the server-only request core
  in `src/lib/igdb-api.ts`: authenticated APICalypse POST with `Client-ID`
  and bearer headers, 10-second `AbortController` timeout, up to three
  transport retries for network errors, 429 (honoring `Retry-After` seconds,
  ITAD-style), and 5xx; exactly one re-auth retry after 401 via
  `invalidateIgdbToken()`; any other 4xx fails as a typed `HTTP` error
  without retry. Injectable `fetchFn` for tests. *Done when:* Vitest proves
  header presence, `Retry-After` honoring, the 401 refresh-once path,
  timeout mapped to `NETWORK`, and no retry on other 4xx.

- [x] **Step 5 - Identity resolution and matching** - Extend
  `src/lib/igdb-api.ts` with `resolveIgdbGameBySteamAppId()` (distinct IGDB
  game IDs from `external_games` where `uid = appId` and the Steam external
  category), `searchIgdbCandidates()` (games search requesting name,
  alternative names, category, first release date, cover; limit 10),
  `classifyIgdbCategory()` (pinned class map: main-game-like, DLC-like,
  never-auto), and `matchIgdbGame()`: App ID resolution first, then
  normalized exact-name auto-fix (title or alternative name), then fuzzy
  auto-fix when the top score is at least 0.9 and at least 0.05 above second
  place and the class is compatible; otherwise `AMBIGUOUS` with ranked
  candidates; `selectedIgdbId` short-circuits to a manual match that records
  a `classMismatch` flag instead of refusing. *Done when:* Vitest with mocked
  fetch proves precedence, both auto-fix paths, ambiguity, category safety in
  both directions (base game never auto-matches DLC-like and vice versa,
  bundles/mods never auto-match), and `NOT_FOUND` / `UNAVAILABLE` paths.

- [x] **Step 6 - IGDB identity persistence** - Add `src/lib/igdb-enrichment.ts`
  (server-only) with `persistIgdbIdentity()`: one transaction that returns
  `IGDB_ID_CONFLICT` without mutation when the IGDB game ID is already
  attached to another game, otherwise replaces the game's `IGDB_GAME`
  external-ID rows delete-then-create with the mapped `matchMethod`.
  *Done when:* Vitest with mocked Prisma proves conflict without mutation,
  replace-on-rematch, matchMethod mapping, and that availability, personal
  fields, Steam identity, and non-IGDB rows remain untouched.

- [x] **Step 7 - Payload contract mapping** - Add
  `src/lib/igdb-metadata-payload.ts` with `parseIgdbGameToPayload()`: map the
  IGDB game response onto `IgdbMetadataPayload` v1 with tolerant parsing
  (missing values become `null` or `[]`, never fabricated), pinned label maps
  for game modes, multiplayer modes, relations, and ESRB ratings (unknown
  numeric values are dropped, never guessed), image URLs built from
  `image_id` at the named sizes, a six-screenshot cap, and attribution with
  the IGDB source URL. *Done when:* Vitest proves a representative response
  maps every contract field, missing and malformed fields degrade safely,
  the three rating fields stay distinct with counts, caps hold, and
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass.

## Files / areas

- `src/lib/igdb-types.ts` - locked provider contract (new).
- `src/lib/igdb-rate-limit.ts` and its test (new).
- `src/lib/igdb-token.ts` and its test (new).
- `src/lib/igdb-api.ts` and its test (new, server-only).
- `src/lib/igdb-enrichment.ts` and its test (new, server-only).
- `src/lib/igdb-metadata-payload.ts` and its test (new).
- `prisma/schema.prisma` and one migration (enum additions, IgdbTokenCache).
- `.env.example` (IGDB credentials).
- Reused, not modified: `src/lib/fuzzy-match.ts` scoring, `normalizeName`
  from `src/lib/duplicate-utils.ts`, the ITAD `Retry-After` pattern, and the
  palette shape from `src/lib/palette.ts`.

## Data / contracts

Locked now; 23b through 23e consume them.

- `IGDB_EXTERNAL_NAMESPACE = "IGDB_GAME"`. `externalId` stores the IGDB game
  ID as a string; `namespaceId` mirrors it (existing convention).
- `matchMethod` on IGDB rows: `EXACT_STEAM_APP_ID` (resolved through
  `external_games`), `INFERRED` (existing enum value, reused as the
  high-confidence fuzzy auto-fix), `MANUAL_IGDB_SEARCH` (new). A
  `MANUAL_IGDB_SEARCH` row is authoritative: automatic matching never
  replaces it; only an explicit user replacement does.
- `IgdbMatchResult` is a discriminated union: `MATCHED` (matchMethod, parsed
  game, optional `classMismatch`), `AMBIGUOUS` (ranked candidates),
  `NOT_FOUND`, `UNAVAILABLE` (typed `IgdbProviderError` with
  `CONFIGURATION | NETWORK | HTTP | MALFORMED_RESPONSE`). Only `MATCHED`
  reaches persistence.
- Category classes come from a pinned map over IGDB `game_type`/`category`
  numeric values (verified against IGDB documentation by Step 5 tests).
  Automatic paths refuse class-incompatible candidates; manual selection may
  apply any candidate and records `classMismatch` for the 23b UI to surface.
- `IGDB_METADATA_SCHEMA_VERSION = 1`. Payload fields, all nullable or empty
  when absent: IGDB id and slug, name, summary, first release date, genres,
  themes, keywords, developers, publishers, ESRB rating label, official
  website, alternative names, three distinct rating entries (`aggregated`,
  `community`, `total`) each with score and count, collections, franchise,
  explicit relations (kind, IGDB id, name), game modes, multiplayer modes,
  cover (`t_cover_big`), artworks (`t_720p`, max 6), screenshots
  (`t_screenshot_big`, max 6, with width and height), IGDB updated date,
  attribution (`provider: "IGDB"`, sourceUrl
  `https://www.igdb.com/games/{slug}`, fetchedAt), and `palette`
  (existing derived-palette shape, `null` until 23b captures it).
- Token and limiter coordination: the token is persisted in `IgdbTokenCache`
  (singleton row, id 1); the rate limiter is an in-process module singleton,
  which is deliberate for this single-user, single-server deployment.
  Proactive refresh window: 7 days. Transport retries: 3. Timeout: 10
  seconds. Rate: 4 requests/second, 8 concurrent. Search limit: 10.
- Load-bearing for later features: payload v1 shape (23b persistence, 23c
  playtime, 23d wishlist, 23e engines); the `IGDB_GAME` namespace
  (merge/delete treat `ExternalGameId` generically today); EnrichmentJob's
  `(gameId, provider)` uniqueness already admits an `IGDB` provider value.

## Testing

- Unit tests cover the limiter, token manager, request boundary, matching,
  persistence, and payload mapping. Fetch and Prisma are mocked; the suite
  makes no live IGDB or Twitch calls; fake timers drive time-dependent
  logic.
- No UI exists in this feature; gates are `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, and `pnpm build`.
- Contract-pin tests assert the IGDB Steam external category value, the
  category class map, and the ESRB rating label map against documented IGDB
  values, so accidental changes fail loudly.

## Notes for the AI

- Keep every credential and HTTP call server-side. `igdb-types.ts` and
  `igdb-metadata-payload.ts` stay free of `server-only` so views can import
  types, mirroring the RAWG split.
- Additive only: do not modify RAWG files, wishlist flows, or job plumbing.
  RAWG retirement is 23e.
- Reuse `fuzzy-match.ts` and `normalizeName` instead of importing from or
  duplicating RAWG modules.
- Never log the client secret or the access token; errors carry categories,
  not credentials.
- `INFERRED` is reused as the IGDB auto-fix matchMethod. Confirm in Step 5
  that no existing writer gives it a conflicting meaning; if one exists,
  stop and surface it rather than overloading.
- Enum numeric values (external category, game types, ESRB ratings) are
  verified against IGDB's documented values during implementation; this spec
  fixes the classes and thresholds, not unverified numbers.
- Do not commit, merge, or mark the build-plan item complete during this
  loop. `/complete` owns archive, checkbox, and merge work.

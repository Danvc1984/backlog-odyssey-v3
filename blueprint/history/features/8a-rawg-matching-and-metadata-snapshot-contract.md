# Feature: RAWG matching and metadata snapshot contract

**From build-plan:** feature 8a
**Status:** not started - review required

## Goal

Establish the server-side RAWG boundary for one catalog game: resolve a safe
match, normalize the provider response into a stable metadata payload, persist a
replaceable RAWG snapshot with attribution, and show an existing snapshot on the
game detail page. Later sub-features can add user-triggered asynchronous loads,
catalog-wide batches, and Steam import hooks without redefining this contract.

## In scope

- A server-only RAWG client with typed match outcomes and normalized provider errors.
- Match precedence and outcomes for an exact Steam App ID lookup, title search,
  ambiguous results, no match, malformed responses, and provider failure.
- A versioned `MetadataSnapshot` payload for the RAWG fields already promised by
  the project overview.
- RAWG external identity persistence using the existing `ExternalGameId` model,
  including conflict protection when an ID belongs to another game.
- Replaceable RAWG snapshot persistence that does not alter personal catalog data
  or non-RAWG provider records.
- Read-only display of an existing RAWG snapshot on `/games/[id]`, including a
  source link and attribution, with empty and incomplete-data states.

## Out of scope

- The user-facing action that starts a RAWG request from the detail page. Feature
  8b owns that action and its asynchronous job state.
- `EnrichmentJob` persistence, worker claiming, retries, polling, progress, or
  batch summaries. Feature 8b and 8c own those concerns.
- Catalog-wide enqueueing and post-import enrichment. Features 8c and 8d own
  those triggers.
- RAWG data for wishlist entries, DLC resolution, compatibility evidence, price
  data, recommendations, or dynamic page themes.
- Overwriting `Game.name`, personal fields, availability, Steam identity, or any
  provider snapshot other than RAWG.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, and the documented build check must pass before
   a step is accepted. UI-only behavior also needs live browser evidence.

## Build steps

- [x] **Step 1 - Define the RAWG provider and match contracts** - Add the
  server-only RAWG adapter, typed match results, normalized error categories, and
  response parsing for exact Steam App ID and title-search paths. *Done when:*
  Vitest proves exact matches take precedence, ambiguous and no-match responses
  do not become matches, malformed or non-success provider responses become a
  safe provider failure, and no API key or provider request is exposed to client
  code.

- [x] **Step 2 - Persist a normalized RAWG snapshot safely** - Add the
  versioned `RawgMetadataPayload` mapping and the server persistence helper that
  records the RAWG `ExternalGameId` and replaceable `MetadataSnapshot` in one
  guarded operation. *Done when:* Vitest proves a matched response writes the
  expected identity, payload, source URL, attribution, and fetch time; a
  RAWG ID collision returns an error without mutation; no-match and provider-
  failure outcomes write nothing; and existing personal fields,
  availability, Steam identity, and non-RAWG snapshots remain unchanged.

- [x] **Step 3 - Display existing RAWG metadata and attribution** - Add the
  read-only metadata section to the game detail page, including an empty state,
  optional-field handling, provider attribution, and a link to the RAWG source.
  *Done when:* browser inspection of a game with no snapshot shows a clear empty
  state, a game with a snapshot shows the normalized metadata without broken
  fields or layout, and the page remains usable when optional RAWG values are
  missing; `pnpm typecheck`, `pnpm lint`, and the production build pass.

## Files / areas

- `src/lib/rawg-types.ts` - typed match outcomes and versioned normalized payload.
- `src/lib/rawg-api.ts` - server-only RAWG HTTP boundary and response parsing.
- `src/lib/rawg-api.test.ts` - provider and match edge-case coverage.
- `src/lib/rawg-enrichment.ts` - guarded snapshot and external-identity persistence.
- `src/lib/rawg-enrichment.test.ts` - persistence contract coverage with mocked
  Prisma boundaries.
- `src/components/games/MetadataSection.tsx` - read-only metadata and attribution
  display.
- `src/app/(app)/games/[id]/page.tsx` - load the current RAWG snapshot and render
  the metadata section.
- `prisma/schema.prisma` and a migration only if the existing snapshot or
  external-identity constraints cannot support the locked contract without a
  schema change.

## Data / contracts

- `RawgMatchResult` is a discriminated union with `MATCHED`, `AMBIGUOUS`,
  `NOT_FOUND`, and `UNAVAILABLE` outcomes. Only `MATCHED` may reach persistence.
- `RawgMetadataPayload` is stored in `MetadataSnapshot.payload` with
  `schemaVersion: 1`, RAWG ID and slug, title, description, release date,
  background image URLs, genres, tags, developers, publishers, website, rating,
  Metacritic score, playtime, alternative names, RAWG URL, and attribution.
  Optional provider values remain `null` or empty arrays according to the type,
  never fabricated defaults.
- RAWG identity uses `ExternalGameId.namespace = "RAWG_GAME"`, the RAWG game
  identifier as both `externalId` and `namespaceId` (matching the existing Steam
  import convention), and a `matchMethod` that distinguishes exact Steam App ID
  matching from an explicitly selected title-search result. A RAWG ID already
  attached to a different game is a load-bearing conflict and must not be
  reassigned here.
- `MetadataSnapshot.provider` is `RAWG`; the snapshot is replaceable and has no
  history. Its `sourceUrl`, `fetchedAt`, and payload attribution identify the
  provider data shown to the user.
- The existing `Game.name`, `LibraryEntry`, `GameAvailability`, Steam external
  ID, and snapshots for other providers remain authoritative and untouched.

## Testing

- Unit tests are required for the provider adapter, match precedence, response
  parsing, normalized payload mapping, identity conflicts, no-match behavior,
  provider failure, and snapshot replacement.
- Mock HTTP and Prisma boundaries with Vitest. Do not call RAWG or a real
  database from the unit suite.
- The detail-page section is a UI surface, not a unit-test target. Verify it with
  a live browser run using seeded or locally created snapshot data, then run
  `pnpm typecheck`, `pnpm lint`, and the production build. If the normal build is
  blocked by the known Turbopack environment issue, use the documented Webpack
  fallback and report that evidence.
- Verify that missing `RAWG_API_KEY` and provider failures produce safe errors and
  do not alter catalog data. No destructive catalog action is required for this
  sub-feature.

## Notes for the AI

- Keep the RAWG key and all provider HTTP calls on the server. The later Server
  Action must call `requireUser()` before invoking this helper.
- Follow the existing `{ success, data, error }` action convention when 8b adds
  the user-facing action. Internal helpers may use the discriminated contracts
  above, but must preserve typed failure categories.
- Treat RAWG metadata as rebuildable provider data. Never use it to overwrite
  authoritative personal intent or immutable Steam identity.
- The project overview names an `EnrichmentJob` model, but the current Prisma
  schema does not contain one. Do not add that queue model in 8a; reconcile it in
  8b before implementing asynchronous behavior.
- Preserve the existing Next.js server-component pattern and Tailwind styling.
  Keep the metadata display focused on the existing detail page and do not start
  dynamic themes or compatibility UI early.
- Do not commit, merge, or mark the build-plan item complete during this spec or
  implementation loop. `/complete` owns archive, checkbox, and merge work.

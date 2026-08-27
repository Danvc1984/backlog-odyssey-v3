# Feature: RAWG payload maturity and series evidence

**From build-plan:** feature 8e
**Status:** not started

## Goal

Extend the RAWG metadata payload to version 2 with two pieces of evidence the
recommender currently cannot derive: the ESRB rating (unblocks the reserved
`MATURITY` profile dimension) and the RAWG game-series list (unblocks the
reserved `SERIES` dimension via a "confident sequel" derivation). The details
response the app already fetches carries `esrb_rating` today and is dropped by
the parser; series evidence needs one extra best-effort call to the RAWG
game-series endpoint during enrichment. The shared RAWG metadata section on
game and wishlist detail shows the new evidence. No schema migration.

## In scope

- `RawgGameDetails` gains `esrbRating` and `seriesGames`; `rawg-api` parses
  ESRB tolerantly and attaches series evidence best-effort inside `fetchGame`.
- `RawgMetadataPayload` version 2: `schemaVersion: 2`, `esrbRating`,
  `seriesGames`; wishlist payload inherits via the existing spread.
- `parseRawgMetadataPayload` accepts version 1 and version 2 payloads.
- `deriveSequelRelationship` pure helper locking the sequel rule.
- Display: `MetadataSection` (already shared by `/games/[id]` and
  `/wishlist/[id]`) shows the ESRB rating and the series names.
- Fixture updates where existing tests construct `RawgGameDetails`.

## Out of scope

- Consuming the evidence: `MATURITY`/`SERIES` derivation is 12c-c, re-ranking
  and sequel posture are 12c-d/12c-f.
- Automated backfill: existing catalog snapshots upgrade only when the user
  runs the existing enrichment actions; existing wishlist snapshots stay v1
  because the fill-only enrichment rule stands (no overwrite path exists for
  wishes).
- Any change to job states, retry policy, queue mechanics, or the wishlist
  queue's delay/concurrency.

## Data / contracts (load-bearing)

### Wire shapes (confirm against live responses during Step 1)

- Details response field: `esrb_rating: { id, name, slug } | null`.
- `GET /games/{id}/game-series?key=...` returns a paginated list
  (`results: [game objects]`); only the first page is read, capped at 20
  entries, each contributing `{ rawgId, name, slug, released }`.

### Type additions

```ts
interface RawgEsrbRating {
  name: string;      // e.g. "Mature", "Teen", "Everyone"
  slug: string | null;
}

interface RawgSeriesEntry {
  rawgId: number;
  name: string;
  slug: string | null;
  released: string | null; // ISO date string as returned by RAWG
}
```

- `RawgGameDetails.esrbRating: RawgEsrbRating | null` (required field, null
  when absent or malformed).
- `RawgGameDetails.seriesGames: RawgSeriesEntry[]` (required, `[]` when the
  series call fails or returns nothing).
- `RawgMetadataPayload` v2 adds `esrbRating: RawgEsrbRating | null` and
  `seriesGames: RawgSeriesEntry[]`; `RAWG_METADATA_SCHEMA_VERSION` becomes 2.
- Version tolerance: `parseRawgMetadataPayload` keeps validating `title` +
  `genres` and accepts both v1 and v2 rows; consumers read the new fields with
  `?? null` / `?? []` because v1 snapshots lack them.

### Best-effort series rule

`fetchGame` calls the series endpoint after a successful details parse. Any
failure there (network, 429, malformed) yields `seriesGames: []` and never
fails the match or triggers a job retry. The next enrichment naturally retries
the evidence. This keeps one retry policy: only details failures retry.

### Sequel derivation rule

```ts
deriveSequelRelationship(
  current: { rawgId: number; releaseDate: string | null },
  series: readonly RawgSeriesEntry[],
): RawgSeriesEntry[]
```

A series entry is a confident sequel of `current` when all hold: different
`rawgId`, both `released` dates parse as dates, and the entry's release is
strictly later than `current`'s. Returns sequels sorted oldest first; `[]`
when `current.releaseDate` is null. The "confident" bar is deliberately
conservative; no name matching, no fuzzy inference.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Types and version bump** - add `RawgEsrbRating`,
  `RawgSeriesEntry`, extend `RawgGameDetails` and `RawgMetadataPayload`, bump
  `RAWG_METADATA_SCHEMA_VERSION` to 2. Fixtures constructing
  `RawgGameDetails` gain `esrbRating: null, seriesGames: []`.
  *Done when:* `pnpm typecheck` is green with the two new required fields.
- [x] **Step 2 - API parse and series fetch** - `parseGame` reads
  `esrb_rating` tolerantly (malformed shapes become null, never rejecting the
  game); new `fetchGameSeries` parses the paginated response with malformed
  entries skipped; `fetchGame` attaches series best-effort per the rule above.
  *Done when:* `rawg-api` tests cover esrb present/null/malformed, series
  parsing with junk entries skipped, and a failing series call still returning
  full details with `seriesGames: []`; `pnpm test` green.
- [x] **Step 3 - Payload v2 and sequel helper** - `toRawgMetadataPayload`
  (and the wishlist variant through the existing spread) writes the two new
  fields; `parseRawgMetadataPayload` accepts v1 and v2;
  `deriveSequelRelationship` exported from `rawg-enrichment.ts`.
  *Done when:* tests cover the v2 payload shape, a v1 payload still parsing,
  a garbage payload still rejecting, and the sequel rule (self excluded,
  earlier releases excluded, null current date empty, ordering); `pnpm test`
  green.
- [x] **Step 4 - Live verification** - confirm the `esrb_rating` and
  game-series wire shapes against real responses while reviewing Step 2
  parsers; then in the running app re-enrich one catalog game from its detail
  page and one snap-less wishlist wish, and inspect both snapshots in
  `pnpm prisma studio`.
  *Done when:* the catalog snapshot payload shows `schemaVersion: 2` with
  ESRB and non-empty series where RAWG has them; the wishlist snapshot shows
  the same fields; `pnpm build` and `pnpm test` green.
- [x] **Step 5 - Metadata display** - extend `MetadataSection`: an "ESRB"
  field row (`payload.esrbRating?.name ?? null`) and a "Series" chip row from
  `payload.seriesGames` names, both silently absent for v1 snapshots and
  missing evidence (guard with `??`/optional chaining; v1 rows lack the keys
  at runtime despite the v2 type). Both `/games/[id]` and `/wishlist/[id]`
  render the section unchanged otherwise.
  *Done when:* in the running app, a v2-enriched game and wish show the ESRB
  rating and series chips, a v1 snapshot (or one without ESRB/series) shows
  no new rows and no errors, and the build is green.

## Files / areas

- `src/lib/rawg-types.ts`: types + version bump
- `src/lib/rawg-api.ts` (+ test): esrb parse, series fetch/parse, attach
- `src/lib/rawg-metadata-payload.ts` (+ test): v1/v2 tolerance
- `src/lib/rawg-enrichment.ts` (+ test): payload mapping, sequel helper
- `src/components/games/MetadataSection.tsx`: ESRB row, series chips
- Fixture-only touches in `rawg-job-runner.test.ts`,
  `wishlist-rawg-queue.test.ts`, `rawg-job-view.test.ts` as needed

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `rawg-api`: esrb tolerant parse, series parse (junk skipped, cap 20), series
  failure isolation, details flow unchanged otherwise.
- `rawg-metadata-payload`: v1 accepted, v2 accepted, invalid rejected.
- `rawg-enrichment`: v2 payload fields, wishlist inheritance, sequel rule
  matrix.
- Job/queue behavior is unchanged; existing tests keep passing.
- Step 4 rides on the running app: real enrichment, Prisma Studio inspection,
  build. Step 5 (display) is UI-only and rides on the running app plus the
  build: v2 rows visible on both detail pages, v1 snapshots unchanged.

## Notes for the AI

- The exact wire shape of `esrb_rating` and the game-series endpoint must be
  confirmed against live responses (sandboxed shells could not reach
  api.rawg.io when this was specced). If the endpoint's response shape differs
  from the documented pagination, adjust the Step 2 parser; it stays a small
  change.
- No Prisma migration: snapshots are JSON. Never require the new fields when
  reading persisted payloads.
- Two requests per enrichment (details + series) is accepted; keep the
  wishlist queue's existing 150ms delay and concurrency of 3.
- Do not display ESRB or series anywhere yet; nothing consumes them before
  12c-c.
- Attribution is unchanged: `attribution.sourceUrl` stays the game's RAWG URL.
- Branch: `feature/rawg-payload-esrb-series`.

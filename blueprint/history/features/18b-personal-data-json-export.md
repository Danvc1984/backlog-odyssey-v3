# Feature: Personal-data JSON export

**From build-plan:** 18b
**Status:** complete

## Goal

Add a versioned, downloadable JSON export of every user-authored and
user-decided record: catalog and wishlist entries, availability, external
IDs, play states, personal fields, tags, collections, settings, manual
overrides, review-queue decisions, and recommendation-owned data. Rebuildable
provider snapshots, run records, caches, and auth artifacts are excluded.
Feature 18c consumes the exact document shape produced here, so the schema
is the load-bearing contract.

## Design reference

No mockup exists (19a owns the next prototype round). The surface is one
Settings `SectionCard` following the established card system; the export
itself is a file download, not a visual design.

## In scope

- `src/lib/export-schema.ts`: `EXPORT_VERSION = 1`, a Zod document schema
  mirroring the exported Prisma models field-for-field (camelCase, enums as
  string unions, nullable fields, Json fields as passthrough), and the
  inferred `ExportDocument` type
- `src/lib/export-data.ts`: a recursive `toJsonSafe` converter (Date to ISO
  string, Prisma Decimal to string, everything else structural) and
  `buildExportDocument()` assembling the document from Prisma reads
- `GET /api/export`: auth-guarded route handler returning the validated
  document as an attachment download
- `DataExportCard` on Settings: description of the scope, a download
  anchor, and a counts line (games, wishlist entries, recommendation runs)
  so the export size is observable before clicking

## Out of scope

- Import and restore (18c); this feature only defines and produces the
  document
- All provider-derived data: `MetadataSnapshot`, `WishlistMetadataSnapshot`,
  `CompatibilitySnapshot`, `EnvironmentCompatibility`, wishlist compat
  snapshots, `DealOffer`, `ItadIdentity`, `WallpaperState`
- All operational records: `EnrichmentJob`, `SyncRun`, `PriceRefresh`,
  `WishlistCompatSweep`, `CatalogOperation`, `SteamRecentActivityCache`
- Auth artifacts (`User`, `Account`, `Session`) and `SteamConnection`: both
  are provisioned or re-linked by sign-in, never exported
- Streaming or chunked export for large catalogs; a single JSON response is
  fine at personal-library scale
- Any UI beyond the Settings card

## Export scope (the document's `data` keys)

Included, keyed per model with fields mirroring `schema.prisma`:

- `settings`: `AppSettings` singleton row
- `games`, `libraryEntries`, `availability`, `externalIds`:
  `Game` (with `baseGameId` links), `LibraryEntry` (play state, main flag,
  priority, interest, rating, environment, game experience, notes,
  replayCandidate, hidden, and the compatibility override status/reason as
  the manual overrides), `GameAvailability`, `ExternalGameId`
- `alternativeSources`: `AlternativeSource` (availability rows reference
  them, so they must travel with the export)
- `tags`, `gameTags`, `collections`, `collectionMemberships`: the four
  tag/collection models
- `wishlist`: `WishlistEntry` including confirmed `steamAppId` and
  provenance, `targetPriceMxn`, and base-game links
- `unresolvedDlc`, `wishlistImportReviews`, `wishlistImportIgnores`,
  `possibleDuplicates`: the review queues. The plan's literal list does not
  name these, but they hold manual decisions (link, discard, ignore,
  dismiss) that would otherwise resurface for re-review after a restore;
  they are included as a deliberate judgment call
- `recommendations`: `runs`, `items`, `feedback`, `events`, `profile`,
  `preferences`, `tuneState`, `presets` under one `recommendations` object

Excluded and noted as such in the card description: provider snapshots,
compatibility evidence, offers, run/queue records, caches, sessions, and the
Steam link.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - JSON-safe converter and envelope** - create
  `src/lib/export-data.ts` with `toJsonSafe(value: unknown): unknown`
  (recursively converts `Date` to `toISOString()`, `Prisma.Decimal`
  instances to strings, leaves primitives, null, arrays, and plain objects
  intact) and `buildEnvelope(data: unknown)` producing
  `{ version: EXPORT_VERSION, exportedAt: <ISO string>, data }`. Ship
  `export-data.test.ts` covering a Date, a Decimal, nested structures, and
  the envelope fields.
  *Done when:* tests pass for both conversions and the envelope shape;
  `pnpm typecheck` and `pnpm test` green.

- [x] **Step 2 - Export schema: settings and catalog domain** - create
  `src/lib/export-schema.ts` with `EXPORT_VERSION = 1` and Zod schemas for
  `settings`, `games`, `libraryEntries`, `availability`, `externalIds`,
  `alternativeSources`, `tags`, `gameTags`, `collections`, and
  `collectionMemberships`, mirroring the Prisma columns (enum values as
  string unions matching the generated client, Dates as ISO strings, Json
  fields as `z.unknown()`). Ship focused fixture tests: a valid row parses,
  a row with a wrong enum value or a malformed date fails.
  *Done when:* the schema mirrors the ten models' columns and the fixture
  tests are green; typecheck passes.

- [x] **Step 3 - Export schema: wishlist, reviews, recommendations** - extend
  the schema with `wishlist`, `unresolvedDlc`, `wishlistImportReviews`,
  `wishlistImportIgnores`, `possibleDuplicates`, and the `recommendations`
  object (`runs`, `items`, `feedback`, `events`, `profile`, `preferences`,
  `tuneState`, `presets`), then assemble the full `exportDocumentSchema`
  (`version`, `exportedAt`, `data`) and export the inferred
  `ExportDocument` type. `targetPriceMxn` is a string. The `settings` key is
  nullable: the `AppSettings` row is only upserted after a settings write, so
  a fresh database exports `settings: null`. Ship tests: a
  complete minimal document parses, a wrong `version` is rejected, each
  array tolerates empty, and a null `settings` parses.
  *Done when:* the full document validates and the inferred type compiles;
  tests and typecheck green.

- [x] **Step 4 - Export builder and route** - in `src/lib/export-data.ts`
  add `buildExportDocument()`: parallel Prisma reads for every included
  model (full rows, no `select` trimming beyond what the schema needs),
  mapped through `toJsonSafe`, grouped under the documented `data` keys.
  Create `src/app/api/export/route.ts`: guarded by the existing auth corner,
  builds the document, validates it with `exportDocumentSchema` (fail with
  500 on mismatch rather than shipping an invalid file), and returns it with
  `application/json` plus `Content-Disposition: attachment;
  filename="backlog-odyssey-export-v1-<YYYYMMDD>.json"`.
  *Done when:* with `pnpm dev`, downloading from `/api/export` yields a
  file that parses as JSON with `version: 1`; the file contains every
  documented key; an empty database still produces a valid export; the
  response downloads rather than navigating.

- [x] **Step 5 - Settings export card** - create
  `src/components/settings/DataExportCard.tsx` (server): a `SectionCard`
  (eyebrow "Data", title "Personal-data export") with a one-line scope
  description (personal data included, provider snapshots excluded), a
  counts line queried from the database (games, wishlist entries,
  recommendation runs), and a styled download anchor to `/api/export` with
  the `download` attribute. Place the card at the bottom of `/settings`.
  *Done when:* the card shows real counts and the anchor downloads the
  export; the card renders correctly in dark and light and on mobile.

- [x] **Step 6 - Acceptance** - run `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. Export from a populated database and inspect the file:
  settings, catalog with a DLC-to-base link, availability including an
  alternative source, wishlist with a confirmed identity and target price,
  review queues, and recommendation records all present with stable IDs;
  provider snapshots, offers, jobs, and run records absent. Export from an
  empty database. Confirm the existing Settings cards are untouched.
  *Done when:* the document matches the export scope table exactly, both
  populated and empty exports validate, and all three checks are green.

## Files / areas

- `src/lib/export-schema.ts` (new) + fixture tests
- `src/lib/export-data.ts` (new) + `src/lib/export-data.test.ts`
- `src/app/api/export/route.ts` (new)
- `src/components/settings/DataExportCard.tsx` (new)
- `src/app/(app)/settings/page.tsx` - card wiring
- No schema, migration, or pipeline changes

## Data / contracts

- Load-bearing for 18c - lock now:
  - Envelope: `{ version: 1, exportedAt: ISO string, data }`; 18c accepts
    `version: 1` only
  - The Zod schema in `src/lib/export-schema.ts` is the single source of
    truth for the document shape; 18c reuses it for import validation
    instead of defining a second schema
  - Row fields mirror Prisma camelCase names one-to-one; `targetPriceMxn`
    serializes as a string; all Dates are ISO strings; IDs are exported
    verbatim so relational links restore intact; `settings` is null when the
    `AppSettings` row does not exist
  - The `data` key names are exactly the ones listed in the export scope
    table; renaming one is a breaking contract change
- Export contains no secrets: no API keys, sessions, or tokens exist in any
  included table
- Reads are read-only; the route mutates nothing
- No new environment variables or provider calls

## Testing

- Vitest covers `toJsonSafe`, the envelope, and the Zod schemas with small
  fixtures per step (valid rows, wrong enum, malformed date, wrong version,
  empty arrays)
- The builder and route are integration surfaces: verified live with the dev
  server (download, parse, inspect) plus the build, per the standards'
  UI/integration rule
- The test gate applies to Steps 1-3 (pure logic); Steps 4-6 ride on live
  evidence and the build

## Notes for the AI

- Mirror `schema.prisma` exactly when writing the Zod schemas; do not
  invent, drop, or rename fields. If a column's type is unclear, read the
  generated client types rather than guessing.
- Keep the schema file declarative: table schemas grouped in the document's
  key order, no transformations inside Zod except `z.string()` dates. The
  conversion lives in `toJsonSafe` only.
- Validate before download: the route must never return a file that fails
  its own schema. A validation failure is a bug, so a 500 with a generic
  message is correct.
- The counts line in `DataExportCard` uses cheap `count()` queries; do not
  load full rows for display.
- The export route is a route handler, not a server action, because it sets
  download headers (standards: API routes for specific headers).
- Single-user app: no per-user scoping, but the route still goes through the
  existing auth corner like every server entry point. No comments except
  non-obvious decisions; no em dashes in generated content.
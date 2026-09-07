# Feature: Empty-schema import and restore

**From build-plan:** 18c
**Status:** complete

## Goal

Complete feature 18: upload an 18b export file and restore every personal
record in one all-or-nothing transaction, but only while the database holds
no catalog, wishlist, settings, or recommendation data. The import validates
against the exact schema 18b locked, preserves IDs and timestamps, triggers
no provider work, and leaves snapshots to rebuild through manual enrichment
actions.

## Design reference

No mockup exists (19a owns the next prototype round). The surface is one
Settings `SectionCard` beside the existing `DataExportCard`, following the
established card and button system. No new visual design.

## In scope

- `src/lib/import-restore.ts`: per-model date-field revival,
  `assertEmptySchema()` counting every exported model, and
  `restoreExportDocument()` performing the ordered creates inside a passed
  transaction
- `POST /api/import`: auth-guarded route handler accepting the JSON file
  body, validating with the shared `exportDocumentSchema`, refusing
  non-empty schemas with 409, and returning per-domain restored counts
- `DataImportCard` on Settings: file picker, upload button, result toast,
  and the empty-schema rule spelled out
- Page wiring on `/settings`

## Out of scope

- Any provider snapshot restore: metadata, compatibility evidence, offers,
  ITAD identities, and Wallhaven state stay absent until the user runs the
  existing manual enrichment, compatibility, and price actions
- Merging into existing data; the import only ever targets an empty schema
  and refuses otherwise
- Auth artifacts and `SteamConnection`: sign-in provisions them and the
  Steam link is re-established manually after a restore
- Progress streaming for large files; a single request/response is fine at
  personal-library scale
- Selective import (choosing domains); the document restores as a unit
- Changes to the export format or `export-schema.ts`; the import is a
  consumer of that contract

## Restore order (FK integrity, all in one transaction)

The creates run in this order inside one `prisma.$transaction`:

1. `AppSettings` when `settings` is non-null (singleton row 1)
2. Games, two passes: rows with `baseGameId: null` first, then the rest
   (DLCs), so the self-reference resolves
3. `AlternativeSource`
4. `PersonalTag`, `Collection`
5. `LibraryEntry`, `ExternalGameId`, `GameAvailability`, `GameTag`,
   `CollectionMembership`
6. `WishlistEntry` (base-game links now exist)
7. `UnresolvedSteamDlc`, `WishlistImportReview`, `WishlistImportIgnore`,
   `PossibleDuplicate`
8. `RecommendationRun`, then `RecommendationItem`, `RecommendationFeedback`,
   `RecommendationEvent` (they reference runs, games, and wishes)
9. `RecommendationProfile`, `RecommendationPreference`,
   `RecommendationTuneState`, `RecommendationPreset`

Every model uses `createMany` with exported IDs verbatim; DateTime columns
are revived from ISO strings to `Date` via per-model field lists mirroring
`schema.prisma`; `targetPriceMxn` passes its string straight through (Prisma
accepts strings for Decimal columns); Json fields pass through untouched.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Date revival and empty-schema guard** - create
  `src/lib/import-restore.ts` with `reviveRows(rows, dateFields)` mapping
  the named keys of each row to `new Date(value)` and
  `assertEmptySchema(db)`: counts all 23 exported models (the exact
  `buildExportDocument` read set) in parallel and returns
  `{ empty: boolean; nonEmpty: string[] }` using the document's domain key
  names. Ship `import-restore.test.ts` covering revival of multiple date
  fields per row, null preservation, and the guard's empty, non-empty, and
  multi-domain results with mocked delegates.
  *Done when:* the tests pass; `pnpm typecheck` and `pnpm test` green.

- [x] **Step 2 - Ordered restore** - extend the module with
  `restoreExportDocument(db, document)`: runs the documented insert order
  with `createMany` on the passed transaction client, skipping
  `AppSettings`/`RecommendationProfile`/`RecommendationTuneState` when the
  document holds null, and returns per-domain restored counts. Use the
  exported 18b domain types for the input shape. Extend the test file:
  insert calls happen in the documented order, base games precede DLCs, runs
  precede items, singletons are skipped on null, counts match input lengths,
  and no call happens after a thrown failure (transaction aborts).
  *Done when:* the ordering and skip tests pass; typecheck and tests green.

- [x] **Step 3 - Import route** - create `src/app/api/import/route.ts`:
  guarded by the existing auth corner, it reads the JSON body (400 on a
  parse failure), validates with `exportDocumentSchema` (400 with the first
  Zod issue's path), opens one transaction that calls `assertEmptySchema`
  (409 listing the non-empty domains when not empty) and
  `restoreExportDocument`, and returns 200 with the counts. Unexpected
  failures return 500 without partial writes (the transaction guarantees
  this).
  *Done when:* with `pnpm dev`, POSTing a valid export body to `/api/import`
  on an empty database returns 200 with counts and creates the rows;
  posting it again returns 409 with domain names; a malformed body and a
  wrong-version document each return 400; nothing is written on any
  rejection.

- [x] **Step 4 - Import card** - create
  `src/components/settings/DataImportCard.tsx` (client): a `SectionCard`
  (eyebrow "Data", title "Personal-data import") describing the rule
  ("Restores only into an empty schema; refuses while any catalog, wishlist,
  or recommendation data exists"), a file input limited to
  `.json,application/json`, and an upload button that reads the file, POSTs
  it to `/api/import`, toasts the restored counts on success or the server
  error otherwise, disables while uploading, and refreshes the router on
  success. Place it directly below `DataExportCard` on `/settings`.
  *Done when:* choosing a file and uploading restores it on an empty
  database and the settings page reflects the data after the refresh; a
  refusal shows the server's domain list in the toast; the card renders in
  dark and light and on mobile.

- [x] **Step 5 - Acceptance** - run `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. Live checks against the dev server: upload the current
  export (refused with 409), upload a truncated file and a
  wrong-version file (400 each, nothing written). Full restore path: point
  the dev environment at a scratch database (`DATABASE_URL` override with a
  migrated empty schema), upload the export, and verify the counts response,
  a game detail page in its "metadata not available" state, the wishlist
  list with identities and target prices, recommendation history on Today,
  and that no `EnrichmentJob`, `SyncRun`, or snapshot rows were created.
  *Done when:* every rejection behaves as specified with zero partial
  writes, the scratch restore reproduces the exported data with original
  IDs and timestamps, no provider work was triggered, and all three checks
  are green.

## Files / areas

- `src/lib/import-restore.ts` (new) + `src/lib/import-restore.test.ts`
- `src/app/api/import/route.ts` (new)
- `src/components/settings/DataImportCard.tsx` (new)
- `src/app/(app)/settings/page.tsx` - card wiring
- No schema, migration, or export-format changes

## Data / contracts

- Load-bearing, locked by 18b and consumed here: `exportDocumentSchema`,
  `EXPORT_VERSION` (accept `1` only), `ExportDocument`, and the exported
  per-domain schemas. Never define a second import schema.
- Empty-schema definition locked here: zero rows across all 23 models in
  the export read set. Any row anywhere in that set refuses the import,
  including recommendation singletons and review queues.
- Restores preserve exported IDs, `createdAt`, and `updatedAt`; relations
  resolve through the documented insert order; one transaction makes the
  restore all-or-nothing.
- The import triggers no provider work: no enrichment queueing, no Steam
  sync, no price or compatibility refresh. Snapshots rebuild only through
  the existing manual actions.
- Route semantics: 200 with counts, 400 parse/validate, 409 non-empty
  (body lists the non-empty domain names), 500 unexpected. The UI surfaces
  all of them.
- No new environment variables or provider calls.

## Testing

- Vitest covers the restore module: revival, the empty-schema guard, insert
  ordering, singleton skips, count reporting, and abort-on-failure, using
  mocked delegates in the established style
- The route and card are integration surfaces: live dev-server evidence
  (refusals, validation failures, scratch restore) plus the build
- The test gate applies to Steps 1-2 (pure logic with mocked I/O); Steps
  3-5 ride on live evidence and the build

## Notes for the AI

- Inject the transaction client (`db`) into the restore functions rather
  than importing `prisma` inside them; the tests then mock plain objects
  and the route passes `tx`.
- `createMany` with explicit `id` values is correct here: the schema is
  empty, so there is nothing to collide with, and it preserves relational
  links exactly.
- Map date fields per model by reading `schema.prisma`; a missed DateTime
  column surfaces as a Zod-passed string reaching Prisma and failing the
  insert, so mirror the columns carefully (createdAt/updatedAt on every
  model, plus the specific fetched/finished/requested/reviewed/expiry
  columns).
- Do not import `export-schema.ts` for side effects beyond the schema and
  types; the revival helpers live in `import-restore.ts`.
- The card must never hide the refusal rule: the description and the 409
  toast both state it. Server-side refusal is the only gate; do not
  pre-check emptiness client-side.
- The scratch-database acceptance step is the owner's call; if no scratch
  database is practical, the unit tests carry the restore correctness and
  the live refusals carry the route semantics. Never test a restore against
  the populated dev database.
- Single-user app: no per-user scoping, but the route still goes through
  the existing auth corner like every server entry point. No comments
  except non-obvious decisions; no em dashes in generated content.
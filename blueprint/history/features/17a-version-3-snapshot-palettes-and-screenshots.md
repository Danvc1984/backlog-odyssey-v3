# Feature: Version 3 snapshot - palettes and screenshots

**From build-plan:** 17a
**Status:** complete

## Goal

Extend the RAWG enrichment pipeline so every enrichment produces a version 3
snapshot: a derived dominant-color palette (primary/dark/muted) for later
per-game theming, and up to six screenshots. No UI changes in this feature.
This is the data foundation for 17b-17d, and existing games backfill through
the existing re-enrichment route (no dedicated backfill action).

## In scope

- `node-vibrant` dependency, isolated in a small palette module: a pure
  swatch-selection function plus a thin image-bytes extraction wrapper
- Screenshots fetch in the RAWG client: single call, `page_size=6`, RAWG
  `hidden` entries filtered, tolerant of failure exactly like the existing
  game-series sub-call
- Palette derivation during `fetchGame` from the stored background-image
  bytes, non-fatal (null palette on any image failure)
- Payload v3: `RAWG_METADATA_SCHEMA_VERSION` bumped to 3 with `palette` and
  `screenshots` added to both the catalog and wishlist payload builders
- Unit tests per step (Vitest, the test gate is on)

## Out of scope

- Any UI: hero band, accent tints, screenshots section (17b/17c/17d)
- Consumer guards in existing pages - nothing reads the new fields yet
- A dedicated backfill action (re-enrichment is the route, per plan decision)
- Wishlist fill-only rules (unchanged; wishlist enrichment inherits v3
  automatically through the same pipeline)
- Job stage/progress/queue changes (the extra work rides the existing
  MATCHING stage)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Palette module and dependency** - add `node-vibrant` to
  dependencies; add `RawgPalette` to `rawg-types.ts`; create
  `src/lib/palette.ts` with a pure `selectPaletteFromSwatches` (mapping:
  primary = Vibrant -> DarkVibrant -> first available swatch; dark =
  DarkVibrant -> DarkMuted -> primary; muted = Muted -> LightMuted -> primary;
  no swatches -> null) and a thin `extractPaletteFromImageBytes` wrapper around
  node-vibrant. Ship `palette.test.ts` for the pure selection function only.
  *Done when:* `pnpm test` passes with selection tests covering the happy map,
  each fallback hop, and empty swatches returning null; `pnpm typecheck` green.

- [x] **Step 2 - Screenshots in the RAWG client** - add
  `RawgScreenshotEntry` (`rawgId: number`, `image: string`,
  `width: number | null`, `height: number | null`) to `rawg-types.ts`; add
  `screenshots: RawgScreenshotEntry[]` to `RawgGameDetails`; implement
  `fetchGameScreenshots` in `rawg-api.ts` following the `fetchGameSeries`
  pattern (single call with `page_size=6`, parse entries, skip malformed,
  filter `hidden === true`, cap at 6, return `[]` on any failure) and wire it
  into `fetchGame`. Update all `RawgGameDetails` fixtures to include
  `screenshots: []`. Extend `rawg-api.test.ts`.
  *Done when:* tests prove parsing of a normal page, hidden filtering, the
  6-entry cap, malformed-entry skipping, and failure -> `[]` without failing
  the match; typecheck and tests green.

- [x] **Step 3 - Palette in the pipeline** - add `palette: RawgPalette | null`
  to `RawgGameDetails`; in `fetchGame`, when a background image URL exists,
  fetch its bytes with the shared 10s timeout and call
  `extractPaletteFromImageBytes`; any failure leaves `palette: null` and the
  match still succeeds. Update fixtures (`palette: null`) and extend
  `rawg-api.test.ts` with a mocked-bytes success case and an image-failure
  case (mock the palette module).
  *Done when:* a mocked match returns a palette from image bytes, and an
  image-fetch failure still returns a successful match with `palette: null`;
  typecheck and tests green.

- [x] **Step 4 - Payload v3** - bump `RAWG_METADATA_SCHEMA_VERSION` to 3; add
  `palette: RawgPalette | null` and `screenshots: RawgScreenshotEntry[]` to
  `RawgMetadataPayload`; map both in `toRawgMetadataPayload`
  (`toWishlistMetadataPayload` inherits them via spread, and the wishlist
  queue and action paths change with it). Update the full-payload equality
  assertions in `rawg-enrichment.test.ts`; keep `parseRawgMetadataPayload`
  unchanged and add a test that a v2-shaped row still parses.
  *Done when:* builders emit `schemaVersion: 3` with palette and screenshots
  present (null/[] on the incomplete fixture), a v2-shaped row parses, and
  typecheck/tests/build are green.

- [x] **Step 5 - Pipeline verification** - run `pnpm typecheck`, `pnpm test`,
  and `pnpm build`. Then with `pnpm dev`, re-enrich one already-enriched game
  through the existing per-game RAWG action (accept the overwrite warning) and
  inspect its `MetadataSnapshot` payload (Prisma Studio or a direct query).
  *Done when:* the re-enriched snapshot shows `schemaVersion: 3` with either a
  real palette object or explicit null, and a screenshots array; an
  un-re-enriched older game still renders its detail page unchanged (v2 row
  tolerated); all three checks green.

## Files / areas

- `package.json` - add `node-vibrant`
- `src/lib/rawg-types.ts` - `RawgPalette`, `RawgScreenshotEntry`, payload
  fields, schema version const, `RawgGameDetails` additions
- `src/lib/palette.ts` (new) + `src/lib/palette.test.ts`
- `src/lib/rawg-api.ts` + `src/lib/rawg-api.test.ts`
- `src/lib/rawg-enrichment.ts` + `src/lib/rawg-enrichment.test.ts`
- Fixture-only touches where `RawgGameDetails` literals exist:
  `src/lib/rawg-job-runner.test.ts`, `src/actions/wishlist-rawg.test.ts`,
  and any wishlist-rawg-queue test fixtures

## Data / contracts

Load-bearing for 17b-17d - lock now:

- `RawgPalette`: `{ primary: string; dark: string; muted: string }` - hex
  color strings derived server-side, persisted, applied read-only later
- `RawgScreenshotEntry`: `{ rawgId: number; image: string; width: number |
  null; height: number | null }`
- Payload v3 additions: `schemaVersion: 3`, `palette: RawgPalette | null`,
  `screenshots: RawgScreenshotEntry[]` (cap 6, hidden filtered) on both
  `RawgMetadataPayload` and `RawgWishlistMetadataPayload`
- Runtime guard constraint (extends the existing ESRB/seriesGames rule): v1/v2
  snapshot rows lack the new keys despite the type making them non-optional;
  every future UI consumer must guard with optional chaining, `?? []`, and
  `?? null`
- No Prisma migration: both snapshot tables store the payload in JSON columns
- Screenshots sub-call tolerance mirrors `fetchGameSeries`: failures yield
  `[]` and never fail the job; a later re-enrichment backfills

## Testing

- Vitest is the configured runner; each logic-bearing step ships its tests as
  named in the steps: palette swatch selection, screenshots parsing/tolerance,
  payload v3 mapping, and v2-row parse tolerance
- The node-vibrant wrapper itself is not unit-tested; it is mocked in the
  Step 3 pipeline test and proven live in Step 5
- Browser evidence: Step 5's live re-enrichment plus unchanged rendering of a
  v2-row game detail page

## Notes for the AI

- `rawg-api.ts` is `server-only`; keep the node-vibrant import out of any
  client bundle by confining it to `palette.ts`, which only server code
  imports
- Keep the `fetchFn` injection pattern used by every RAWG client function so
  tests mock HTTP cleanly
- Follow existing parser conventions: skip malformed entries, nullable
  strings via `nullableString`, no `any`
- If node-vibrant's default entry misbehaves under Node, switch to
  `@vibrant/core` + `@vibrant/image-node` without changing the `palette.ts`
  interface
- No comments except non-obvious decisions; no em dashes in generated content

## Findings

### 17a/F-16 [P3] fixed - Wishlist and library pages load unbounded rows including full RAWG payloads

**File:** src/app/(app)/wishlist/page.tsx:26
**Found:** 2026-08-21 by /audit (scope: full; lens: performance)
**Why it matters:** Both pages use `findMany` with no `take`; wishlist serializes each entry's full RAWG snapshot payload plus the whole base-game list into client components, and `readPendingRawgFollowUps` rescans batches on every status read (src/lib/rawg-batch-runner.ts:86). Fine at current scale, grows linearly and unbounded. Not confirmed as a defect: RSC payload sizes and query timing at realistic row counts were not measured at runtime.
**Suggested fix:** When it bites: select only card fields (strip payloads to needed keys) and cap or paginate lists. Track until measured.
**Resolution:** Re-checked 2026-09-03 by /audit (scope: full; lens: performance): code unchanged, still unbounded (`wishlist/page.tsx:43`, `library/page.tsx:175`). Same payload-scan pattern confirmed in more places (today/page.tsx:136,163; collections/[id]/page.tsx:119; detail payload to client in wishlist/[id]/page.tsx:270, tracked as F-20/F-24). Still unverified at runtime.
**Resolution:** 2026-09-03 by /implement: projected wishlist, library, and collection card metadata on the server, so only the fields consumed by cards cross the client boundary. Added unit coverage for both metadata view helpers; the full test suite, typecheck, lint, and Webpack build pass.

### 17a/F-17 [P2] fixed - RAWG and compatibility pipelines duplicate runner, batch, and action scaffolding

**File:** src/lib/rawg-job-runner.ts:70 (vs src/lib/compat-job-runner.ts:56)
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** The RAWG and compatibility enrichment pipelines are parallel implementations of the same machinery: identical `retryDelay` and retryable-error predicates, same claim-`updateMany`/RETRY_WAIT/terminal-update shapes, near-identical batch runners (`rawg-batch-runner.ts` vs `compat-batch-runner.ts`), ~85% line-for-line batch-start actions (`src/actions/rawg-batch-enrichment.ts:47-161` vs `compat-batch-enrichment.ts:50-158`), and run-record lifecycle copy-paste (`price-refresh.ts` vs `wishlist-compat-sweep.ts`, including a duplicated `ABANDONED_RUN_MS`). A retry or claim bug fixed in one pipeline will predictably be missed in the other.
**Suggested fix:** Extract one shared job-runner and one batch-sweep skeleton parameterized by provider and eligibility; share the run-record lifecycle helpers. Smallest useful first step: the identical job-runner helpers (retryDelay, retryable predicate, claim, terminal updates).
**Resolution:** 2026-09-03 by /fix (commit 79863d1): the job-runner layer is deduplicated - `src/lib/enrichment-job-shared.ts` now owns `jobRetryDelay`, the retryable predicate, the claim where-shape, and the RETRY_WAIT/terminal/SUCCEEDED update-data builders used by both runners, with its own unit tests. Remaining open scope: batch-start actions (~85% line-for-line), batch runners, and the price-refresh/wishlist-compat-sweep run-record lifecycle including the duplicated `ABANDONED_RUN_MS`.
**Resolution:** 2026-09-03 by /implement: shared batch-start, batch-runner, and run-record lifecycle helpers now serve both RAWG and compatibility flows while preserving provider-specific views and result shapes. Full tests, typecheck, lint, and Webpack build pass.

### 17a/F-18 [P2] fixed - updateRecommendations spans roughly 320 lines inside a 1282-line action module

**File:** src/actions/recommendations.ts:449
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `updateRecommendations` (lines 449-769) is one `$transaction` doing pruning, profile update, tune, calibration, exposure, play rerank, buy rerank, and snapshots, in a module that also carries 15 other exports. Far past the 50-line guideline and the hardest code in the app to change safely.
**Suggested fix:** Split the transaction body into named per-concern helpers in `src/lib/recommendations/` (calibration, exposure, rerank) with their own tests; keep the action as the guard + transaction wrapper.
**Resolution:** 2026-09-03 by /implement: moved the transaction pipeline into named orchestration and helper functions under `src/lib/recommendations/`; the action now retains only authentication, transaction wrapping, and error shaping. Existing recommendation tests pass without assertion changes.

### 17a/F-19 [P2] fixed - planMergeMutations spans roughly 327 lines in a 1131-line module

**File:** src/lib/catalog-operations.ts:804
**Found:** 2026-09-03 by /audit (scope: full; lens: quality)
**Why it matters:** `planMergeMutations` (lines 804-1131) plans the entire merge mutation set in one function, and the module mixes snapshot envelopes, TTL/state, personal-field resolution, merge planning, and delete planning. Merge is the most destructive operation in the app; its planning code should be the easiest to read.
**Suggested fix:** Extract per-relationship planners (external IDs, availability, tags, collections, wishlist) into small functions beside it; no behavior change.
**Resolution:** 2026-09-03 by /implement: split the merge plan into per-relationship planners sharing a small context and snapshot pushers. The comprehensive catalog suites pass without assertion changes.

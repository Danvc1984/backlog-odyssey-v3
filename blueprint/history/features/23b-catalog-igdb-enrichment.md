# Feature: Catalog IGDB enrichment

**From build-plan:** 23b, second sub-feature of 23 (IGDB as primary metadata,
artwork, and playtime provider)
**Status:** in progress - review required
**Branch:** `feature/igdb-catalog-enrichment`

## Goal

Make IGDB the working catalog metadata provider: persist the locked
`IgdbMetadataPayload` v1 as a replaceable `MetadataSnapshot` with artwork/screenshot
capture and derived palettes, run it through the existing persistent
`EnrichmentJob` queue (post-import, individual, and catalog-wide) with overwrite
warnings and manual search, and cut the catalog display surfaces over to IGDB
evidence. After this feature the catalog reads IGDB snapshots only; RAWG
catalog UI is gone while RAWG client code, wishlist flows, engine reads, and
the clean-restart procedure wait for 23d/23e.

## Design reference

None. This feature composes existing, approved surfaces (metadata section,
enrichment panel, screenshots carousel, library cards) with the established
Dawn/Sunset design system; it introduces no new visual target.

## In scope

- Schema addition: nullable `selectedIgdbId Int?` on `EnrichmentJob` with a
  migration; IGDB job constants and state machine mirroring the RAWG ones.
- Snapshot persistence: one replaceable `MetadataSnapshot` row per game with
  `provider: IGDB`, payload from `parseIgdbGameToPayload`, `sourceUrl` from the
  payload attribution, and palette capture from image bytes in the fallback
  order artwork, screenshot, cover (null palette when capture fails).
- IGDB enrichment job runner over the shared job plumbing: claim, match via
  23a's `matchIgdbGame`, retry/backoff, ambiguous-to-review, terminal failure,
  success, and a best-effort compatibility queue hook after a successful IGDB
  persist (parity with the RAWG trigger so compatibility keeps flowing).
- Search paging: an `offset` option for `searchIgdbCandidates` used by
  load-more candidate fetching.
- Server actions: individual enrichment request with overwrite guard, manual
  match review, candidate selection, load-more candidates, cancel, and
  apply-IGDB-title.
- Job status/advance routes under `/api/enrichment/igdb/` (job and batch),
  mirroring the RAWG routes.
- Game detail cutover: IGDB metadata section with progressive disclosure for
  dense fields, hero art in the wide fallback order (artwork, screenshot,
  cover, deterministic local fallback), theme palette from the IGDB snapshot,
  screenshots section with IGDB attribution, and an IGDB enrichment panel with
  portrait cover candidates and inline overwrite confirmation. The RAWG
  enrichment panel is removed from the page.
- Library card imagery and Today catalog-coverage re-pointed to IGDB snapshots.
- Catalog-wide batch: start action, batch runner with concurrency 4, settings
  controls swapped from RAWG to IGDB (failed-jobs list and retry button stay).
- Post-import queueing: Steam import queues IGDB enrichment for imported games
  (import only; manual Steam sync never queues enrichment), and the retry
  action registers IGDB.

## Out of scope

- Playtime: IGDB `game_time_to_beats`, SteamSpy fallback, duration profiles,
  and `durationBand` wiring (23c).
- Wishlist IGDB enrichment, identity suggestions, store-link retirement, and
  acquisition metadata transfer (23d); wishlist RAWG flows stay untouched.
- Recommendation engine re-keying, compatibility auto-queue relocation,
  attribution copy outside the changed surfaces, RAWG client/env/code removal,
  stale-snapshot presentation, and the documented clean restart (23e).
- RAWG catalog *code* removal: the RAWG actions, runner, and API stay in place
  (unused by catalog UI) until 23e deletes them; only their catalog UI wiring
  is removed here.
- Metadata fields beyond the locked `IgdbMetadataPayload` v1 contract (for
  example non-official website categories); the contract is not widened here.
- Videos, achievements, system requirements (deferred by the plans).

## Build loop

Build one small step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, and `pnpm lint` must pass before a step is
   accepted; `pnpm build` at display and wiring steps.

## Build steps

- [x] **Step 1 - Job contract and schema support** - Add nullable
  `selectedIgdbId Int?` to `EnrichmentJob` plus the migration. Create
  `src/lib/igdb-job.ts` mirroring `rawg-job.ts` (max attempts 3, progress map,
  valid transitions, initial state, active-status check). Extract the
  provider-agnostic batch summary math from `rawg-batch.ts` into
  `src/lib/enrichment-batch-summary.ts` and re-export it from `rawg-batch.ts`
  so RAWG call sites are unchanged. *Done when:* `pnpm prisma:migrate` applies,
  all existing tests pass unchanged, and `pnpm typecheck`, `pnpm lint`,
  `pnpm test` are green with no runtime behavior change.

- [x] **Step 2 - Snapshot persistence with palette capture** - Extend
  `src/lib/igdb-enrichment.ts` with `persistIgdbSnapshot(gameId, game,
  fetchedAt, options)`: build the payload via `parseIgdbGameToPayload`, capture
  the palette from image bytes in the order first artwork, first screenshot,
  cover (10-second timeout per fetch, injectable fetch for tests, reuse
  `extractPaletteFromImageBytes`), then in one transaction `deleteMany` +
  `create` the `MetadataSnapshot` (provider IGDB, `sourceUrl` from attribution,
  `fetchedAt`). Capture or parse failure yields `palette: null` and never fails
  persistence; no binaries are stored. Export the pure source-order helper for
  tests. *Done when:* Vitest proves replace-not-retain, the palette source
  order, null palette on fetch/extract failure, snapshot field mapping, and
  that the previous snapshot row is not retained.

- [x] **Step 3 - Job runner and status route** - Add
  `src/lib/igdb-job-runner.ts`: claim through the shared helpers with provider
  IGDB; `matchIgdbGame` with the game's Steam App ID, the stored
  `selectedIgdbId`, and the category class derived from the game's type
  (BASE_GAME maps to MAIN_GAME, DLC maps to DLC); `UNAVAILABLE` retryable
  errors to `RETRY_WAIT` (shared backoff) else terminal `FAILED`; `AMBIGUOUS`
  to `AWAITING_MATCH` with `{ candidates, nextPage }` in `candidatePayload`;
  `NOT_FOUND` terminal; `MATCHED` to `PERSISTING`, then `persistIgdbIdentity`
  followed by `persistIgdbSnapshot`, a best-effort `queueCompatibilityForGame`,
  and the success update that clears `candidatePayload`. Export a read-only
  `getIgdbJobStatus` from the runner module (mirroring the RAWG layout) and add
  the route `src/app/api/enrichment/igdb/[jobId]/route.ts` with `GET` status
  and `POST` advance behind `requireUser()`. Extend `IgdbRequestOptions` with `offset` and
  thread it into the games search query. *Done when:* Vitest proves the full
  lifecycle, retry and exhaustion, ambiguity persistence, identity-conflict
  failure without a snapshot, compatibility best-effort isolation, and that the
  route rejects unauthenticated calls; `pnpm build` passes.

- [x] **Step 4 - Job view and enrichment actions** - Add
  `src/lib/igdb-job-view.ts` (view type including ranked candidates with
  `coverUrl`, tolerant `candidatePayload` parsing, `selectedIgdbId`). Create
  `src/actions/igdb-enrichment.ts` with the RAWG-shaped action set:
  `requestIgdbEnrichment` (rejects hidden games, returns an active job,
  returns `OVERWRITE_REQUIRED` with the existing fetchedAt when an IGDB
  snapshot exists and `confirmOverwrite` is false), `requestIgdbMatchReview`
  (initial search into `AWAITING_MATCH`), `selectIgdbMatch` (validates the
  candidate belongs to the stored payload, resets to `QUEUED` with attempt 0
  and `selectedIgdbId`), `cancelIgdbEnrichment`, `loadMoreIgdbCandidates`
  (offset paging by search limit, dedupe, hasMore only on a full page), and
  `applyIgdbTitle` (copies the payload name to `game.name`). All behind
  `requireUser()` with strict Zod schemas and the standard
  `{ success, data, error }` shape. *Done when:* Vitest covers every guard,
  selection validation, cancel, and paging; `pnpm typecheck`, `pnpm lint`,
  `pnpm test` pass.

- [x] **Step 5 - Game detail IGDB display** - Switch
  `src/app/(app)/games/[id]/page.tsx` to read the latest IGDB snapshot and IGDB
  job. Update `MetadataSection` to render the IGDB payload with progressive
  disclosure: always visible summary, first release date, genres, developers,
  publishers, and ESRB label; a collapsed "more details" disclosure holding
  themes, keywords, alternative names, official website, all three rating
  entries with counts, collection, franchise, relations grouped by kind, game
  modes, and multiplayer modes. Hero art resolves the wide fallback order
  (artwork, screenshot, cover, then the existing deterministic gradient), the
  page theme derives from `payload.palette`, the screenshots section renders
  IGDB screenshots with IGDB attribution, and reduced-data behavior is
  preserved. Remove the `RawgEnrichmentPanel` wiring from the page (the panel
  component is replaced in the next step; enrichment controls are temporarily
  absent). *Done when:* `pnpm build`, typecheck, lint, test pass, and a manual
  walkthrough shows an IGDB-enriched game with metadata, hero, screenshots, and
  theme while a non-enriched game shows the existing missing-metadata state.

- [x] **Step 6 - IGDB enrichment panel** - Add
  `src/components/games/IgdbEnrichmentPanel.tsx` mirroring the RAWG panel
  behavior: load action, portrait cover candidates (candidate name, release
  date, cover image) with client-side paging and load-more, inline overwrite
  confirmation, 2-second polling of the job route with drive-on-queued POSTs,
  retry countdown, progress bar, class-mismatch note on manual selection,
  failed state with try-again, and a "Use IGDB title" block when the matched
  name differs from the catalog name. Wire it into the game detail page and
  delete `RawgEnrichmentPanel.tsx`. *Done when:* the walkthrough enqueues,
  reviews candidates with visible covers, selects a match, sees progress to
  success, sees the overwrite warning on a re-load, and `pnpm build` and the
  test gates pass.

- [x] **Step 7 - Library, collections, and Today card surfaces** - Extend
  `src/lib/card-metadata-view.ts` with an IGDB path (cover for compact/portrait
  spaces, wide first-of-order for wide consumers). Re-point the catalog
  snapshot queries from RAWG to IGDB in the Library page, the collection detail
  page, and the Today page, and update their copy: the library card rating
  badge label (IGDB total rating with the aggregated rating as fallback,
  matching the plan's quality basis), the `LibraryHealthStrip` "missing
  coverage" detail, the Today coverage counts and "games missing metadata"
  dialog, and any card missing-metadata guidance. Games without an IGDB
  snapshot keep the deterministic gradients and existing missing-metadata
  treatment. *Done when:*
  the Library grid and list show IGDB covers and rating labels after
  enrichment, collection and Today cards render IGDB imagery, the Today
  coverage dialog reports games missing IGDB metadata, and the gates pass.

- [x] **Step 8 - Catalog-wide batch and Settings** - Widen
  `startProviderEnrichmentBatch`'s provider union with `IGDB`. Add
  `src/actions/igdb-batch-enrichment.ts` (`startIgdbCatalogEnrichment`:
  BASE_GAME, non-hidden, no existing IGDB snapshot, no active IGDB job) and
  `src/lib/igdb-batch-runner.ts` (claim up to 4 ready jobs, run concurrently
  through the IGDB runner, refresh counts/status, follow-up lists for
  awaiting-match and failed games) plus the route
  `src/app/api/enrichment/igdb/batches/[batchId]/route.ts`. Swap the Settings
  RAWG batch button and panel for IGDB twins and update the sweep panel's
  titles, copy, and its retryable-provider list to include IGDB, keeping the
  failed-jobs retry list provider-neutral. *Done when:* a catalog-wide run
  enqueues eligible games, reports progress and partial failure with
  awaiting-match and failed game lists, ignores games with snapshots or active
  work, the Settings page shows only IGDB catalog controls, and the gates
  pass.

- [x] **Step 9 - Post-import queueing and retry registration** - Add
  `src/lib/igdb-import-queue.ts` mirroring the RAWG import queue (eligible:
  imported, BASE_GAME, non-hidden, no IGDB snapshot, no active IGDB job;
  reuses or creates the RUNNING IGDB batch) and switch
  `src/actions/steam-import.ts` to queue IGDB after a successful or partially
  committed import, degrading to a deferred status when queueing fails, and
  update the Steam connection card's queue toast and result copy. Add `IGDB`
  to the retry action's retryable providers and run the IGDB runner, preserving
  the attempt-reset semantics (attempt 0, `nextAttemptAt` null, candidate
  payload and `selectedIgdbId` preserved so a selected match resumes instead of
  rematching). *Done when:* Vitest proves import queue eligibility and the
  deferred degrade, retry resets without rematching a selected match, the
  import flow copy names IGDB, and `pnpm build`, typecheck, lint, and test all
  pass.

## Files / areas

- `prisma/schema.prisma` and one migration (`EnrichmentJob.selectedIgdbId`).
- `src/lib/igdb-job.ts` (new), `src/lib/igdb-job-view.ts` (new),
  `src/lib/igdb-job-runner.ts` (new, includes the status read helper).
- `src/lib/igdb-enrichment.ts` (extend: snapshot persistence, palette capture).
- `src/lib/igdb-api.ts` (extend: search `offset` option).
- `src/lib/enrichment-batch-summary.ts` (new, extracted), `src/lib/rawg-batch.ts`
  (re-export only).
- `src/lib/enrichment-batch-start.ts` (provider union widening).
- `src/lib/igdb-batch-runner.ts` (new), `src/lib/igdb-import-queue.ts` (new).
- `src/actions/igdb-enrichment.ts` (new), `src/actions/igdb-batch-enrichment.ts`
  (new), `src/actions/steam-import.ts` (queue call swap),
  `src/actions/enrichment-retry.ts` (IGDB registration).
- `src/app/api/enrichment/igdb/[jobId]/route.ts` and
  `src/app/api/enrichment/igdb/batches/[batchId]/route.ts` (new).
- `src/app/(app)/games/[id]/page.tsx` and `src/components/games/` (metadata
  section rendering, `IgdbEnrichmentPanel.tsx` new, `RawgEnrichmentPanel.tsx`
  deleted, hero/screenshots provider labels).
- `src/lib/card-metadata-view.ts` and Library/Today card + coverage consumers.
- `src/app/(app)/settings/page.tsx` and the batch panel components.
- Colocated `.test.ts` files for every new logic-bearing module.

## Data / contracts

- `EnrichmentJob` gains `selectedIgdbId Int?` (load-bearing: the manual match
  and retry-resume contract for 23c/23d). `candidatePayload` stores
  `{ candidates: IgdbSearchCandidate[], nextPage: number | null }`; candidates
  carry `id`, `slug`, `name`, `alternativeNames`, `category`,
  `firstReleaseDate`, `coverUrl` so the panel can render portraits and the
  selector can validate.
- Snapshot row: `MetadataSnapshot { provider: IGDB, payload:
  IgdbMetadataPayload (schemaVersion 1, locked in 23a), sourceUrl:
  attribution.sourceUrl, fetchedAt: enrichment time }`. Replaceable:
  `deleteMany` then `create` per enrichment; exactly one row per game.
  `palette` is captured during persistence (artwork, then screenshot, then
  cover bytes; null on failure) and re-derived on re-enrichment.
- Identity: unchanged from 23a; `persistIgdbIdentity` runs before the snapshot
  write. Both writes are idempotent delete-then-create, so a failure between
  them is repaired by the next attempt.
- Job lifecycle: identical states and stages to the RAWG jobs
  (`QUEUED/RUNNING/RETRY_WAIT/AWAITING_MATCH/SUCCEEDED/FAILED` over
  `MATCHING/PERSISTING/RETRYING/COMPLETE/FAILED`), max 3 attempts, shared
  backoff, hidden games excluded at claim and enqueue. `MANUAL_IGDB_SEARCH`
  selection records `classMismatch` on the match result for UI surfacing.
- Routes: `GET`/`POST /api/enrichment/igdb/[jobId]` and
  `GET`/`POST /api/enrichment/igdb/batches/[batchId]`, both `requireUser()`
  gated, mirroring the RAWG route contracts.
- Actions return `{ success, data, error }`; the overwrite guard returns
  `{ kind: "OVERWRITE_REQUIRED", existingFetchedAt }` inside `data`, matching
  the RAWG action's shape.
- Batch: `SyncRun` with provider IGDB, the shared seven-bucket counts shape,
  concurrency 4 (the 4 req/s / 8 concurrent limiter is the real ceiling;
  batch claims stay below it).
- Load-bearing for later features: the payload v1 contract (23c duration
  display, 23d wishlist, 23e engines); the `selectedIgdbId` job field; the
  `/api/enrichment/igdb/*` route shape; the batch `SyncRun` counts shape.

- [x] **Step 10 - Curated IGDB media** - Restrict parsed IGDB artwork assets to only key art, artwork, and concept art, excluding logos and any other image types. Keep covers and screenshots, and rename the game-detail media section from "Screenshots" to "Artwork and screenshots" (including its carousel label and attribution copy). Update focused payload and view tests. *Done when:* an IGDB logo is absent from the persisted/displayed media, valid key art/artwork/concept art/cover/screenshots remain, and the targeted tests plus typecheck pass.

## Testing

- Vitest (gate is on) for: snapshot persistence and palette order, job runner
  lifecycle and retries, job view parsing, all server actions' guards and
  paging, batch start eligibility and runner summaries, import queue
  eligibility, retry registration semantics, wide-image and card view helpers.
  Prisma and fetch are mocked; no live IGDB, Twitch, or image-CDN calls; fake
  timers for time-dependent logic.
- UI rides on `pnpm build` plus the manual walkthroughs named in each step's
  done-when (per the coding standards' test gate).

## Notes for the AI

- Keep every credential, token, and provider call server-side; the panel and
  cards are client components that only call actions and routes.
- The snapshot display paths read the IGDB snapshot only. Do not add RAWG
  fallback rendering; legacy RAWG rows are neither displayed nor migrated, and
  the documented clean restart rebuilds provider data.
- Reuse the shared job plumbing (`enrichment-job-shared.ts`), the palette
  extractor (`src/lib/palette.ts`), and the batch summary math instead of
  duplicating it; widen shared unions rather than forking modules.
- Match existing conventions: strict Zod in actions, `friendlyActionError`,
  server components by default, `server-only` on provider modules, no
  comments except where they explain why, no em dashes anywhere.
- Never log or expose the IGDB credentials or access token.
- The compatibility queue hook after IGDB success is best-effort and must not
  fail the job; feature 23e owns the formal auto-queue move.
- Manual Steam synchronization must not queue enrichment; only the explicit
  import does.
- Do not commit, merge, or mark the build-plan item complete during this
  loop; `/complete` owns archive, checkbox, and merge work.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":19103,"specSha256":"72d955d0a6f27493cb8303877ce4955e32a8c1b1dcd497390d2553d21de0c831","branch":"refs/heads/feature/igdb-catalog-enrichment","head":"98fb501e0858d9b67b4a5110e038eb0abc22a98e","baseRef":"refs/heads/main","baseCommit":"98fb501e0858d9b67b4a5110e038eb0abc22a98e","sourceTree":"ec580316933a324a746752fb86a49760ab82a73f","absentOptional":["blueprint/context/review.md"]} -->

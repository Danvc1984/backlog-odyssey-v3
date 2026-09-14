# Feature: DLC metadata, pages, and browsing with IGDB

**From build-plan:** feature 24
**Build attempt:** 1
**Branch:** feature/dlc-metadata-pages-and-browsing-with-igdb
**Status:** verified

## Goal

Rework DLC acquisition as a manual, per-game fetch-and-select flow instead of
owned-sync derivation, give catalog DLCs and DLC wishes their own IGDB
snapshots and dedicated detail pages, make DLCs play-state read-only (no
`LibraryEntry`, ever), retire the owned-sync DLC population, and add a
Has-DLC filter chip to the Library without showing DLC cards there.

## In scope

- A fetch-DLC-list action on the base-game DLC section for games with a
  Steam App ID: Steam `appdetails` `dlc` IDs resolved to names through one
  batched IGDB `external_games` query, falling back to per-app
  `appdetails` names, then raw App IDs.
- An ephemeral, unchecked selection dialog: checked items are marked
  acquired as catalog DLCs; unchecked items persist nothing; already-owned
  or wishlisted DLCs render disabled with badges.
- Acquired DLCs: `type: DLC`, `origin: STEAM_IMPORT`, required
  `baseGameId`, a `GameAvailability` row (`source: STEAM`, `steamAppId`),
  **no `LibraryEntry`**, and IGDB enrichment queued from the exact Steam
  App ID via a DLC-aware queue path. No-IGDB-match DLCs are still created,
  unenriched, with the existing no-metadata presentation.
- Dedicated DLC detail treatment on the existing `/games/[id]` route:
  IGDB metadata and artwork, visible base-game link, and no play-state or
  library-entry UI.
- The base-game DLC section reworked into cover cards (IGDB cover or
  deterministic fallback) linking to DLC pages with IGDB match status, and
  hosting the fetch action.
- Wishlist DLC acquisition stops creating the DLC's `LibraryEntry`; the
  parent play-state offer remains exactly as shipped.
- Owned-sync DLC retirement: no DLC creation or unresolved entries from
  `steam-import`/`steam-sync`; existing `OWNED_SYNC` rows and existing DLC
  `LibraryEntry` rows are deleted in a migration; the settings review card
  remains for `WISHLIST_IMPORT` entries; import-restore ignores library
  entries on DLC games so old exports cannot resurrect them.
- DLC-wish IGDB snapshots: fill-only enrichment resolving identity from
  the owned base game's snapshot relations (exact kind + normalized name
  auto-apply; name variants go to the existing review path) or the wish's
  own Steam App ID via `external_games`; DLC-wish detail shows its own
  snapshot when present, falling back to the base game's evidence.
- Library Has-DLC filter chip following the handheld-filter pattern;
  DLCs never appear in the library grid or list; backlog and play-state
  counting stay base-game only.

## Out of scope

- Any automatic DLC import from Steam owned sync (retired by this feature).
- DLC play states, interest, priority, ratings, or any other
  `LibraryEntry` field on DLCs, owned or wishlisted.
- Removing or redesigning the parent play-state offer on wishlist DLC
  acquisition.
- DLC merge (direct DLC merge stays deferred per the plan).
- Compatibility behavior changes: catalog DLC pages keep rendering
  compatibility exactly as any other game with identity does today; DLC
  wishes stay skipped by the wishlist compatibility pipeline.
- IGDB series/franchise shelves and the Games-with-DLC system shelf
  (feature 27).
- Engine re-derivation (23e) and RAWG code removal.

## Build loop

One step at a time on `feature/dlc-metadata-pages-and-browsing-with-igdb`.
Each step ends reviewable: implementation, focused tests, `pnpm typecheck`,
`pnpm test`, and a presented diff. No `blueprint/config.json` exists, so
there is no configured checkpoint-commit or step-review override; follow
the default review-per-step flow and let `/complete` create the final
feature commit. No declared Verify command exists; typecheck plus tests are
the per-step gate.

## Build steps

1. [x] **DLC-aware IGDB enrichment queue path.** Extend the IGDB queue
   (`src/lib/igdb-import-queue.ts` or a DLC sibling next to it) so DLC
   games can be queued for enrichment: eligibility checks the IGDB
   snapshot/job state as today but does not require a non-hidden
   `LibraryEntry`; reuse the existing `SyncRun` IGDB batch and
   `EnrichmentJob` upsert semantics, including the active-batch join. Keep
   base-game behavior byte-identical.
   *Done when:* queuing a DLC id (no `LibraryEntry`) creates an
   `EnrichmentJob` in the running/pending IGDB batch, base-game queuing is
   unchanged, and unit tests cover DLC eligibility, base-game eligibility,
   and skip counting.

2. [x] **Steam DLC list fetch and IGDB batched name resolution.** Add a
   server-only lib (e.g. `src/lib/steam-dlc-list.ts`) that (a) fetches the
   base game's `appdetails` with `filters=basic` and reads the optional
   `data.dlc` numeric array through the existing `fetchWithTimeout` +
   bounded-concurrency patterns in `src/lib/steam-api.ts`, and (b) resolves
   names with one batched IGDB `external_games` query
   (`where uid = ("id1",...) & external_game_source = <steam>`, limit ≤
   500 per call, chunked) plus one batched games `fields name` query, then
   falls back per appid to the existing `appdetails` basic-name helper and
   finally to the raw App ID as display name. Fail-soft: provider errors
   degrade to the next fallback, never throw to the caller with a partial
   list lost.
   *Done when:* unit tests with mocked fetch cover: dlc array present,
   absent/empty, IGDB batch hit, IGDB failure → appdetails fallback →
   raw-App-ID names, and malformed-response tolerance.

3. [x] **Fetch and acquire server actions.** Extend `src/actions/dlc.ts` with
   two Zod-validated, `requireUser`-guarded actions:
   `fetchDlcCandidates(baseGameId)` (verifies an owned BASE_GAME with a
   Steam App ID via `ExternalGameId` namespace `STEAM_APP` or STEAM
   availability; returns `{ steamAppId, name, resolvedVia, owned,
   wishlisted }[]`, ephemeral) and `acquireFetchedDlcs(baseGameId,
   items)` (one transaction: for each item, skip if a catalog DLC of this
   base game already holds that Steam App ID via `ExternalGameId`/STEAM
   availability or a wish exists; else create the DLC `origin:
   STEAM_IMPORT` with availability row and `ExternalGameId`
   `EXACT_STEAM_APP_ID`, then queue enrichment via the step-1 path and
   return the queue outcome). Name input is validated (trim, non-empty,
   bounded length); items are bounded to the fetched list length.
   *Done when:* unit tests cover dedupe against existing DLC and
   wishlist rows, no-`LibraryEntry` creation, queue enqueue, invalid input
   rejection, and a base game without a Steam App ID being refused.

4. [x] **Fetch dialog on the base-game detail page.** Add a "Fetch DLC list"
   dialog (shown only when the base game has a Steam App ID) rendering the
   ephemeral unchecked list with accessible checkboxes, disabled rows with
   "Owned"/"In wishlist" badges for existing entries, name rows showing
   the raw App ID when unresolved, loading/empty ("no DLC listed on
   Steam")/provider-error-with-retry states, and a confirm action with
   success toast reporting created vs skipped counts and refresh.
   *Done when:* the dialog opens from the DLC section, acquired DLCs
   appear as new rows, owned/wishlisted rows are non-checkable, and the
   error/empty/loading states are reachable in the UI.

5. [x] **DLC detail treatment on `/games/[id]`.** For `type: DLC`: keep the
   `ParentBaseGameBanner` link; render the IGDB snapshot block (summary,
   release date, genres, ratings, companies as elsewhere), artwork hero
   with fallbacks, and hide all `LibraryEntry`-derived UI (play state
   section, personal fields, library status pill). Keep the metadata
   load/refresh actions working for DLCs. Base-game pages are unchanged.
   *Done when:* an enriched DLC page shows its own metadata and artwork
   with the base-game banner and no play-state controls; an unenriched DLC
   shows the deterministic no-metadata state; a base game renders exactly
   as before.

6. [x] **Cover-card DLC section rework.** Rework `DlcSection` for base games:
   acquired DLCs render as cover cards (IGDB cover when the snapshot has
   one, deterministic fallback otherwise) linking to `/games/[id]` with an
   IGDB match-status badge (enriched / no match / pending), the section
   hosts the fetch dialog trigger from step 4, and the wishlist-DLC list
   and "Add wishlist DLC" / manual Create DLC dialogs remain. Manual-only
   base games (no Steam App ID) show the existing creation affordances
   without the fetch trigger.
   *Done when:* a base game with acquired DLCs shows cover cards with
   correct match-status badges and working links; the fetch trigger
   appears only for games with a Steam App ID; wishlist rows are
   unchanged.

7. [x] **Wishlist DLC acquisition stops creating the DLC library entry.** In
   `acquireWishlistDlc`, drop the DLC's `libraryEntry: { create: ... }`;
   keep availability, Steam App ID retention, the parent play-state offer,
   and the wish removal exactly as shipped. The IGDB enrichment queue from
   step 1 runs for the acquired DLC when it carries a Steam App ID.
   *Done when:* acquiring a wishlist DLC creates a catalog DLC with no
   `LibraryEntry`, the parent-update options behave identically, and unit
   tests assert the new shape.

8. [x] **Owned-sync retirement and data cleanup.** Remove the owned-sync DLC
   branches and `upsertUnresolvedSteamDlc` calls from
   `src/actions/steam-import.ts` and `src/actions/steam-sync.ts` (owned
   DLCs are now invisible to sync; no auto-create, no unresolved entry),
   **but preserve the `reconcileWishlistImportDlcs` calls inside
   `steam-import.ts`** — they convert pending `WISHLIST_IMPORT` queue
   items into DLC wishes when a base game is acquired, which is wishlist
   behavior that must keep working. `src/actions/steam-import-wishlist.ts`
   (DLC-wish creation, base-game→DLC wish repair, `WISHLIST_IMPORT`
   queueing) stays untouched. Add one Prisma migration that deletes
   `UnresolvedSteamDlc` rows with `source: OWNED_SYNC` and `LibraryEntry`
   rows whose game is `type: DLC`. Extend `src/lib/import-restore.ts` to
   skip library-entry data on DLC games during restore. Keep the settings
   `UnresolvedDlcReviewCard`, the wishlist-import reappear rules, and the
   export schema unchanged.
   *Done when:* a Steam sync/import creates no catalog DLC and no
   OWNED_SYNC unresolved rows while still reconciling pending
   WISHLIST_IMPORT items on base-game acquisition; the migration removes
   the legacy rows; restoring a pre-feature export yields no DLC library
   entries; the wishlist-import DLC suite (wish creation, repair,
   reconciliation) passes unchanged.

9. [x] **Library Has-DLC filter chip.** Add a `hasDlc` URL param and parser
   following `src/lib/library-handheld-filter.ts`, apply
   `dlcs: { some: {} }` to the base-game list where, add the chip to the
   Library toolbar with correct active/empty-state and reset-filters
   integration, and keep the list showing only base games.
   *Done when:* the chip filters to base games owning acquired DLCs,
   combines with existing filters, resets correctly, and unit tests cover
   the parser and where-fragment.

10. [x] **DLC-wish IGDB snapshots.** Extend the wishlist IGDB flows
    (`wishlist-igdb-queue`/`wishlist-igdb-enrichment`) so DLC wishes get
    their own fill-only snapshot: identity resolves from the owned base
    game's IGDB relations (exact kind + normalized name auto-applies; name
    variants route to the existing review/manual path) or the wish's own
    Steam App ID via `external_games`. The DLC-wish detail page shows its
    own snapshot when present and falls back to the base game's evidence
    otherwise; existing base-game wish behavior is unchanged.
    *Done when:* a DLC wish with a matchable identity gains its own
    snapshot shown on detail, a variant-name case lands in review, and
    base-game wish tests still pass.

11. [x] **DLC breadcrumb path.** On DLC detail pages, render
    `Owned Games Library → Base Game → DLC`, with the base-game crumb
    linking to the parent detail page. Base-game breadcrumbs remain
    unchanged.
    *Done when:* a DLC page exposes a working parent breadcrumb and the
    current DLC remains the final breadcrumb.

12. [x] **Immediate exact-match IGDB enrichment after fetch acquisition.** Keep
    the IGDB game ID found during batched Steam external-game resolution on
    each ephemeral candidate. When a selected candidate has exactly one
    compatible IGDB game, persist its `ExternalGameId` and IGDB metadata
    snapshot immediately after catalog creation. Candidates without an exact
    match, ambiguous matches, or failed immediate persistence still enter the
    DLC enrichment queue. The acquisition remains transactional for catalog
    creation and never creates a `LibraryEntry`.
    *Done when:* an exact fetched candidate has an IGDB snapshot and identity
    before the action returns; unmatched candidates are queued; focused tests
    cover immediate success and fallback queueing.

13. [x] **Wishlist DLC breadcrumb and import enrichment.** Wishlist DLC
    detail pages show `Wishlist → Base Game → DLC`, and Steam wishlist
    imports include new or repaired DLC wishes in the existing automatic
    IGDB enrichment follow-up. Exact Steam App ID or exact base-game relation
    matches enrich immediately; unresolved variants retain the review path.
    *Done when:* wishlist DLC imports are included in enrichment IDs and the
    wishlist detail breadcrumb links to the catalog base game.

14. [x] **Separate paginated DLC card shelves.** Split the base-game DLC
    section into independent Acquired DLC and Wishlist DLC shelves. Each
    shelf shows six cards per page with independent pagination. Wishlist DLC
    uses the same cover-card treatment and detail-link structure as acquired
    DLC while retaining its interest rating.
    *Done when:* each shelf paginates independently at six items, wishlist
    cards show cover/title/status/rating, acquired cards retain IGDB match
    status, and empty shelves do not render misleading pagination.

## Files / areas

- `src/lib/steam-api.ts`, new `src/lib/steam-dlc-list.ts` - DLC list and
  name resolution.
- `src/lib/igdb-api.ts` - batched `external_games`/games queries (new
  helpers, existing patterns).
- `src/lib/igdb-import-queue.ts` - DLC-aware queue path.
- `src/lib/igdb-job-runner.ts`, `src/lib/igdb-enrichment.ts` - verify DLC
  identity/metadata handling; touch only if the runner assumes
  `LibraryEntry`.
- `src/actions/dlc.ts`, `src/components/games/DlcSection.tsx`, new fetch
  dialog component, `src/components/games/CreateDlcDialog.tsx` (context).
- `src/app/(app)/games/[id]/page.tsx` - DLC detail treatment.
- `src/actions/wishlist.ts` - `acquireWishlistDlc` change.
- `src/actions/steam-import.ts`, `src/actions/steam-sync.ts`,
  `src/lib/steam-flow.ts` - owned-sync retirement.
- `prisma/schema.prisma` (unchanged model shape), new cleanup migration,
  `src/lib/import-restore.ts` guard.
- `src/app/(app)/library/page.tsx`, `src/lib/library-handheld-filter.ts`
  (new sibling parser) - Has-DLC chip.
- `src/lib/wishlist-igdb-queue.ts`, `src/lib/wishlist-igdb-enrichment.ts`,
  `src/app/(app)/wishlist/[id]/page.tsx` - DLC-wish snapshots.
- `src/lib/today-data-health.ts` - assert base-game-only counting
  (regression test only).

## Data / contracts

- `Origin` stays `STEAM_IMPORT | MANUAL`; fetched DLCs use `STEAM_IMPORT`.
  `Origin` is immutable once written.
- A fetched/acquired DLC row: `Game { type: DLC, origin: STEAM_IMPORT,
  baseGameId }` + `GameAvailability { source: STEAM, steamAppId }` +
  `ExternalGameId { namespace: STEAM_APP, externalId: <appid>,
  matchMethod: EXACT_STEAM_APP_ID }` and **no** `LibraryEntry` row, ever.
- Steam `appdetails` (keyless): `GET
  https://store.steampowered.com/api/appdetails?appids=<id>&filters=basic`
  → `data.dlc?: number[]`; `data.name` used by the name fallback. Treat
  absence, non-200, and malformed payloads as "no list" (empty, not
  error UI).
- IGDB identity for catalog DLCs: the runner resolves via
  `ExternalGameId` namespace `STEAM_APP` and STEAM availability exactly as
  for base games; fetched DLCs therefore enrich without new identity
  logic. Batched name lookup uses `external_games.uid` +
  `external_game_source` constants already defined in `igdb-api.ts`.
- DLC-wish snapshot identity precedence: own confirmed Steam App ID first,
  then base-game snapshot relations (exact kind + normalized name only).
- Uniqueness/integrity: no unique index covers a DLC's Steam App ID, so
  the acquire transaction must re-check existing catalog DLCs and wishlist
  rows inside the transaction; single-user context makes races otherwise
  negligible but the check stays atomic with creation.
- Cleanup migration is idempotent (row-scoped deletes); export schema
  version unchanged; restore refuses nothing new and silently skips DLC
  library entries.
- All new user-visible strings follow the existing factual copy rules;
  dialog labels announce state changes (loading, results count, errors)
  via existing toast/live-region conventions.

## Testing

- Vitest unit tests (run with `pnpm test`): DLC list fetch + name
  resolution fallbacks; queue eligibility (DLC vs base game); acquire
  action (dedupe, no-`LibraryEntry`, queueing, validation); parser and
  where-fragment for the Has-DLC filter; `acquireWishlistDlc` new shape;
  import-restore DLC library-entry skip; `computeActiveBacklogProgress` /
  `loadTodayDataHealth` base-game-only regression.
- `pnpm typecheck` after every step.
- No browser tests configured; live verification of the dialog and pages
  happens in `/check`.

## Notes for the AI

- The reworked plan text (2026-09-14 discovery) replaces the original
  "Steam post-import enriches DLCs" premise; owned sync must become
  DLC-blind. When in doubt, the manual fetch flow is the only acquisition
  path this feature adds.
- `queueIgdbForImportedGames` currently requires
  `libraryEntry: { is: { hidden: false } }`, which silently excludes
  DLCs; step 1 exists precisely to fix that without changing base-game
  behavior.
- `steam-import.ts` currently auto-creates DLCs when the base identity is
  known (pre-existing behavior); removing that branch is part of step 8,
  not a regression.
- Existing `ParentBaseGameBanner` already covers the DLC base-game link;
  reuse it rather than adding a new banner.
- Keep the wishlist unresolved-DLC review UI, `WISHLIST_IMPORT` reappear
  rules, and `src/actions/steam-import-wishlist.ts` untouched; only the
  `OWNED_SYNC` side is retired. `reconcileWishlistImportDlcs` and
  `upsertUnresolvedSteamDlc` in `src/lib/steam-flow.ts` remain exported
  for wishlist use.

## Open questions

None material. Deferred to `/feature`-level review if they surface:
exact fetch-dialog copy (factual, following the Odyssey voice rules for
expressive vs operational text) and the migration's exact filename, both
reversible implementation details.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":19124,"specSha256":"79904119f680d8465a6554cda166418783ab9d4aafc21deafd3a3f693ef835f7","branch":"refs/heads/feature/dlc-metadata-pages-and-browsing-with-igdb","head":"67e4897bd90d45ce4516135b44e310126fa59bec","baseRef":"refs/heads/main","baseCommit":"67e4897bd90d45ce4516135b44e310126fa59bec","sourceTree":"fc2385b0974fa5da6bae9b24e3cb0bd6eb7c0db3","absentOptional":[]} -->

## Manual try guide

### Start

Run `pnpm dev` from the project root and sign in with the configured account. Apply the Feature 24 cleanup migration only after reviewing the affected database rows and taking the normal database backup.

### Open

Open an owned base-game detail page at `/games/<base-game-id>` with a Steam App ID.

### Do

1. Open the DLC section and choose **Fetch DLC list**.
2. Select DLC candidates and acquire them.
3. Add or import wishlist DLC for the same base game.
4. If each shelf has more than six items, paginate the acquired and wishlist shelves independently.
5. Open an acquired DLC and a wishlist DLC, then follow their base-game breadcrumbs.
6. Open Library and use the **Has DLC** filter.

### Expect

- Acquired and wishlist DLC appear in separate cover-card shelves.
- Each shelf shows six cards per page and paginates independently.
- Wishlist cards show their cover, title, wishlist state, and interest rating.
- Acquired cards show their IGDB match status.
- DLC detail pages have no library-entry or play-state controls.
- Library results contain base games only, filtered to games with acquired DLC.

### Watch For

- Unchecked fetched candidates must not be persisted.
- Wishlist DLC must not create a DLC `LibraryEntry`.
- The parent game must remain the breadcrumb source.
- Empty or single-page shelves must not show misleading pagination.
- Check browser console and network requests for errors during fetch, acquisition, and navigation.

# Feature: Wishlist IGDB flows and identity suggestions

**From build-plan:** 23d, fourth sub-feature of 23 (IGDB as primary metadata,
artwork, and playtime provider)
**Status:** verified
**Branch:** `feature/wishlist-igdb-flows`

## Goal

Switch every wishlist metadata and identity flow from RAWG to IGDB: fill-only
IGDB enrichment for base-game wishes, explicit replace paths (manual refresh
and changed IGDB identity) behind an overwrite warning, automatic application
of a Steam App ID derived from any fixed high-confidence or manual IGDB match
(identity stays editable), wishlist duration evidence from IGDB
`game_time_to_beats` with the SteamSpy median fallback, IGDB display on
wishlist browsing and detail, IGDB snapshot transfer on acquisition, and
retirement of the RAWG store-link path plus the Steam `storesearch` fallback.

## Design reference

None. This feature re-keys existing, approved surfaces (game detail's
`MetadataSection`, the catalog IGDB overwrite-warning pattern from
`IgdbEnrichmentPanel`, the existing wishlist identity card and dialog search
flows) onto IGDB data; it introduces no new visual target.

## In scope

- Wishlist IGDB enrichment flows for base-game wishes: a fill-only action
  (creates an IGDB snapshot only when none exists), a manual search-and-select
  action and an explicit refresh action that may replace an existing snapshot
  after the catalog-style overwrite warning, and a provider-agnostic
  remove-metadata action. DLC wishes stay excluded.
- Derived Steam App ID capture: a new IGDB `external_games` reverse lookup
  (IGDB game id -> Steam category-1 uid). Any MATCHED IGDB wishlist result
  (fill, refresh, or manual selection) applies the derived App ID
  automatically when the wish has no confirmed identity, recording provenance
  `IGDB_SUGGESTION` (new enum value) and triggering the existing silent
  wishlist compatibility refresh. An existing identity always wins and stays
  editable via the current controls; a derived App ID that conflicts with
  another wish is skipped and surfaced as a non-blocking warning.
- Wishlist duration evidence: the IGDB wishlist snapshot carries the 23c
  duration evidence (IGDB t2b row, else SteamSpy median only when IGDB has no
  usable row and a confirmed Steam App ID exists - the same rule as catalog)
  inside the snapshot payload, reusing the 23c helpers. This completes the
  23c deferral of wishlist duration surfaces and buy-side DURATION values.
- Wishlist display on IGDB evidence: detail page metadata (reuse
  `MetadataSection` with the wishlist duration adapter), hero image,
  screenshots, palette, inherited-from-base-game note, load/refresh
  enrichment control, provenance label, and copy; wishlist browsing cards
  (cover/art image, description, genres, duration chip, missing-metadata
  copy) on both Focus and List variants.
- Add/Edit wishlist dialogs: IGDB candidate search and selection; the Add
  flow enriches the new wish, the Edit flow replaces the snapshot after the
  overwrite confirm.
- Steam wishlist import follow-up: the fill-only batch queue re-keys from
  RAWG to IGDB with the same `{ enriched, skipped }` contract and the same
  fill-only guard.
- Acquisition transfer: acquiring a base-game wish copies the IGDB snapshot
  into the catalog `MetadataSnapshot` (provider IGDB, palette included) and
  creates the `ExternalGameId` with namespace `IGDB_GAME` and the payload's
  match method, with the IGDB identity conflict check. Legacy RAWG snapshot
  transfer is dropped (transitional; see notes).
- Manual library game identity follow-up: a matched IGDB result may derive a
  Steam App ID for a manual catalog game that has no confirmed Steam identity;
  persist it as an exact `STEAM_APP` external identity and run the existing
  compatibility refresh, while preserving existing identities and skipping
  conflicting App IDs.
- Export/import schema: the new `IGDB_SUGGESTION` provenance value in
  `export-schema.ts` (import-restore consumes the same Zod enum).
- Retirement of the wishlist RAWG machinery: `wishlist-rawg.ts` actions,
  `wishlist-rawg-queue.ts`, the store-link suggestion actions/view/component
  block, `resolveWishlistStoreLink`/`toWishlistMetadataPayload`,
  `WishlistStoreLink`, `findSteamAppIdByName` and the `storesearch` endpoint,
  `RawgMetadataSection`, and the RAWG wishlist card view.

## Out of scope

- Recommendation-dimension re-keying beyond DURATION, RAWG client/catalog
  code removal, stale-snapshot retry presentation, and the documented clean
  restart (23e). Transitional degradation, accepted by the 23 hard-cutover
  decision: buy-engine genre/image parsing of IGDB wishlist payloads
  (`parseRawgMetadataPayload`) returns null until 23e re-keys it, so buy
  cards lose wishlist images and genre-tag factors in the interim. The
  engine's other RAWG reads keep working against legacy catalog rows.
- Removing the `RAWG_SUGGESTION` provenance enum value: it stays in the
  schema (nothing writes it after this feature) so no destructive enum
  migration is needed before the 23e clean restart.
- Catalog RAWG enrichment surfaces (feature 8) and `today-operations` RAWG
  freshness reads (23e attribution swap).
- Price/ITAD behavior, compatibility engine or eligibility rules (the
  confirmed-identity rule already accepts any provenance; the auto-trigger
  reuses `silentlyRefreshWishlistCompatibility` unchanged).
- Other catalog IGDB enrichment behavior (23b) and playtime evidence helpers
  (23c): reused as-is; this feature only adds the manual-game Steam identity
  follow-up described above.
- Wishlist EnrichmentJob queueing: wishlist flows stay synchronous inline
  actions like today; IGDB rate limiting is shared through `requestIgdb`.

## Build loop

Build one small step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, and `pnpm lint` must pass before a step is
   accepted; `pnpm build` at the display and retirement steps.

## Build steps

- [x] **Step 1 - Provenance value and IGDB Steam App ID client** - Add
  `IGDB_SUGGESTION` to the `PriceIdentityProvenance` enum with one migration
  (additive; `RAWG_SUGGESTION` stays until 23e). Add
  `fetchIgdbSteamAppId(igdbId)` to `src/lib/igdb-api.ts`:
  `fields game,uid,external_game_source; where game = <id> & external_game_source = 1; limit 20;` on the
  `external_games` endpoint, returning the first uid matching `/^\d+$/` and
  null when no numeric uid exists; it flows through `requestIgdb` (shared
  rate limiter, 10s timeout). Extend the wishlist provenance Zod enum in
  `export-schema.ts` with `IGDB_SUGGESTION` (import-restore shares it).
  *Done when:* the migration applies; Vitest proves `fetchIgdbSteamAppId`
  (uid found, non-numeric filtered, empty result null) with mocked fetch;
  the export schema accepts and round-trips `IGDB_SUGGESTION`; no runtime
  change.

- [x] **Step 2 - Wishlist IGDB snapshot persistence and payload contract** -
  Export a tolerant stored-payload parser `parseIgdbMetadataPayload(value)`
  from `src/lib/igdb-metadata-payload.ts` (schemaVersion 1 + structural
  fields; null otherwise). Export the palette-capture helper from
  `src/lib/igdb-enrichment.ts` for reuse. Create
  `src/lib/wishlist-igdb-enrichment.ts` (server-only) with the
  `WishlistIgdbSnapshotPayload` type = `IgdbMetadataPayload` plus
  `matchMethod: IgdbMatchMethod` and `durationEvidence`:
  `{ provider: "IGDB" | "STEAMSPY"; payload: IgdbGameTimeToBeats |
  { appId: string; medianForeverMinutes: number }; sourceUrl: string | null;
  fetchedAt: string } | null`, and `persistWishlistIgdbSnapshot(...)`
  replacing the one snapshot row per wish (delete + create in a transaction,
  provider IGDB, palette captured via the shared helper, sourceUrl/fetchedAt
  like the catalog snapshot). *Done when:* Vitest proves persistence (IGDB
  provider, palette, matchMethod, duration block preserved, prior row
  replaced) and tolerant parsing (valid, malformed, non-object); no UI
  change yet.

- [x] **Step 3 - Fill-only wishlist IGDB enrichment with duration and
  identity capture** - Extend `src/lib/wishlist-igdb-enrichment.ts` with the
  shared orchestrator `enrichWishlistBaseGameFromIgdb({ entry, selectedIgdbId
  = null })`: match via `matchIgdbGame` (confirmed Steam App ID when present,
  else title; base-game category), then on MATCHED derive the Steam App ID
  via `fetchIgdbSteamAppId`, apply it only when the wish has no confirmed
  identity (conflict check via the existing `findConflictingEntry` rule,
  provenance `IGDB_SUGGESTION`, then `silentlyRefreshWishlistCompatibility`),
  capture duration evidence (IGDB t2b by matched id; else SteamSpy median
  using the confirmed or derived App ID), persist the snapshot with
  `matchMethod`, and return
  `{ igdbId, name, matchMethod, steamAppIdApplied, steamAppIdConflict }`.
  Duration and identity failures are non-blocking and never fail the
  snapshot. Create `src/actions/wishlist-igdb.ts` with
  `searchWishlistIgdb` (IGDB candidate page) and `fillWishlistIgdbMetadata`
  (fill-only guard; ambiguous and not-found errors direct to the Edit
  search; provider errors surface their message). *Done when:* Vitest
  proves: fill-only guard rejects an existing snapshot; DLC wishes are
  rejected; matched fill
  persists the snapshot, applies the derived identity with `IGDB_SUGGESTION`
  provenance and triggers the compatibility refresh; an existing identity is
  untouched; a conflicting derived App ID is skipped with the conflict
  message; duration is IGDB first, then SteamSpy only when IGDB has no usable
  row and a confirmed or derived App ID exists (no App ID means no SteamSpy
  and null duration); ambiguous,
  not-found, unavailable, and unconfigured IGDB produce the specified
  errors; provider and Prisma mocked.

- [x] **Step 4 - Explicit replace paths** - Add to
  `src/actions/wishlist-igdb.ts`: `refreshWishlistIgdbMetadata` (explicit
  re-match and snapshot replacement; returns `OVERWRITE_REQUIRED` with the
  existing `fetchedAt` when a snapshot exists and `confirmOverwrite` is
  false, mirroring the catalog panel flow),
  `enrichWishlistEntryWithIgdb` (manual selected-IGDB-id match, replaces the
  snapshot, same overwrite confirm, matchMethod `MANUAL_IGDB_SEARCH`), and
  the provider-agnostic `removeWishlistMetadata`. *Done when:* Vitest proves
  the overwrite-required handshake on both replace actions, replacement
  writes a fresh IGDB row, manual matches record `MANUAL_IGDB_SEARCH`, and
  remove deletes the snapshot; no UI change yet.

- [x] **Step 5 - Steam wishlist import follow-up on IGDB** - Replace
  `src/lib/wishlist-rawg-queue.ts` with `src/lib/wishlist-igdb-queue.ts`
  keeping `autoEnrichWishlistEntries(entryIds)` and the
  `{ enriched, skipped }` result: fill-only per entry (skips when a snapshot
  exists), reuse the shared orchestrator, batch pacing under the shared IGDB
  rate limiter. Update `steam-import-wishlist.ts` to the new module and IGDB
  result copy. Delete `wishlist-rawg-queue.ts` and its test.
  *Done when:* Vitest proves batch fill-only behavior, skip-on-snapshot,
  identity application on match, and non-failing per-entry errors; the
  steam-import-wishlist tests pass with the new import.

- [x] **Step 6 - Acquisition transfers the IGDB snapshot** - In
  `acquireWishlistBaseGame`, when the wish's snapshot is provider IGDB:
  copy it to the catalog game's `MetadataSnapshot` (provider IGDB, payload
  including palette, sourceUrl, fetchedAt) and create the `ExternalGameId`
  with namespace `IGDB_GAME`, the payload's `igdbId`, and the payload's
  `matchMethod`, after the namespace+externalId uniqueness check (conflict =
  `ActionError` like the RAWG branch it replaces); a snapshot whose payload
  carries no usable `igdbId` transfers without the external id. RAWG-legacy
  snapshots no longer transfer metadata. *Done when:*
  `wishlist-acquisition.test.ts`
  proves IGDB snapshot + `IGDB_GAME` external-id transfer with the payload's
  matchMethod, the conflict error, and acquisition without metadata when no
  IGDB snapshot exists; suite green.

- [x] **Step 7 - Wishlist detail page on IGDB evidence** - Re-key
  `src/app/(app)/wishlist/[id]/page.tsx` to IGDB snapshots (own snapshot
  first, then the base game's IGDB snapshot for inherited evidence) parsed
  with `parseIgdbMetadataPayload`; render `MetadataSection` (duration
  evidence adapter from the snapshot's `durationEvidence` block and the
  settings `durationProfile`), hero image
  `artworkUrls[0] ?? screenshots[0]?.image ?? coverUrl`,
  `resolveIgdbPageScreenshots`, unchanged palette resolution, inherited-note
  line, IGDB missing-metadata copy, and the `IGDB_SUGGESTION` identity label
  ("from IGDB") in `WishlistIdentity`. Replace `WishlistRawgFillButton`
  with a `WishlistIgdbEnrichmentControl`: `Load IGDB metadata` when no
  snapshot, `Refresh metadata` with the overwrite confirm when one exists;
  toasts surface identity-applied and conflict warnings and direct
  ambiguous/not-found results to the Edit search. DLC wishes keep showing
  the base game's inherited evidence and no enrichment control.
  *Done when:* the browser shows IGDB metadata, themed hero, screenshots,
  load, refresh-with-confirm, and the identity-applied/conflict toasts on a
  wish without identity; `pnpm build` passes.

- [x] **Step 8 - Wishlist browsing cards on IGDB evidence** - Re-key
  `src/app/(app)/wishlist/page.tsx` to IGDB snapshots (own + inherited base
  game) with a new `igdbWishlistCardMetadataView(value, durationHours)` in
  `src/lib/card-metadata-view.ts` (imageUrl
  `artworkUrls[0] ?? screenshots[0]?.image ?? coverUrl`, description =
  summary, duration chip); read `appSettings.durationProfile` on the page;
  update the missing-metadata copy and the inherited note on
  `WishlistCard` (both variants). *Done when:* the browser shows IGDB cards
  with cover/art image, description preview, genre chips, and the selected
  duration estimate where evidence exists; build passes.

- [x] **Step 9 - Add/Edit dialogs on IGDB search** - Switch
  `AddWishlistDialog` and `EditWishlistDialog` to `searchWishlistIgdb` and
  `enrichWishlistEntryWithIgdb`: candidate rows (name, release year, cover
  thumb) with offset-based "Load more" and dedupe, Add enriches the freshly
  created wish with the selected id, Edit asks the overwrite confirm when a
  snapshot exists, labels and error copy say IGDB, and
  identity-applied/conflict toasts surface from the
  enrichment result. *Done when:* the browser walkthrough adds a wish with a
  selected match, pages through matches, edits a wish replacing its snapshot
  after confirm, and
  shows the conflict warning on a clashing App ID; `pnpm build` passes.

- [x] **Step 10 - Buy-engine duration threading** - Wishlist buy candidates
  resolve `durationHours` from the snapshot `durationEvidence` via
  `resolveDurationEstimate` and the run's `durationProfile`
  (`run-pipeline.ts` buy side and tune inputs replacing the 23c nulls), and
  the derived-profile rebuild reads wishlist DURATION signals from wishlist
  IGDB snapshot duration evidence. Duration stays soft evidence with the
  existing clamps and caps. *Done when:* Vitest proves DURATION dimension
  values and Tune `length` matching for wishlist candidates from IGDB and
  SteamSpy-shaped evidence, null when absent, and profile-rebuild DURATION
  signals; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` green.

- [x] **Step 11 - Identity surface cleanup and RAWG wishlist retirement** -
  Remove the RAWG suggestion flow: `confirmRawgSuggestedIdentity` /
  `dismissRawgIdentitySuggestion` actions and tests,
  `wishlistIdentitySnapshotView` / `wishlistIdentitySuggestion` /
  `storeLinkFromSnapshotPayload` (and `src/lib/wishlist-identity-view.ts`),
  and the suggestion block in `WishlistIdentity` (the `IGDB_SUGGESTION`
  label landed in Step 7). Delete the RAWG wishlist machinery:
  `src/actions/wishlist-rawg.ts` (+ test), `resolveWishlistStoreLink`,
  `hasRawgSteamStore`, `toWishlistMetadataPayload`, `WishlistStoreLink`,
  `findSteamAppIdByName` and the `storesearch` endpoint/types in
  `steam-api.ts`, `RawgMetadataSection`, `wishlistCardMetadataView` (+ test),
  and `WishlistRawgFillButton`; sweep for dead imports and copy mentioning
  RAWG in wishlist surfaces. *Done when:* a repo grep shows no wishlist
  RAWG/storesearch/store-link references outside 23e-owned catalog code;
  `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` are green and
  the full wishlist walkthrough (create, enrich, refresh, acquire, import
  follow-up) passes in the browser.

- [x] **Step 12 - Manual library Steam identity follow-up** - Extend the
  catalog IGDB enrichment runner for manually added games with a Steam
  availability row but no confirmed `STEAM_APP` external identity: derive the
  App ID through `fetchIgdbSteamAppId`, persist it as
  `EXACT_STEAM_APP_ID`, preserve existing identities, and keep conflicting
  identities non-blocking. Reuse the existing compatibility queue after the
  match. *Done when:* Vitest proves the derived identity is persisted for a
  manual Steam game, existing and conflicting identities are not overwritten,
  no identity is derived for non-Steam availability, and the existing catalog
  enrichment, compatibility, typecheck, lint, and build checks remain green.

- [x] **Step 13 - Accelerated Steam wishlist enrichment** - Avoid the
  redundant IGDB Steam reverse lookup when a Steam-imported wish already has a
  confirmed identity, run independent identity/duration lookups concurrently
  for identity-less wishes, and raise the wishlist enrichment worker limit to
  six while retaining the shared IGDB limiter. *Done when:* focused tests prove
  confirmed identities skip reverse lookup, identity/duration work can overlap,
  and the queue never exceeds six entries; the import remains fill-only and
  `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma` - `PriceIdentityProvenance.IGDB_SUGGESTION` (+ migration).
- `src/lib/igdb-api.ts` - `fetchIgdbSteamAppId`.
- `src/lib/igdb-metadata-payload.ts` - tolerant `parseIgdbMetadataPayload`.
- `src/lib/igdb-enrichment.ts` - exported palette capture helper.
- `src/lib/wishlist-igdb-enrichment.ts` (new) - payload type, snapshot
  persistence, duration capture, derived-identity application, shared
  orchestrator.
- `src/actions/wishlist-igdb.ts` (new) - search, fill, refresh, manual
  enrich, remove.
- `src/lib/wishlist-igdb-queue.ts` (new) - import follow-up queue.
- `src/actions/steam-import-wishlist.ts` - IGDB follow-up call and copy.
- `src/actions/wishlist.ts` - acquisition transfer.
- `src/app/(app)/wishlist/[id]/page.tsx`,
  `src/components/wishlist/WishlistIgdbEnrichmentControl.tsx` (new),
  `src/components/wishlist/WishlistIdentity.tsx` - detail surfaces.
- `src/app/(app)/wishlist/page.tsx`, `src/components/wishlist/WishlistCard.tsx`,
  `src/lib/card-metadata-view.ts` - browsing surfaces.
- `src/components/wishlist/AddWishlistDialog.tsx`,
  `src/components/wishlist/EditWishlistDialog.tsx` - dialog flows.
- `src/lib/recommendations/run-pipeline.ts`, `pipeline-helpers.ts`,
  `profile.ts` - buy duration threading.
- `src/lib/export-schema.ts` - provenance enum value.
- Deleted: `src/actions/wishlist-rawg.ts`, `src/lib/wishlist-rawg-queue.ts`,
  `src/lib/wishlist-identity-view.ts`,
  `src/components/games/RawgMetadataSection.tsx`,
  `src/components/wishlist/WishlistRawgFillButton.tsx`, plus
  `resolveWishlistStoreLink`/`toWishlistMetadataPayload` in
  `rawg-enrichment.ts` and `findSteamAppIdByName`/storesearch in
  `steam-api.ts`.

## Data / contracts

- Wishlist IGDB snapshot payload (`WishlistMetadataSnapshot`, provider
  `IGDB`, one replaceable row per wish) = the catalog `IgdbMetadataPayload`
  v1 plus two additive fields: `matchMethod: IgdbMatchMethod` (load-bearing:
  acquisition provenance) and `durationEvidence` block (load-bearing: 23e
  buy-engine duration). The duration block mirrors the 23c `PlaytimeEvidence`
  payload shapes exactly (`{ count, hastilySeconds, normallySeconds,
  completelySeconds }` for IGDB; `{ appId, medianForeverMinutes }` for
  SteamSpy) with `provider`, `sourceUrl`, and `fetchedAt`, so
  `resolveDurationEstimate` and `MetadataSection`'s duration props consume
  it through a thin adapter.
- Derived identity: written as `steamAppId` +
  `steamAppIdProvenance: "IGDB_SUGGESTION"` only when both fields are
  currently null, after a wishlist-entry uniqueness check; existing identity
  (any provenance) is never overwritten by enrichment; conflicts skip the
  write and return the conflict message. The write triggers the existing
  silent wishlist compatibility refresh.
- `fetchIgdbSteamAppId(igdbId): Promise<string | null>` - first numeric
  Steam uid (`external_game_source = 1`) from IGDB `external_games`; null on
  none.
- Acquisition transfer: `MetadataSnapshot` (provider IGDB) + `ExternalGameId`
  (namespace `IGDB_GAME`, matchMethod from the payload); conflict when the
  IGDB id is already attached to another catalog game.
- Queue result contract: `{ enriched, skipped }` unchanged from the RAWG
  queue so `steam-import-wishlist` result reporting keeps its shape.
- Load-bearing for 23e: the `WishlistIgdbSnapshotPayload` contract (what the
  engine re-derivation will parse), the `IGDB_SUGGESTION` provenance value
  (export/import schema), and the removal of store-link machinery (RAWG
  catalog retirement builds on it).

## Testing

- Vitest (gate is on) per step: Steam App ID client parsing; snapshot
  persistence and tolerant parsing; fill guard, match outcomes, duration
  capture order, and identity rules (apply, preserve, conflict, compat
  trigger); overwrite-required handshake and manual replace; queue batch
  behavior; acquisition transfer and conflicts; buy duration threading and
  profile signals; export roundtrip. Prisma and fetch mocked; no live
  provider calls.
- Browser walkthroughs (no Playwright): detail-page load and
  refresh-with-overwrite flows; identity auto-applied with "from IGDB"
  provenance and editable afterward; conflict warning path; cards show
  IGDB imagery, description, genres, duration; dialogs search/select/enrich;
  acquisition moves metadata to the new game; Steam wishlist import still
  reports enrichment counts.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` every step; `pnpm build` at the
  display, dialog, and retirement steps.

## Notes for the AI

- Reuse, do not fork: `matchIgdbGame`, `searchIgdbCandidatePage`,
  `parseIgdbGameToPayload`, the palette capture, `resolveDurationEstimate`,
  `findConflictingEntry`, and `silentlyRefreshWishlistCompatibility` are the
  shared foundations; wishlist code composes them server-side.
- Server-only modules for the new lib; `"use server"` actions return
  `{ success, data, error }` and call `requireUser()` first; Zod-validated
  inputs; mocked `fetch`/`prisma` in Vitest; no code comments.
- Transitional state is intentional: wishes still holding RAWG snapshots stop
  rendering metadata until they are re-enriched with IGDB (fill, search, or
  the import follow-up); the 23e clean restart removes the rows. Do not add
  RAWG fallback parsing anywhere.
- Keep the overwrite-warning interaction identical to the catalog
  enrichment panel (`OVERWRITE_REQUIRED` then `confirmOverwrite: true`).
- Match-method honesty: fill and refresh store the actual
  `matchIgdbGame` method (`EXACT_STEAM_APP_ID`, `INFERRED`); only the
  dialog-selected match records `MANUAL_IGDB_SEARCH`.
- The IGDB rate limiter is shared; every IGDB call goes through
  `requestIgdb`, including the new `external_games` lookup and the t2b
  fetch.
- Evidence and status copy stays factual; no Odyssey voice on errors,
  evidence labels, or field help. No em dashes in code or docs.

<!-- blueprint:completion {"schemaVersion":1,"specBytes":24076,"specSha256":"5ca8b0edadfa5de44abd3d2fc6f6363843a9d352799bd130f930978272c4bbfc","branch":"refs/heads/feature/wishlist-igdb-flows","head":"84594c6fcd49ee05559fd4a310620f9623b428ea","baseRef":"refs/heads/main","baseCommit":"84594c6fcd49ee05559fd4a310620f9623b428ea","sourceTree":"6e68da8c082d8f54247c1454011c9fd7786b016f","absentOptional":[]} -->

## Verification

- Automated: pnpm test passed with 139 files and 1,337 tests; pnpm typecheck, pnpm lint, pnpm build, and git diff --check passed.
- Manual acceptance: after the approved clean restart, Steam wishlist import produced 259 base games and 6 DLC; library import restored 147 Steam games while preserving 1 manual game. Wishlist Focus and List showed IGDB artwork, descriptions, genres, and inherited DLC metadata. Wishlist detail showed IGDB metadata, duration, artwork/screenshots, Steam identity, and compatibility evidence. The detail page was rechecked after the duplicate-key correction with no new console errors.
- User acceptance: the user confirmed the feature was approved and tested, and explicitly declined independent review for this closeout.

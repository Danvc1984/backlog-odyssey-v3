# Feature: Detail, collection, and supporting route composition

**From build-plan:** feature 15
**Status:** in progress

## Goal

Bring the remaining surfaces up to the visual state achieved by the Library
and Wishlist in 14c/14d/14e. The feature leads with a Today re-pass so Today
matches the Library/Wishlist visual language, then applies the shared system
to Game Detail, Wishlist Detail, Collections, Settings, and their
dialogs/forms - over unchanged queries, actions, and evidence boundaries.

## Design reference

- `prototypes/today.html`, `prototypes/game-detail.html`, `prototypes/library.html`,
  `prototypes/wishlist.html`, and `prototypes/theme.css` restored from git
  commit `602df5f` (the same restore 14c/14d/14e used) as the operative
  composition reference. This environment cannot render images, so the restore
  happens at implementation time and the HTML carries the exact structure;
  the surface philosophy is also captured in the archived 14c/14d/14e specs.
- `blueprint/reference/reference material*.png` are the original design pack
  already behind the prototypes; treat the prototypes as authoritative.
- The shared token system is already ported into `src/app/globals.css` by 14a,
  so there is no theme-port step in this feature.
- Composition language to homogenize against (from 14b/c/d/e and the
  prototypes): `eyebrow` section labels, `page-header` with display h1 + lede,
  pill buttons, status pills, chip badges, `technical-label` monospace meta,
  `detail-card` grouping with card headings and footers, safe readable artwork
  overlays, deterministic gradient fallbacks, and reduced-data token-only art.

## In scope

- **Today re-pass:** Today currently reads as a long column of bare sections.
  Re-compose it to the prototype's hierarchy using the existing loaded data:
  header with eyebrow + lede + Update recommendations + tune, a hero grid
  (main/in-progress spotlight with play-state/source badges and a buy-signal
  aside with the best current offer), a Play Next runway with dominant Best Fit
  + compact role rail, Buy, and supporting panels (activity, health, coverage,
  operations) in the shared card language.
- **Game Detail:** hero (readable RAWG artwork overlay with title, stat badges,
  source chips, primary/secondary actions that anchor to the existing
  sections), then the existing sections grouped into shared `detail-card`s:
  personal profile, recommendation signal, RAWG metadata, compatibility,
  availability, tags & collections, DLC, and enrichment & controls (including
  delete). All existing actions, read-only evidence boundaries, and destructive
  confirmations preserved.
- **Wishlist Detail:** the same card treatment for /wishlist/[id]: header with
  identity/actions, offers, buy recommendation, compatibility block, metadata,
  fill-only enrichment, notes.
- **Collections:** shared card/pill treatment on /collections and
  /collections/[id], including the collection detail member table and the
  create/edit/delete actions.
- **Settings:** restyle every section into shared cards with eyebrows, and
  review the order and operability of its actions (Steam, appearance,
  compatibility sweep, recommendation profile, alternative sources, unresolved
  DLC). Destructive confirmations and read-only boundaries stay intact.
- **Dialogs and forms:** normalize create/edit/acquire/merge/delete dialogs and
  inline forms (game, DLC, collection, wishlist) to shared button, field,
  spacing, and sheet treatment; nothing behavioral changes.
- **Shared covers:** a deterministic hero-art primitive (artwork with readable
  overlay, gradient fallback, reduced-data token-only mode) reused by Today,
  Game Detail, and Wishlist Detail, consistent with the 14d card cover.

## Out of scope

- Any query, action, filter, or schema change: every route keeps its current
  data contracts, server actions, job behavior, and evidence boundaries.
- Compatibility rows, catalogs-wide counts, or new filters on any surface.
- Dynamic per-game palettes (feature 17), Wallhaven (feature 16), cross-app
  acceptance (14f), and the keyboard shortcut in the mockups.
- Today recommendation or buy semantics: roles, runs, exposure, and Start
  playing keep their shipped behavior; only presentation moves.
- Game-launching, in-app purchases, or any hidden provider work.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Shared surface primitives** - Add `src/components/ui/detail-card.tsx`
      with a `SectionCard` (eyebrow, title, description, optional status-pill
      and aside slots, optional footer) and a `StatusPill` (tone-mapped result
      pill), plus `src/components/ui/detail-hero-art.tsx` and a pure
      `src/lib/detail-art.ts` helper deciding artwork vs deterministic
      gradient vs reduced-data token control (reusing the 14c
      `cover-gradient` / 14d presentation conventions). Add tests for the
      helper. No page wires them yet. *Done when:* the tests pass, the
      components are unused-but-present, and `pnpm build` passes.
- [x] **Step 2 - Today header and hero grid** - Adopt the prototype header
      (eyebrow, display h1 + lede, Update recommendations, tune affordance that
      anchors to the existing TuneThisRunPanel, latest-run technical line) and
      add the hero grid over the already-loaded `todayGames`/`todayOffers`/runs:
      a spotlight card for the main or in-progress game (stat badges, source
      chip, progress meta, actions that anchor to existing detail/today
      sections) and a buy-signal aside for the best current offer. Contextual
      empty states for no main game, no offers, and no runs. *Done when:*
      Today's top reads like the prototype and like Library/Wishlist, every
      empty state says what to do without triggering provider work, and `pnpm
      build` + `pnpm test` pass.
- [x] **Step 3 - Today Play Next and Buy runway cards** - Convert Play Next
      (dominant Best Fit + compact role rail) and Buy (role groups) into the
      prototype's recommendation-card treatment with section eyebrows. *Done
      when:* both recommendation sections use the shared card language,
      roles/actions/empty/error/stale states behave exactly as shipped, and
      `pnpm build` + `pnpm test` pass.
- [x] **Step 4 - Today supporting panels** - Align Recent Steam activity, data
      health, coverage dialogs, and the operations strip to `SectionCard` /
      eyebrow / status-pill language, keeping their existing empty and
      stale-on-error states. *Done when:* every remaining Today section reads
      consistently, no behavior changes, and `pnpm build` passes.
- [x] **Step 5 - Game Detail hero** - Add the detail hero using `DetailHeroArt`
      (RAWG artwork with readable overlay, gradient fallback, reduced-data
      token control), title, stat badges and source chips from the loaded game,
      and primary/secondary actions that anchor to the existing
      `PlayStateSection` and `PersonalFieldsForm` sections (no new mutations).
      *Done when:* the hero renders for base games and DLC with and without
      artwork, the title stays readable, anchors land on the right sections,
      and `pnpm build` passes.
- [x] **Step 6 - Game Detail signal cards** - Convert the personal profile and
      recommendation-signal sections into `SectionCard`s (quick stats for
      interest/priority/environment/experience, calibration note, latest-run
      factors and caveats as chips in the recommendation card). *Done when:*
      both cards render across present/absent personal data and with/without a
      latest run, and `pnpm build` passes.
- [x] **Step 7 - Game Detail body cards I (metadata, compatibility,
      availability)** - Convert the RAWG metadata, compatibility, and
      availability sections into `SectionCard`s with card headings and
      footers, preserving every existing control, link, and refresh action.
      *Done when:* the three sections read consistently, read-only evidence
      blocks stay read-only, and `pnpm build` passes.
- [x] **Step 8 - Game Detail body cards II (organization, DLC, enrichment,
      delete)** - Convert tags & collections, DLC, and the enrichment &
      controls section (including the delete area) into `SectionCard`s,
      preserving every existing control and destructive confirmation (delete
      dialog and Undo). *Done when:* the sections read as part of the same
      system, delete keeps its existing dialog and Undo, and `pnpm build`
      passes.
- [x] **Step 9 - Wishlist Detail composition** - Apply `SectionCard` + hero
      treatment to the /wishlist/[id] header, identity card, offers card, and
      buy recommendation, keeping all per-entry actions and read-only
      boundaries unchanged. *Done when:* the top half of the page reads as a
      composed whole in dark/light and desktop/mobile, and `pnpm build` + `pnpm
      test` pass.
- [x] **Step 10 - Wishlist Detail supporting cards** - Apply the same treatment
      to the compatibility block, metadata, fill-only enrichment affordance,
      and notes. *Done when:* the full page is consistent, current
      behavior is preserved, and `pnpm build` passes.
- [x] **Step 11 - Collections list and detail** - Restyle /collections (system +
      manual collection cards with color/icon and counts) and /collections/[id]
      (header with name, calculated badge, actions; member table restyled) in
      the shared card/tech-label language. Preserve create/edit/delete and the
      click-to-detail links. *Done when:* both pages match the shared system,
      every action and link still works, and `pnpm build` passes.
- [x] **Step 12 - Settings composition and action operability** - Restyle each
      Settings section (Steam connection, appearance, compatibility sweep,
      recommendation profile, alternative sources, unresolved DLC) into
      `SectionCard`s with eyebrows, and review the order and operability of the
      page's actions: main actions first, diagnostics and destructive scope
      clearly separated, all destructive confirmations intact. *Done when:* the
      page reads as ordered, scannable cards, every control keeps its behavior,
      and `pnpm build` + `pnpm test` pass.
- [x] **Step 13 - Create/edit dialogs normalization** - Normalize the
      create/edit/acquire dialogs and inline forms (game, DLC, collection,
      wishlist) to the shared button/field/spacing/sheet treatment. *Done
      when:* dialogs and forms on the five routes look consistent, all
      submissions, validations, and existing behaviors behave as before, and
      `pnpm build` + `pnpm test` pass.
- [x] **Step 14 - Destructive flows, merge, and shared covers** - Align the
      merge and delete dialogs (game, DLC, collection, alternative-source
      archive, restart recommendations) to the same shared destructive-action
      treatment, confirm every artwork surface (Today spotlight, detail heroes,
      card covers) uses the shared cover/overlay/fallback primitive including
      under reduced data, and verify overlay legibility in dark and light.
      *Done when:* destructive flows render consistently while keeping their
      confirmations and Undo behavior, all artwork surfaces respect reduced
      data, and `pnpm build` + `pnpm test` pass.
- [x] **Step 15 - Visual and build acceptance** - Walk Today, Game Detail,
      Wishlist Detail, Collections, and Settings in dark/light/system and
      desktop/mobile widths, including empty, loading, error, stale, and
      operation states, plus keyboard and screen-reader labels on the new
      cards, pills, and covers. Run `pnpm build`, `pnpm test`, `pnpm lint`, and
      `pnpm typecheck`. *Done when:* all five surfaces render consistently, no
      console errors, no hydration mismatches, and all four commands pass.

## Files / areas

- `src/components/ui/detail-card.tsx` (new) - `SectionCard`, `StatusPill`,
  card headings/footers.
- `src/components/ui/detail-hero-art.tsx` (new) - shared hero art primitive.
- `src/lib/detail-art.ts` + `src/lib/detail-art.test.ts` (new) - pure
  artwork-vs-fallback decision.
- `src/app/(app)/today/page.tsx` + `src/components/today/*` - Today header,
  hero grid, runway, and panels recomposition.
- `src/app/(app)/games/[id]/page.tsx` + `src/components/games/*` (PlayState,
  PersonalFields, Metadata, Compatibility, Availability, Tags, Collections,
  DLC, Enrichment, Delete) - hero and section grouping.
- `src/app/(app)/wishlist/[id]/page.tsx` + `src/components/wishlist/*`
  (Identity, Offers, Compat, Metadata, EntryActions) - composition.
- `src/app/(app)/collections/page.tsx`, `src/app/(app)/collections/[id]/page.tsx`,
  `src/components/games/CollectionDetailActions.tsx` - collection cards/table.
- `src/app/(app)/settings/page.tsx` + `src/components/settings/*`,
  `src/components/steam/*`, `src/components/recommendations/*`,
  `src/components/games/CompatibilitySweepPanel.tsx` - settings cards and order.
- `src/components/games/CreateGameDialog.tsx`, `CreateDlcDialog.tsx`,
  `CreateCollectionDialog.tsx`, `MergeGamesDialog.tsx`, `DeleteGameDialog.tsx`,
  `src/components/wishlist/AddWishlistDialog.tsx`, `EditWishlistDialog.tsx`,
  `AcquireWishlistDialog.tsx`, `src/components/sources/AlternativeSourcesCard.tsx`,
  `src/components/recommendations/RestartRecommendationsSection.tsx`, and
  inline forms - shared dialog/form and destructive-flow treatment.

## Data / contracts

No schema, migration, route, or action changes. Contracts consumed as-is:

- Load-bearing: the shared hero-art decision is a pure function
  (`metadataImage: string | null`, `reducedData: boolean` ->
  `"artwork" | "gradient" | "token"`), matching the 14d card-cover contract and
  reused by Today, Game Detail, and Wishlist Detail. Later surfaces (cross-app
  acceptance 14f) may reuse it unchanged.
- Today, Game Detail, Wishlist Detail, Collections, and Settings queries are
  untouched; every component keeps its existing props and server actions.
- Existing destructive flows (delete game, merge, undo, restart
  recommendations, alternative-source archive) keep their confirmations and
  transaction boundaries.

## Testing

Vitest gate is on; the logic-bearing pieces ship tests:

- `src/lib/detail-art.test.ts` - decision across artwork present/absent,
  reduced-data on/off, and malformed metadata, plus stable fallback behavior.
- Everything else is UI composition: verified with `pnpm build` plus live
  dev-server evidence in dark and light at desktop and mobile widths across the
  five routes (manual browser walkthrough; no Playwright in this project).
- Final gate: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Notes for the AI

- All five pages stay server components; the new primitives render server-side
  presentational markup. Existing client controls (TuneThisRunPanel,
  PriceRefreshPanel, dialogs, forms) keep their client behavior and only change
  markup and composition.
- `DetailHeroArt` must resolve the reduced-data preference on the client via
  `useVisualPreferences()` (manual override beats the OS setting), the same
  way 14d's `WishlistCover` does; never read the html attribute directly in
  components. `SectionCard` and `StatusPill` are server-renderable.
- Today composes over the shipped 14b components (`FeaturedOffersCarousel`,
  `TodaySummary`, `RecentSteamActivity`, `CoverageDialog`, `TodayOperations`,
  role-based Play Next and Buy) and the 12c-f tune/run components; the re-pass
  restyles and regroups them under the shared card language. It does not

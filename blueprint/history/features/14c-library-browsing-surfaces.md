# Feature: Library browsing surfaces

**From build-plan:** feature 14c
**Status:** not started

## Goal

Apply the approved visual system to Library browsing: the toolbar and filter
chips, the approved grid/list presentation alternatives with deterministic
cover-gradient art, a compact health strip, and restyled duplicates, enrichment,
and empty states - all over the existing queries, filters, and actions.

## Design reference

- `prototypes/library.html` (restored from git history; discarded again at
  `/complete`). Source of the approved composition: page header with eyebrow
  and lede, toolbar with search plus grid/list `view-switch`, state and source
  filter chips, the four-tile health grid, and the library card (gradient
  cover, badge row, source badges, meta row, footer).
- Mockup overrides, same discipline as 14b:
  - The card's playtime figure is not built - no playtime data exists in the
    schema. The meta row shows the added date only.
  - The card footer's `RAWG ready / Bazzite ready` notes are not built; the
    list query stays unchanged, so per-card provider and compatibility notes
    stay on detail pages.
  - Filter chips render without counts; per-chip counts would need new
    aggregate queries, which the build plan's "preserve current queries"
    constraint forbids here.
  - The mockup's `⌘ K` search shortcut is deferred to 14f polish.
  - Header copy comes from the mockup (`Your library, in orbit.`) and is
    adjustable at this review gate.

## In scope

- A shared, tested cover-gradient helper extracted from 14b's Today carousel
  so Today, Library, and 14d's Wishlist covers render identical
  deterministic art from the same token palette.
- A `view` searchParam (`grid` | `list`, default `grid`) with an accessible
  two-button view switch, rendered server-side per mode.
- Grid view: library cards per the mockup (gradient cover with uppercase
  title, state/main/flag badges, source badges, added date, open-detail link).
- List view: the mockup's horizontal card variant replacing the current
  table, with identical data per entry.
- Toolbar and filter presentation: search box, sort control, state and
  built-in source chips, and a More-filters popover holding the existing
  collection, alternative-source, and sort selects - same searchParams, same
  semantics, no counts.
- A four-tile health strip (backlog progress, metadata gaps, profile gaps,
  main game) reusing `loadTodayDataHealth` plus one main-game select.
- Token-level restyle of the RAWG batch enrichment panel, the duplicates
  review branch, and the header action links (`Review DLC`, `Review duplicates`).
- The mockup's empty state with a working reset-filters link.

## Out of scope

- Wishlist surfaces: the signal grid, focus/list modes, and entry-card
  composition belong to 14d.
- Any query, filter-parameter, sort, or action change. Every existing
  capability (search, source/alt filtering, state, collections, sort,
  duplicates review, add game, enrichment) keeps its current behavior.
- Per-card RAWG or compatibility evidence, chip counts, and playtime (no
  data; detail pages own provider evidence).
- Collections routes and dialogs (14e), cross-app acceptance (14f),
  Wallhaven (15), per-game palettes (16).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Shared cover-gradient helper and view param** - Extract the
      deterministic gradient mapping from `CurrentlyPlayingCarousel` into
      `src/lib/cover-gradient.ts` (Today switches to the shared helper,
      visually unchanged) and add a unit test for determinism and stability.
      Normalize the `view` searchParam on `/library` (unknown values render
      as today's table) without changing any presentation yet. *Done when:*
      Today renders identical gradients after the refactor, the new test
      passes, and `/library` behaves exactly as before with or without the
      param.
- [x] **Step 2 - Library card, grid default, and view switch** - Add the
      library card component per the mockup (gradient cover with uppercase
      title, badge row for state/main/flags, source badges reusing
      `SourceIcon`, added date, open-detail link), render the grid as the
      default view, keep the existing table reachable at `view=list`, and
      add the client `ViewSwitch` (aria-pressed buttons) above the list.
      *Done when:* `/library` opens in grid view with one card per entry and
      working detail links, badges match the entry's stored state and flags,
      the switch flips to the table and back without losing filters, and
      `pnpm build` passes.
- [x] **Step 3 - List view** - Replace the table with the mockup's
      horizontal card variant when `view=list` (compact cover plus body
      row), with the same per-entry data as grid mode. *Done when:* both
      modes show identical information per entry, mobile stacks cleanly,
      and `pnpm build` passes.
- [x] **Step 4 - Toolbar, filter chips, and header** - Adopt the header
      composition (eyebrow, h1, lede, Add game) and toolbar (search box,
      sort, view switch placement); convert state and built-in source
      filtering to chips over the same `state`/`source` searchParams; move
      collection, alternative-source, and sort selects into a More-filters
      popover. *Done when:* every previous filter combination is still
      reachable and produces identical URLs and results, chips reflect the
      active filter, keyboard and screen-reader labels are intact, and
      `pnpm build` passes.
- [x] **Step 5 - Health strip, panels, and empty states** - Add the four
      health tiles (backlog progress, metadata gaps, profile gaps, main
      game) from `loadTodayDataHealth` plus a main-game select; restyle the
      RAWG enrichment panel, header action links, and duplicates review
      branch; adopt the mockup empty state with a reset-filters link that
      clears filter params. *Done when:* tiles show real counts matching
      Today's data-health numbers, the empty state appears for filtered-out
      and empty catalogs with a working reset, duplicates review and the
      enrichment panel render restyled with unchanged behavior, and
      `pnpm build` + `pnpm test` pass.
- [x] **Step 6 - Pertinent card meta without clutter** - Add a compact meta
      line to the card footer holding real, actionable data currently
      missing from the card: DLC count, membership count across collections,
      and RAWG metadata readiness. Shown only when non-zero where it makes
      sense, so each card stays uncluttered; the badge row is untouched.
      *Done when:* base games with DLCs show a DLC count, games in
      collections show a collection count, games with/without RAWG metadata
      show a readiness marker, and cards with none of these render the same
      as before; `pnpm build` + `pnpm test` pass.
- [x] **Step 7 - Fuzzy, typo-tolerant library search** - Replace the
      exact-substring name match with a tested fuzzy scorer (`src/lib/fuzzy-match.ts`)
      over a bounded pool of visible base-game library entries (id + name
      only), ranking by similarity while still applying every existing filter
      (state, source, collection) and sort in SQL. *Done when:* `carion`
      matches `Carrion`, typo and transposition variants recall the right
      games, exact substring matches rank first, unrelated names with a
      short query do not unexpectedly flood results, all existing filter
      combinations still produce the same param semantics, and the new unit
      tests plus the full suite pass.

## Files / areas

- `src/lib/cover-gradient.ts` + `src/lib/cover-gradient.test.ts` (new, shared).
- `src/components/today/CurrentlyPlayingCarousel.tsx` - consume the shared helper.
- `src/components/games/ViewSwitch.tsx` (new, client) - grid/list toggle.
- `src/components/games/LibraryGameCard.tsx` (new, server-rendered) - card for both modes.
- `src/components/games/LibraryFilters.tsx` - chips, popover, toolbar composition.
- `src/app/(app)/library/page.tsx` - header, view modes, health strip, empty states.
- `src/components/games/RawgBatchEnrichmentPanel.tsx`, `DuplicatesList.tsx` -
  token-level restyle only.

## Data / contracts

No schema or query changes; the Library query, filter params, and actions are
untouched. Contracts:

- `view` searchParam: `grid` (default) | `list`; unknown or absent values
  normalize to `grid` - **load-bearing**: 14d
  uses the same param name and default-first pattern for `focus` | `list`.
- `cover-gradient.ts` `gradientFor(id: string): string` returning the
  gradient class pair - **load-bearing**: Today carousels (refactor in step
  1), Library cards (step 2), and 14d Wishlist covers consume it.
- Existing filter params keep their names and semantics: `q`, `source`,
  `alt`, `state`, `sort`, `collection`, `duplicates`.
- `loadTodayDataHealth` output shape is reused as-is; the only new reads are
  that call plus a single main-game select.

## Testing

Vitest gate is on; the logic-bearing extraction ships tests:

- `src/lib/cover-gradient.test.ts` - same id always maps to the same
  gradient, different ids spread across the palette, and the returned
  classes are from the known token set.
- Everything else is UI composition: verified with `pnpm build` plus live
  dev-server evidence in dark and light at desktop and mobile widths
  (manual browser walkthrough; no Playwright in this project).
- Final gate: `pnpm build` and `pnpm test` (no `Verify` command declared;
  `pnpm lint` and `pnpm typecheck` stay green).

## Notes for the AI

- The page stays a server component; ViewSwitch, the More-filters popover,
  and the search input are client. Filters still update via
  `router.replace` with URLSearchParams, exactly as today.
- Do not add counts, provider evidence, or playtime to cards; the query
  constraint wins over the mockup.
- The grid/list switch must not lose the active filters: the switch updates
  only the `view` param.
- Preserve the duplicates branch (`?duplicates=true`) behavior, including
  its separate header and the CreateGameDialog placement.
- Gradient covers are decorative; keep the readable title and link outside
  any low-contrast art area, matching the mockup's cover-ink treatment.
- Respect the writing standard: no em dashes in code, comments, or docs.

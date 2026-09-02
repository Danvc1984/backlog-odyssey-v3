# Feature: Wishlist browsing surfaces

**From build-plan:** feature 14d
**Status:** in progress

## Goal

Apply the approved visual system to Wishlist browsing: the signal grid, the
approved focus/list presentation alternatives, and the entry-card composition
for offers, identity, staleness, target, and interest - all over the existing
queries, filter params, currencies, and actions.

## Design reference

- `prototypes/wishlist.html` (restored from git history; discarded again at
  `/complete`). Source of the approved composition: page header with eyebrow
  and lede, the three-tile signal grid, search toolbar, filter chips, the
  import-review card treatment, and the three-part entry card (gradient
  cover, body with title/identity/description/tags/footer, signal aside with
  interest stars, price block, target row, and alternatives).
- Mockup overrides, same discipline as 14c:
  - The card's compatibility row (`Bazzite ready` / `not checked`) is not
    built; the page query stays unchanged and compatibility evidence stays on
    the detail pages.
  - The `Needs review` chip and tile reflect **visible** entries derived from
    the already-loaded list, not new catalog-wide count queries.
  - Filter chips render without counts (same constraint as 14c).
  - The mockup's `⌘ K` shortcut is deferred to 14f polish.
  - Header copy comes from the mockup (`Worth the wait. Buy with signal.`)
    and is adjustable at this review gate.

## In scope

- A wishlist `view` searchParam (absent = `focus`, `list` = compact) with the
  existing `ViewSwitch` generalized to configurable modes; `/library`
  behavior unchanged.
- A client `WishlistCover` that renders RAWG artwork with a readable overlay
  when metadata provides it, the shared deterministic gradient fallback
  otherwise, and no remote art at all under reduced data.
- Focus card recomposition per the mockup: three-part layout (cover, body,
  signal aside) composing the existing identity, offer, alternatives, and
  action components unchanged.
- List mode: compact horizontal entry card with condensed price and interest.
- A three-tile signal grid (active wishes with base/DLC split, opportunity
  signals, needs-attention) derived purely from the loaded entries.
- Filter chips for type and interest over the existing `type`/`interest`
  searchParams; restyled header and import-review card treatment.
- Freshness and staleness presentation using the existing offer view data
  (`isStale`, `fetchedAt`, keyshop warnings, MXN currency display).
- Empty states for a filtered-out and an empty wishlist.

## Out of scope

- Any query, filter-parameter, action, or identity-flow change: search,
  type/interest filters, import review, Steam import, price refresh, compat
  sweep, add/edit/acquire/delete all behave exactly as shipped.
- Compatibility display on list cards (not in the current query; wishlist
  detail owns it).
- Per-card catalog-wide counts (would need new aggregate queries).
- Detail pages, collections, dialogs (14e), cross-app acceptance (14f),
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

- [x] **Step 1 - Wishlist view param** - Accept and normalize `view` on
      `/wishlist` (absent and unknown values render today's grid) without
      changing any presentation yet; no switch UI yet. *Done when:*
      `/wishlist` with or without the param renders exactly today's page and
      `pnpm build` passes.
- [x] **Step 2 - WishlistCover with reduced-data awareness** - Add a client
      `WishlistCover` that renders RAWG artwork with a contrast overlay when
      a metadata image exists, the shared deterministic gradient fallback
      otherwise, and token-only art when the resolved data preference is
      `on`; include a pure art-presentation helper plus its unit test.
      *Done when:* entries with artwork show it with a readable overlay,
      entries without show the gradient cover with the uppercase title,
      toggling the reduced-data preference swaps remote art for gradients
      without a reload, and the new test passes.
- [x] **Step 3 - Wishlist card information hierarchy** - Apply the approved
      card treatment: keep the linked title on the cover, make interest stars
      editable, reduce offers to current price and discount linked to the
      detail offers section, limit the RAWG description preview to three
      lines with a literal `...` suffix on larger screens, hide that preview
      on mobile, remove identity/type/parent details and RAWG source links
      from the card, and distinguish DLC cards with a subtle surface tone and
      `(DLC)` in the cover title. *Done when:* the card keeps the approved
      actions and metadata while the detail pages remain the home for full
      identity, offer, and provider information, and `pnpm build` passes.
- [x] **Step 4 - List (compact) view** - Generalize `ViewSwitch` to accept
      configurable modes (Library keeps `grid`/`list` with identical
      behavior and DOM), render it in the wishlist list heading, and add the
      compact horizontal card variant for `view=list` (small cover, title,
      type, condensed price block, interest) via a `variant` prop on the
      same card component. *Done when:* both modes show the same data per
      entry, the switch flips modes without losing filters, identity and
      offer caveats stay visible in compact form, mobile stacks cleanly,
      and `pnpm build` passes.
- [x] **Step 5 - Header, signal grid, filter chips, and empty states** -
      Adopt the header composition (eyebrow, h1, lede, existing controls),
      add the signal grid (active wishes with base/DLC split, opportunity
      count, needs-attention count from visible entries), convert type and
      interest filtering to chips over the existing `type`/`interest`
      searchParams, restyle `WishlistImportReviewSection` as the review
      card, and adopt a contextual empty state. *Done when:* tiles match
      the currently visible list for any filter combination, chips reflect
      the active filter and produce identical URLs and results, the review
      card and empty state render per the mockup with unchanged behavior,
      and `pnpm build` + `pnpm test` pass.
- [x] **Step 6 - Catalog card visual parity** - Apply the approved wishlist
      card treatment to the main catalog cards wherever the data applies:
      artwork or deterministic gradient cover, readable title overlay,
      consistent card spacing, editable interest stars, RAWG description, and
      genre tags. Replace the visible play-state and platform rows with the
      description treatment, and replace catalog card action affordances with
      mock `Edit` and `Change state` links, both navigating to the game detail
      page for now. Keep RAWG source links off cards so provider links remain
      in the detail pages. Preserve the existing grid/list variants and
      library data contracts. *Done when:* catalog cards share the wishlist
      visual language without losing relevant metadata, interest updates use
      the existing library action, both mock actions navigate to
      `/games/[id]`, and `pnpm build` + `pnpm test` pass.
- [x] **Repair hydration mismatch in compatibility status** - Keep the
      compatibility panel's server and client date output deterministic by
      using the same explicit locale and Mexico City timezone as the price
      refresh panel. *Done when:* `/wishlist` loads without a hydration
      mismatch from `WishlistCompatSweepPanel`.

## Files / areas

- `src/components/wishlist/WishlistCover.tsx` (new, client) - artwork with
  reduced-data fallback.
- `src/lib/cover-presentation.ts` + test (new) - pure art-presentation and
  fetched-ago formatting logic.
- `src/components/wishlist/WishlistCard.tsx` - focus composition.
- `src/components/wishlist/WishlistList.tsx` - focus/list containers.
- `src/components/games/ViewSwitch.tsx` - generalize modes (Library unchanged).
- `src/components/wishlist/WishlistFilterBar.tsx` - chips and search.
- `src/components/games/LibraryGameCard.tsx` - catalog card visual parity and
  mock detail actions.
- `src/app/(app)/wishlist/page.tsx` - header, signal grid, view modes.
- `src/components/wishlist/WishlistIdentity.tsx`, `WishlistOfferSection.tsx`,
  `WishlistOfferAlternatives.tsx`, `WishlistEntryActions.tsx`,
  `WishlistImportReviewSection.tsx`, `WishlistFilterBar.tsx` - restyle and
  recomposition only.

## Data / contracts

No schema, query, or action changes. Contracts consumed as-is:

- `WishlistOffersView` (`selected`, `alternatives`, `isStale`,
  `targetPriceMxn`, `opportunity`) drives all offer presentation; no scoring,
  selection, or staleness-rule changes.
- 14c contracts (load-bearing): `gradientFor(id)` from
  `src/lib/cover-gradient.ts` for gradient covers, and the `view` searchParam
  pattern (absent = default mode, unknown values normalize to default).
- The generalized `ViewSwitch` keeps `grid`/`list` behavior on `/library`
  byte-for-byte; wishlist modes are `focus` (default, param absent) and
  `list`.
- Existing wishlist params keep names and semantics: `type`, `interest`, `q`.

## Testing

Vitest gate is on; the logic-bearing pieces ship tests:

- `src/lib/cover-presentation.test.ts` - art decision (image vs gradient vs
  none) across metadata present/absent and reduced-data on/off, plus stable
  relative fetched-time formatting (fresh, hours, days, missing date).
- Everything else is UI composition: verified with `pnpm build` plus live
  dev-server evidence in dark and light at desktop and mobile widths
  (manual browser walkthrough; no Playwright in this project).
- Final gate: `pnpm build` and `pnpm test` (no `Verify` command declared;
  `pnpm lint` and `pnpm typecheck` stay green).

## Notes for the AI

- The page stays a server component; `WishlistCover`, `ViewSwitch`, chips,
  and existing client controls are client. Identity edit flows
  (`WishlistIdentity`) keep their current behavior untouched.
- Reduced data comes from `useVisualPreferences()` resolved `data` value
  (manual override beats the OS setting); never read the html attribute
  directly in components.
- Artwork keeps `unoptimized` lazy loading as today; the overlay must keep
  the title readable per the overview's artwork rule.
- Do not add compatibility rows, catalog-wide counts, or new filters; the
  query constraint wins over the mockup.
- Preserve the existing empty states for no-entries and no-import-review;
  restyle only, and keep all six header controls present and functional.
- Respect the writing standard: no em dashes in code, comments, or docs.

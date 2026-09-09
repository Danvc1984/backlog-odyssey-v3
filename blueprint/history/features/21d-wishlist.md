# Feature: 21d Wishlist

**From build-plan:** feature 21d (Wishlist sub-item of 21, pre-deployment polish)
**Status:** not started

## Goal

Make the Wishlist browse page behave like the Library: paginate it with the
same 18/48/99 page sizes and default 18 (in Focus and List views), sort by
discount, and search with the same fuzzy behavior as the Library. Carry over
one 21c miss: the page-size selector moves inside the pagination bar itself,
so paging and page size live in one control row on both surfaces. Then three
targeted fixes: make ITAD a real link where offers are described, replace the
redundant opportunity-signals tile with a discounted-games counter, and give
the missing-metadata note on wishlist detail the warning color.

## Design reference

None. Behavior polish on existing surfaces; the only visual changes (tile
label/caption swap, one note recolored, ITAD links) are judged in the running
app against the existing Dawn/Sunset tokens, matching the 21c approach.

## In scope

- Moving the page-size selector into the shared pagination bar
  (`ListPaginationControls`) so 18/48/99 switching sits next to the paging
  buttons; the standalone toolbar control is removed from the Library. The
  pagination helpers themselves stay as shipped in 21c (18/48/99, default
  18) - no parameterization needed since both surfaces share the same sizes.
- Wishlist in-memory pagination (page slice + pagination bar with the
  embedded size control) in both Focus and List views.
- A sort control on the Wishlist with the default interest order plus a
  Biggest-discount order (selected offer's discount, deepest first).
- Library-style wishlist search: fuzzy matching over entry name and DLC
  base-game name, input updates as you type, no submit button.
- Wishlist page signal tile "Opportunity signals" replaced by a
  "Discounted games" counter (entries whose selected offer is discounted).
- ITAD as a link in the wishlist header mention and in the wishlist detail
  Offers section description.
- Warning color for the missing-metadata note on `/wishlist/[id]`.

## Out of scope

- Opportunity badge logic anywhere else (cards, detail offers, Today, buy
  engine): only the wishlist page tile is replaced.
- Wishlist detail offer layout, alternatives list, glow rules, or pricing
  behavior.
- Library pagination behavior changes beyond the toolbar control relocation
  described in Step 1.
- Per-view page-size memory, cursor pagination, infinite scroll.
- Schema, migrations, server actions, or new API routes (URL-param and
  rendering work only).
- Settings/onboarding items (21e), Steam-name cleanup (21e), Wallhaven,
  deployment (24).

## Interpretation decisions (owner review)

- **Page sizes** are owner-set (2026-09-09): Wishlist uses the same numbers
  as the Library, 18/48/99 with default 18, and the size selector lives in
  the pagination bar rather than the toolbar row (this was the 21c miss).
  Because the bar now carries the size control, it renders whenever the list
  has entries, with paging buttons disabled on a single page - a deliberate
  change to 21c's "absent when everything fits" so the size control stays
  reachable when everything fits at a larger size.
- **"ITAD as a link in the offer description"**: read as the Offers section
  description on `/wishlist/[id]` ("Prices are shown only when the store
  identity is confirmed.") plus the wishlist page header sentence
  "Discounts powered by ITAD". Both make the word ITAD an anchor to
  `https://isthereanydeal.com` (new tab, `rel="noreferrer"`), keeping the
  existing ITAD icon beside it. Cards keep their current offer link to
  wishlist detail; no card changes.
- **"sorting by discount"**: an additional "Biggest discount" toggle beside
  the Wishlist filters. Off means "Interest" (current order: interest desc
  then updatedAt desc); on means selected offer discount desc. Entries with
  no selected offer or a 0% discount sort last, ties by interest desc then
  updatedAt desc then id.
- **"efficient search matching the library search behavior"**: same semantics
  as Library - fuzzy match (`fuzzyMatch`) narrows the pool; the chosen sort
  orders the display. Wishlist matches against the entry name and, for DLC,
  the base-game name (preserving the current `contains` coverage). The input
  updates `q` on change like `LibraryFilters` (no form, no Search button).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Size selector inside the pagination bar** - add `ariaLabel`
  and `pageSizeLabel` props to the list controls: `PageSizeControl` takes
  `ariaLabel` (Library keeps "Games per page"), `ListPaginationControls`
  takes `ariaLabel` for the nav (Library keeps "Library pages") plus a
  `size` prop and renders `PageSizeControl` inside its nav row (size control
  at the start of the row, before the First/Prev cluster). It presents compact
  selectable values like `Games: 18, 48, 99`. Change the render
  condition to "list has entries" instead of "totalPages > 1" so the bar -
  and with it the size control - stays visible on a single page, with the
  paging buttons disabled there. Remove the toolbar `PageSizeControl` from
  the Library row (src/app/(app)/library/page.tsx:363-366), leaving only
  `ViewSwitch` there, and pass the new props from the Library call site. The
  pagination helpers and their tests are untouched. *Done when:* on Library
  the 18/48/99 size control sits inside the pagination bar next to the paging
  buttons, the bar is visible with one page (buttons disabled), switching
  sizes resets to page 1, the toolbar row shows only the view switch, and
  `pnpm test`, `pnpm lint`, `pnpm typecheck` pass with no helper changes.
- [x] **Step 2 - Wishlist page-size and pagination bar** - in
  `src/app/(app)/wishlist/page.tsx` read `size`/`page` from `searchParams`
  (same 18/48/99 helpers, default 18), slice `entriesWithOfferViews` in
  memory with `resolveRange` (signals and counts computed over the full
  filtered set before slicing), and render `ListPaginationControls` below
  `WishlistList` whenever entries exist, with aria labels "Wishlist pages"
  and "Wishes per page". No separate toolbar control. Both Focus and List
  views share the slice. *Done when:* with more than 18 wishes,
  `/wishlist` shows 18, `/wishlist?size=99` shows 99,
  `/wishlist?size=48&page=2` shows the second batch, `?size=7&page=-3`
  falls back to sane values, Focus and List both honor it, and the size
  control is visible in the pagination bar even when everything fits.
- [x] **Step 3 - Sort by discount** - add a `sort` param to the wishlist page
  (`discount` recognized, anything else is the default). Add a pure
  comparator to `src/lib/wishlist-search.ts` (`sortWishlistEntries`:
  discount desc with no-offer/0% last, ties by interest desc, updatedAt
  desc, id) and apply it before slicing when `sort=discount`. Add a
  "Biggest discount" toggle to `WishlistFilterBar` (off is the default
  Interest order, on writes `sort=discount` and off deletes it) and delete
  `page` on change. Unit tests cover discount
  ordering, the no-offer tail, and tie-breaks. *Done when:* choosing
  Biggest discount reorders with the deepest discount first, entries without
  current offers sit at the end, and switching back to Interest restores the
  default order.
- [x] **Step 4 - Library-style fuzzy search** - in `WishlistFilterBar` replace
  the submit form with a library-style controlled `Input` that calls
  `update("q", value)` on change (no button, keep the placeholder). In
  `src/lib/wishlist-search.ts` drop the `contains` OR clause from
  `wishlistWhere` (filters keep type/interest only) and add a pure
  `matchWishlistEntries(query, entries)` helper that fuzzy-matches
  `fuzzyMatch(query, entry.name)` and, for DLC, `fuzzyMatch(query,
  baseGame.name)` (best score wins, only matched entries survive). The page
  applies it over the filtered pool before sort/slice. Update
  `wishlist-search.test.ts` accordingly. *Done when:* a typo query like
  "eldin ring" finds Elden Ring as on Library, DLC entries match their
  base-game title, results update as you type with no Search button, and an
  empty query shows everything in the chosen order.
- [x] **Step 5 - Discounted-games counter tile** - in the wishlist page signal
  grid replace the "Opportunity signals" tile with "Discounted games": count
  entries whose `offerView.selected` has `discount > 0`; caption "cheapest
  offers discounted now"; keep the opportunity-colored border/background.
  Opportunity badge logic elsewhere is untouched. *Done when:* the tile
  number equals the number of cards showing a discount chip, and it updates
  when filters change.
- [x] **Step 6 - ITAD as a link** - in the wishlist page header make the ITAD
  word inside "Discounts powered by ITAD" an anchor to
  `https://isthereanydeal.com` (new tab, `rel="noreferrer"`, keep the icon);
  in `/wishlist/[id]` make the Offers section description carry the same
  link ("Cheapest valid offers via ITAD. Prices are shown only when the
  store identity is confirmed." - `SectionCard.description` already accepts
  a ReactNode). *Done when:* clicking ITAD in both places opens the ITAD
  site in a new tab.
- [x] **Step 7 - Warning color for the missing-metadata note** - in
  `src/app/(app)/wishlist/[id]/page.tsx` (lines ~195-199) change the
  "RAWG metadata is not available yet..." note from `text-muted-foreground`
  to `text-warning-text` with `text-sm`, matching the existing card note.
  The card note itself is already warning-colored from 21c; verify only.
  *Done when:* the detail note renders in the warning color in light and
  dark, and the card note is unchanged.

## Files / areas

- `src/components/list/PageSizeControl.tsx` (aria-label prop and compact
  selectable size values, now rendered inside the pagination bar)
- `src/components/list/ListPaginationControls.tsx` (size control in the bar,
  always-render condition, nav aria label)
- `src/app/(app)/library/page.tsx` (toolbar control removed, call-site props)
- `src/app/(app)/wishlist/page.tsx` (params, slice, sort/search wiring, tile,
  pagination bar)
- `src/components/wishlist/WishlistFilterBar.tsx` (search input, sort select)
- `src/lib/wishlist-search.ts` + `src/lib/wishlist-search.test.ts`
  (comparator, fuzzy matcher, where-clause trim)
- `src/app/(app)/wishlist/[id]/page.tsx` (ITAD link, warning note)
- `src/lib/list-pagination.ts` - unchanged; named here because both surfaces
  keep depending on it as the single parser authority

## Data / contracts

- URL contract for `/wishlist` (load-bearing, mirrors 21c): `size` one of
  18/48/99, default 18, param absent at default; `page` 1-based, param
  absent on page 1; `sort` value `discount` only, param absent at the default
  interest order; `q` trimmed free text, absent when empty. All written via
  `router.replace` like `view`/Library params; `src/lib/list-pagination.ts`
  stays the single parser/clamp authority for both surfaces and is not
  changed by this feature.
- The pagination bar (`ListPaginationControls` + embedded `PageSizeControl`)
  is the one place with paging and page-size controls on both surfaces; the
  toolbar rows keep only their view switches (and wishlist filters).
- No schema, migration, server-action, or API changes. Offer views
  (`buildEntryOfferView`), opportunity badges, and glow rules are untouched.

## Testing

- Unit (Vitest, required by the test gate): `sortWishlistEntries` (discount
  desc, no-offer tail, tie-breaks) and `matchWishlistEntries` (fuzzy
  tolerance, DLC base-game name, empty query). `list-pagination` tests are
  untouched by this feature; the control changes are UI and ride on browser
  evidence plus the build.
- Browser evidence (no E2E runner): each step's done-when driven by hand
  with `pnpm dev`, covering Focus + List, first/last page, discount sort,
  fuzzy search, the counter tile, the ITAD links, and the warning note in
  light and dark.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` stay green
  before each approval.

## Notes for the AI

- Server components by default; the only `"use client"` files touched are
  `WishlistFilterBar` and the two list controls. Client controls read/write
  URL state only; they never fetch.
- Follow the established URL idioms: delete a param at its default
  (`ViewSwitch`/`PageSizeControl` style), clamp stale pages with `parsePage`
  instead of resetting on filter change (Library behavior).
- The wishlist is a small single-user set: fetching the filtered pool once
  and slicing in memory is the intended design, matching the Library's
  fuzzy path; do not add take/skip or count queries.
- Keep tile copy factual (signal tiles are status surfaces, not expressive
  Odyssey voice). No em dashes anywhere; no comments unless they capture a
  non-obvious decision; functions under 50 lines.
- Keep each diff reviewable: helpers, controls, wiring, sort, search, and
  the three visual/text fixes are separate steps on purpose.

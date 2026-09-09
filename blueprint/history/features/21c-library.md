# Feature: 21c Library

**From build-plan:** feature 21c (Library sub-item of 21, pre-deployment polish)
**Status:** not started

## Goal

Make the Library list behave like a real catalog surface: paginate it (18/48/99
per page, default 18) with a shared mechanism the Wishlist (21d) will reuse,
make the card Edit / Change state actions land on the right game-detail section
with the existing scroll effect, replace the ready/missing metadata chips with
a description-based warning, make the main-game selector stand out, and verify
ProtonDB card tags stay omitted on all-Windows setups.

## Design reference

None. This is behavior polish on existing surfaces; visual changes are limited
to a warning chip restyle and a stronger background on the main-game health
tile, both judged in the running app against the existing Dawn/Sunset tokens.

## In scope

- Shared page-size + page-number mechanism (URL params, pure helpers, two
  client controls) introduced in the Library and reusable by 21d unchanged.
- Library query pagination (`take`/`skip` + count) for the main query, and
  in-memory slicing for the fuzzy-search path.
- Card `Edit` / `Change state` links deep-linking to `/games/[id]` sections
  with the anchor-scroll and target-ring effect that already exists there.
- Description-based metadata warning on library cards (replaces
  `meta ready` / `meta missing`), including the collections call site, with the
  same warning color applied to the existing Wishlist guidance message.
- More noticeable background for the main-game selector in the health strip.
- Verification (and regression test if missing) that ProtonDB card tags are
  omitted on all-Windows setups.

## Out of scope

- Wiring the mechanism into the Wishlist (21d owns that).
- Filter, sort, search-behavior, or health-strip data changes.
- Infinite scroll, cursor pagination, or per-view page-size memory.
- New server actions or schema changes (URL-param and rendering work only).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Pagination helpers and URL contract** - add
  `src/lib/list-pagination.ts` with pure helpers: `parsePageSize` (accepts
  18/48/99, defaults 18, rejects anything else), `parsePage` (1-based, clamps
  to `[1, totalPages]`, defaults 1 on garbage), and `resolveRange(total,
  page, size)` returning `{ page, size, totalPages, rangeStart, rangeEnd }`.
  Unit tests cover defaults, invalid sizes, page clamping, empty results
  (total 0 gives page 1, range 0-0). *Done when:* `pnpm test` passes with the
  new tests and nothing else changed.
- [x] **Step 2 - Page-size control and query slicing in Library** - add
  `src/components/list/PageSizeControl.tsx` (client Select with options
  18/48/99; writes the `size` param via the existing `router.replace`
  idiom from `ViewSwitch`, deleting the param on the default; resets `page`
  to 1 when size changes). Render it in the Library toolbar row next to
  `ViewSwitch` (src/app/(app)/library/page.tsx:312-332). Read `size` and
  `page` from `searchParams`; apply `take`/`skip` plus a parallel
  `libraryEntry.count` with the same where-clause to the main query
  (page.tsx:178-227) and slice the fuzzy-search pool in memory on the `q`
  path (page.tsx:148-176). Filter changes already rewrite the URL without
  `page`, so stale pages cannot persist except by hand - clamp with
  `parsePage`. *Done when:* with more than 18 games, `/library` shows 18,
  `/library?size=99` shows 99, `/library?size=48&page=2` shows the second
  batch, and a garbage URL like `?size=7&page=-3` falls back to sane values;
  grid and list views both honor it.
- [x] **Step 3 - Page navigation controls** - add
  `src/components/list/ListPaginationControls.tsx` (client; Prev/Next buttons
  plus a "1-20 of 143" technical label; disabled at the edges; writes `page`
  via the same URL idiom, deleting it on page 1). Render it below the results
  grid/list (page.tsx:362-377) only when `totalPages > 1`, with first-page and
  last-page buttons alongside previous/next. *Done when:* paging forward and
  backward works in both views with visible disabled
  states, the range label matches the shown rows, and the control is absent
  when everything fits on one page.
- [x] **Step 4 - Card Edit / Change state deep links** - change `MockActions`
  in `src/components/games/LibraryGameCard.tsx:71-88`: `Change state` links
  to `/games/${gameId}#play-state`, `Edit` links to
  `/games/${gameId}#personal-fields`. The detail page already has both
  section ids, `scroll-mt-6`, and `target:ring-2` styling, and
  `globals.css` sets smooth scrolling globally. Verify in the browser that
  navigating from a card lands on the section with the ring; if Next.js does
  not scroll to the hash on soft navigation, fix minimally (e.g. a tiny
  hash-scroll effect in the detail page) rather than inventing new UI.
  *Done when:* clicking either card action opens game detail scrolled to the
  matching section with the visible target ring, in grid and list variants.
- [x] **Step 5 - Description-based metadata warning** - in
  `LibraryGameCard.tsx` the description area drops the `meta ready` /
  `meta missing` labels and instead renders the guidance message
  `RAWG metadata is not available yet. Use Edit to search and choose a match.`
  only when the parsed
  metadata view has no description (`entry.metadata?.description` is null or
  empty after trim). Make sure the collections call site
  (src/app/(app)/collections/[id]/page.tsx:83, `toLibraryEntry`) provides the
  same view so the warning behaves identically there; drop the now-unused
  `metadataReady` flag if nothing else consumes it. *Done when:* a game whose
  RAWG snapshot lacks a description shows the warning on library (grid, list)
  and collection cards; a game with a description shows no chip at all; a
  game with no snapshot shows the warning.
- [x] **Step 6 - Main-game selector emphasis** - in
  `src/components/games/LibraryHealthStrip.tsx` give the "Main game" tile
  (lines 179-196) a noticeably stronger background than the other tiles
  (accent-tinted card background plus stronger border using existing tokens),
  and keep the picker trigger readable in both variants. No logic changes.
  *Done when:* the main-game tile is clearly distinguishable from the other
  health-strip tiles in light and dark, grid and list, and keyboard focus
  stays visible on the trigger.
- [x] **Step 7 - All-Windows ProtonDB tag omission check** - confirm
  `deriveCompatTag` returns null when the gate is inactive
  (src/lib/protondb-tags.ts:42-59) and that no library/collections code
  path renders `ProtonDbTag` without the gate. If a test asserting
  `active: false -> null` (and ROM-only / no-App-ID absence) is missing from
  `src/lib/protondb-tags.test.ts`, add it; if it exists, report it. No
  behavior change expected. *Done when:* the regression test passes and a
  manual check with an all-Windows setup shows no tags on library cards.
- [x] **Repair - Deep-link target ring** - make the game-detail section, rather
  than a duplicate heading anchor, the unique target for `#play-state` and
  `#personal-fields`, so the existing target ring is applied after navigation.

## Files / areas

- `src/lib/list-pagination.ts` (new) + `src/lib/list-pagination.test.ts` (new)
- `src/components/list/PageSizeControl.tsx` (new), `src/components/list/ListPaginationControls.tsx` (new)
- `src/app/(app)/library/page.tsx` (params, query slicing, controls)
- `src/components/games/LibraryGameCard.tsx` (deep links, description guidance)
- `src/components/wishlist/WishlistCard.tsx` (warning color parity)
- `src/app/(app)/collections/[id]/page.tsx` (metadata view parity)
- `src/components/games/LibraryHealthStrip.tsx` (tile emphasis)
- `src/lib/protondb-tags.test.ts` (regression test, only if missing)

## Data / contracts

- URL contract (load-bearing for 21d): `size` one of 18/48/99, default 18,
  param absent when default; `page` 1-based, param absent on page 1; both
  written through `router.replace` like `view`. Helpers in
  `src/lib/list-pagination.ts` are the single parser/clamp authority.
- Shared control props must not import library-specific types, so 21d can
  drop them into the wishlist page unchanged.
- No schema or server-action changes.

## Testing

- Unit (Vitest, required by the test gate): `list-pagination` helpers
  (defaults, malformed input, clamping, zero-total range) and the
  `deriveCompatTag` inactive-gate regression if not already covered.
- Browser evidence (no E2E runner): per-step done-whens above, driven by hand
  with `pnpm dev`, covering grid + list, first/last page, warning chip
  presence/absence, deep-link scroll ring, and dark + light for the two
  visual steps.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` stay green
  before each approval.

## Notes for the AI

- Server components by default; the two new controls are the only
  `"use client"` files. Client controls read/write URL state only; they never
  fetch.
- Follow the `ViewSwitch` param idiom (delete the param at its default) and
  the `LibraryFilters.update` pattern; keep the canonical URL clean.
- Single-user app: no per-user scoping needed; auth is enforced at the layout.
- The fuzzy-search path (q present) bypasses prisma take/skip: slice the
  matched pool in memory and derive the total from its length; both paths must
  report the same `resolveRange` shape.
- No comments unless they capture a non-numeric decision; no em dashes in any
  generated file; functions under 50 lines.
- Keep each diff reviewable: pagination helpers, controls, page wiring, and
  the four card-level fixes are separate steps on purpose.

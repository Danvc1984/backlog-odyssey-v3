# Feature: Wishlist detail surfaces

**From build-plan:** 17d
**Status:** complete

## Goal

Bring the feature-17 themed surfaces to the wishlist detail page: the same
hero band and decorative accent tints (17b) plus the screenshots carousel
section (17c), driven by the wish's own version 3 RAWG snapshot. Base-game
wishes without a snapshot, wishes with v1/v2 payloads, and DLC wishes render
exactly as today. Fill-only enrichment and the read-only compatibility block
stay untouched.

## Design reference

No mockup exists (`prototypes/` was discarded after feature 14; 19a owns the
next prototype round), matching the 17b and 17c precedent. The visual target
is the already-shipped game detail treatment: the wishlist hero is
structurally identical to `GameDetailHero` (same grid, same
`DetailHeroArt`), so it takes the same scoped classes, and the screenshots
section is the same `ScreenshotsSection` component. No new visual design is
introduced; if a concrete reference is wanted first, run `/prototype` before
`/implement`.

## In scope

- Wiring `/wishlist/[id]` in `GameThemeScope` with the palette resolved from
  the wish's own `WishlistMetadataSnapshot.payload` via the existing
  `resolvePagePalette` guard
- The shared themed-hero treatment on `WishlistDetailHero` (hero band border,
  gradient wash, accent title) by reusing the existing scoped classes
- Rendering the existing `ScreenshotsSection` from the wish's own snapshot
  payload via the existing `resolvePageScreenshots` guard
- Decorative SectionCard/StatusPill tints and accent-driven interactive
  elements arriving automatically inside the scope (no new CSS)

## Out of scope

- Inherited metadata: DLC wishes and base wishes without their own snapshot
  keep today's rendering; the base game's catalog snapshot is displayed in
  the metadata block (existing 11c behavior) but never themes this page or
  feeds its screenshots. The build plan scopes 17d to "base-game wishes with
  a snapshot"
- The wishlist list page and every other route
- Any provider call, fill action, snapshot schema, or enrichment change;
  `WishlistRawgFillButton` and the fill-only rule are untouched
- Personal override UI of any kind; wishlist compatibility stays read-only
  per 11c-c
- Renaming the `game-detail-hero` scoped classes; the wishlist hero reuses
  them as the shared themed-hero contract
- Wallhaven, semantic tokens, and the Carousel component itself

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Theme scope wiring** - in
  `src/app/(app)/wishlist/[id]/page.tsx` resolve
  `const themePayload = entry.metadataSnapshot?.payload ?? null` and wrap the
  page content in `<GameThemeScope palette={resolvePagePalette(themePayload)}>`,
  mirroring the game detail page. Import both from `@/components/games` paths
  (cross-feature import precedent: `MetadataSection` already does this).
  *Done when:* with `pnpm dev`, a base-game wish whose own snapshot is v3
  shows the three `--game-accent*` variables on the wrapper in the DOM
  inspector and its cards and pills pick up the accent tints; a wish without
  a snapshot and a v1/v2 own snapshot show none; toggling reduced data in
  Settings removes the variables live; the page otherwise renders unchanged.

- [x] **Step 2 - Hero band treatment** - add the existing scoped classes to
  `WishlistDetailHero`: the section element also carries `game-detail-hero`
  and its text column also carries `game-detail-hero__content`. No CSS and no
  prop changes; the rules in `globals.css` apply through the scope.
  *Done when:* a themed wish's hero shows the accent-tinted top border,
  gradient wash, and accent title matching the game detail treatment in dark
  and light screenshots; an un-themed wish's hero is pixel-identical to
  today.

- [x] **Step 3 - Screenshots section** - in the same page resolve
  `const screenshots = resolvePageScreenshots(themePayload)` and render
  `<ScreenshotsSection id={entry.id} title={entry.name}
  screenshots={screenshots} sourceUrl={entry.metadataSnapshot?.sourceUrl ??
  ownMetadata?.rawgUrl ?? null} />` after the notes paragraph and before
  `DeleteWishlistEntrySection`, mirroring the game detail placement (bottom,
  before the danger zone). The component is reused unchanged.
  *Done when:* a themed wish shows the Screenshots carousel with working
  Previous/Next and the "Screenshots via RAWG" credit line; a wish without an
  own snapshot, a v1/v2 own snapshot, and a DLC wish show no section; under
  reduced data the slides render as gradient tiles with no image requests.

- [x] **Step 4 - Acceptance** - run `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. Walk wishlist detail for: a themed base-game wish, a
  base-game wish without a snapshot, a wish with a v1/v2 own snapshot, and a
  DLC wish with inherited metadata, each in dark, light, and system modes,
  with reduced motion on (carousel manual), reduced data on (no theme
  variables, token tiles), and the Wallhaven background enabled. Also fill a
  snapshot through the existing fill button and confirm the theme and
  screenshots appear after the fill completes.
  *Done when:* themed surfaces appear only for base-game wishes whose own
  snapshot carries a valid v3 palette and screenshots; every un-themed case
  renders exactly as pre-feature; all three checks are green.

## Files / areas

- `src/app/(app)/wishlist/[id]/page.tsx` - scope wrap, guard calls, section
  render
- `src/components/wishlist/WishlistDetailHero.tsx` - shared hero classes only
- No new files, no CSS changes, no schema or action changes

## Data / contracts

- Consumes the 17b contracts unchanged: `GameThemeScope { palette: RawgPalette
  | null; children }`, `resolvePagePalette(unknown)`, CSS variables
  `--game-accent`, `--game-accent-dark`, `--game-accent-muted`
- Consumes the 17c contracts unchanged: `resolvePageScreenshots(unknown)`
  (v1/v2 tolerant, capped at 6) and `ScreenshotsSection { id, title,
  screenshots, sourceUrl }`
- New rule locked here: wishlist themed surfaces resolve from the wish's OWN
  `WishlistMetadataSnapshot.payload` only. Inherited catalog metadata from
  the owned base game stays display-only in the metadata block. Note this if
  any later feature assumes otherwise.
- A filled snapshot is a new replaceable snapshot row; new fills write v3
  payloads (17a), so the theme and screenshots appear on the next page load
  without extra work
- No Prisma, API, or snapshot schema changes

## Testing

- No new pure logic is expected: both guards and all reused components are
  already unit-tested by the 17b and 17c suites. If a step surfaces new
  in-scope logic, add a focused Vitest test in that step per the test gate.
- Everything else is UI: per-step browser evidence in dark and light plus the
  build; reduced-motion, reduced-data, and fill behavior are verified live
  through the Settings toggles and the fill button (Step 4)

## Notes for the AI

- The page stays a server component; `GameThemeScope` remains the client
  boundary. Resolve palette and screenshots server-side and pass clean data
  down; never cast the payload directly.
- Reusing the `game-detail-hero` class names on the wishlist hero is
  deliberate: the name is the shared themed-hero contract, not a claim that
  the page is a game page. Renaming both components and the CSS rules is out
  of scope to keep this diff minimal.
- Inside the scope, `--primary`, `--ring`, and `--signal*` map to the accent,
  so the "View offers" button, links, and the interest rating adopt it
  automatically, exactly like game detail. Verify contrast while walking;
  change nothing.
- The scope's dark-mode foreground tint excludes
  `game-theme-section-card--danger`, so the delete section stays danger-toned.
- Single-user app: no per-user scoping. No comments except non-obvious
  decisions; no em dashes in generated content.
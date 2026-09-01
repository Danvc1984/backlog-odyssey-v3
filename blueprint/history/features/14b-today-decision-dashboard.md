# Feature: Today decision dashboard

**From build-plan:** feature 14b
**Status:** not started

## Goal

Redesign Today's composition around its existing data and business logic: a
split first viewport with `Currently playing` and `Featured offers` carousels,
a dominant Play Next Best Fit with a compact rail for the remaining roles, and
Buy plus the supporting surfaces below. Presentation and small interaction
composition only - no ranking, eligibility, dismissal, or data changes.

## Design reference

- `prototypes/today.html` (restored from git history for this feature; it was
  discarded at 14a `/complete` and is discarded again at this feature's
  `/complete`). Source of the visual language: spotlight and opportunity hero
  cards, section eyebrows, `technical-label` metadata, badge treatments, the
  operations strip, and the tune strip.
- Two deliberate overrides of the mockup, per build-plan 14b and the overview:
  - The mockup's three-equal-card runway predates the role system. Build the
    **dominant Best Fit card (roughly two thirds) plus a compact rail** for
    every remaining stored role instead.
  - The mockup's `Continue game` button and playtime/momentum figures are not
    built: the carousel never claims to resume or launch, and no new data
    joins are added. The call to action is `Open details`.

## In scope

- A reusable client Carousel primitive: visible manual prev/next controls, a
  `2 / 3` position indicator, keyboard accessible, slow auto-advance (about
  8 seconds per slide) that pauses on hover and focus-within, and no
  auto-advance at all when the resolved motion preference is reduced.
- Currently playing carousel: main game first, then in-progress titles, from
  the existing `todayGames` query (no new queries). Spotlight-style card with
  token gradient art, state badges, title linking to `/games/[id]`.
- Featured offers carousel: the top 3 from the existing `rankTodayOffers`
  output (already capped at 3), in existing ranking order, with discount,
  price and currency, store, fetched freshness, `targetMet` signal, seller
  link, and wishlist detail link.
- Play Next: dominant primary Best Fit card exposing the stored explanations,
  factor/caveat chips (compatibility and source evidence already ride in
  factors), Start playing, and dismissal; compact rail for the remaining
  stored roles, each keeping Show another.
- Buy stays a full section with its existing role groups and Show another.
- Supporting surfaces below: recent Steam activity, data health (backlog
  progress metrics plus the coverage dialogs), operations strip.
- Header composition: display-style h1 with lede, `Update recommendations`
  action, and a latest-run technical meta (when a run exists).

## Out of scope

- Any engine change: eligibility, scoring, rotation, cooldowns, calibration,
  dismissal handling, and exposure events all behave exactly as shipped.
- No new Prisma queries, migrations, providers, or server actions.
- No RAWG artwork or remote images on Today; cards use deterministic token
  gradients. Artwork plus reduced-data consumption arrives in 14c/14d.
- No playtime, last-played, or momentum data (mockup figures are decorative).
- Tune panels stay attached to their engine sections, restyled only; no new
  header tune entry point.
- Library/Wishlist surfaces (14c), detail routes (14d), full cross-app
  acceptance pass (14e), Wallhaven (15), per-game palettes (16).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Carousel primitive, auto-advance gate, resolved motion** - Add
      a client `Carousel` component (manual controls, position indicator,
      keyboard access, hover/focus pause) and pure helpers in
      `src/lib/carousel.ts` (`shouldAutoAdvance`, `advanceIndex`). Extend
      `VisualPreferencesProvider` additively so `useVisualPreferences()`
      exposes a resolved `motion` value (setting + system media query through
      the existing `resolveVisualPreferences`), and never a raw `matchMedia`
      check in the carousel itself. *Done when:* with 2+ slides the controls
      move slides and update the position label, keyboard focus reaches the
      controls, auto-advance ticks only at about 8s when resolved motion is
      full and the carousel is not hovered/focused, reduced motion (system or
      manual override) leaves it fully manual, one slide hides the controls,
      a `motion: "system"` setting with an OS reduced-motion flag resolves to
      `reduced`, zero slides renders nothing, timers clean up on unmount, and
      the new unit tests plus the full existing suite stay green.
- [x] **Step 2 - Currently playing carousel** - Derive slides from the
      existing `todayGames` result (main game first, then in-progress titles
      excluding the main game, name-ordered), add the spotlight-style slide
      card, and split `TodaySummary`: the current-games part is replaced by
      the carousel and the backlog progress counts move to a compact
      data-health block. Empty slide when there is no main game and nothing
      in progress, linking to `/library`. *Done when:* the content leads with
      the carousel in TodaySummary's former position (final page order lands
      in step 5), every slide links to its game detail page, the main game is
      never duplicated inside the in-progress slides, the empty state shows
      with the library link, no new database calls appear, and `pnpm build`
      passes.
- [x] **Step 3 - Featured offers carousel** - Replace the `TodayOffers`
      list section with the carousel of the existing top-3 ranked offers,
      rendered as opportunity cards (discount, price/currency, store,
      fetched timestamp, target-met badge, seller link, wishlist detail
      link), and delete `TodayOffers.tsx`. *Done when:* offers render in the
      existing rank order with no scoring or filtering change, the empty
      state keeps the current guidance without triggering any price refresh,
      and `pnpm build` passes.
- [x] **Step 4 - Play Next dominant card and rail** - Restructure the Play
      Next section: dominant card for the current Best Fit 1 slot (or, on a
      thin run where that role has no item, the first stored role in
      `PLAY_ROLE_GROUPS` order that has an item) at roughly two thirds width
      with full explanations, Start playing, dismissal, and Show another;
      compact rail for every remaining stored role that has an item, each
      with Show another, in `PLAY_ROLE_GROUPS` order. Keep the legacy no-role
      grid path for old runs and the existing no-run and empty states. The
      rail card is a new compact component, not a resized
      `RecommendationItemCard`. *Done when:* exactly the storage roles that
      have items are displayed (dominant + rail, nothing dropped, no role
      without an item shown), rotation and dismissal still work on every
      card, the exposure tracker still covers all shown play items, the
      fallback paths render as before, the rail stacks under the dominant
      card on mobile widths, and `pnpm build` passes.
- [x] **Step 5 - Buy, supporting sections, and header** - Reorder the page
      to header, taste setup (when shown), hero carousels, Play Next, Buy
      (unchanged behaviorally, restyled), recent activity, data health with
      coverage dialogs, operations strip; adopt the header composition with
      `Update recommendations` and latest-run meta. *Done when:* the page
      order matches this composition in dark and light on desktop and mobile
      widths, Buy keeps its groups and Show another behavior, the header
      meta hides when no run exists, and `pnpm build` + `pnpm test` pass.

## Files / areas

- `src/components/today/Carousel.tsx` (new, client) - shared primitive.
- `src/lib/carousel.ts` + `src/lib/carousel.test.ts` (new) - pure advance logic.
- `src/components/today/CurrentlyPlayingCarousel.tsx` (new, server-rendered slides).
- `src/components/today/FeaturedOffersCarousel.tsx` (new); delete `src/components/today/TodayOffers.tsx`.
- `src/components/preferences/VisualPreferencesProvider.tsx` - additive: expose a resolved `motion` value alongside the stored setting.
- `src/components/recommendations/PlayNextRailCard.tsx` (new) - compact rail card with Show another.
- `src/app/(app)/today/page.tsx` - composition, dominant/rail, header.
- `src/components/today/TodaySummary.tsx` - split into the data-health block.
- `src/components/today/TodayOperations.tsx`, `RecentSteamActivity.tsx`,
  `CoverageDialog.tsx` - token-level restyle only where needed.

## Data / contracts

No schema, API, or provider changes. Contracts consumed as-is:

- `TodayOfferView` (`src/lib/today-offers.ts`): already capped at 3, already
  ranked (target-met first, then price, then name); `targetMet` drives the
  opportunity badge.
- `RecommendationItem.role` (`BEST_FIT_1`, `BEST_FIT_2`, `CHANGE_OF_PACE`,
  `OUT_OF_THE_BOX`, `DEAL`) and `PLAY_ROLE_GROUPS` in `today/page.tsx` stay
  the single role-ordering source - flag as load-bearing.
- `RecommendationCardTarget` plus `RecommendationItemCard` /
  `ShowAnotherButton` props are unchanged; the dominant card reuses them, the
  rail uses the new compact `PlayNextRailCard`.
- `todayGames` query shape (id, name, `isMainGame`, `playState`) is the only
  source for Currently playing slides.
- 14a preferences contract (load-bearing, extended here additively):
  `useVisualPreferences()` gains a resolved `motion` value so the carousel
  never reads the media query itself; the stored `motion` setting and the
  `data-motion` attribute remain unchanged. `cross-tab storage` handling means
  a preference change in another tab re-resolves the exposed value.

## Testing

Vitest gate is on; the logic-bearing step ships tests:

- `src/lib/carousel.test.ts` - `advanceIndex` and `shouldAutoAdvance`: zero and
  one slide never auto-advance, wrap-around at both ends, hover or focus
  pauses, and the resolved reduced-motion preference forces manual mode. The
  resolved-motion test covers the additive provider behavior: a `"system"`
  stored setting with an OS reduced-motion flag resolves to `reduced`; an
  explicit `"reduced"` override wins over a non-reduced OS flag.
- Everything else is UI composition: verified with `pnpm build` plus live
  dev-server evidence in dark and light at desktop and mobile widths
  (manual browser walkthrough; no Playwright in this project).
- Final gate: `pnpm build` and `pnpm test` (no `Verify` command declared;
  `pnpm lint` and `pnpm typecheck` stay green).

## Notes for the AI

- The page stays a server component; only the Carousel, existing client
  cards, and the new rail card are client. Slides render server-side inside
  the client shell.
- The resolved `motion` value added to `VisualPreferencesProvider` is
  additive: keep the existing `motion` (stored setting), `data`, `setMotion`,
  `setData` surface intact and present to 14b's own components, and test the
  resolution path in the provider's pure logic without regressing the 14a
  tests.
- Do not copy the mockup's `Continue game` label, momentum numbers, or
  three-equal-card runway; the overrides in the design reference section win.
- Preserve every stored role in the Play Next display: the overview explicitly
  retires the old "three latest" wording; dominant plus rail shows all roles
  that have an item.
- `RunExposureTracker` must stay mounted for all displayed items in both
  engines; rotation, dismissal, and Start playing flows are untouched.
- Empty states give contextual guidance and links to existing actions only;
  nothing on Today may start sync, enrichment, price, compatibility, or
  recommendation work implicitly.
- The carousel never reads `matchMedia` itself; the resolved value comes from
  `useVisualPreferences` so a manual reduced-motion override wins over the OS
  setting, including mid-session preference changes.
- Respect the writing standard: no em dashes in code, comments, or docs.

# Feature: 21a Global visual fixes

**From build-plan:** feature 21a
**Status:** complete

## Goal

Three owner-reported visual fixes that affect every route: the favicon must
keep the active palette family after reload instead of snapping back to the
cyan Dawn dragon, the ambient glow effect disappears from the whole app across
all four palettes (surviving only on two offer-threshold exceptions), and the
desktop sidebar minimizes/maximizes by clicking it.

## In scope

- **Favicon family persistence.** Today the pre-paint script
  (`src/app/layout.tsx`) sets the icon from the stored family, but React
  hydration reconciles the React-rendered `<link rel="icon">` back to the
  server value (`/dragon-icon-dawn.svg`), overwriting it with cyan; the
  provider only re-applies the icon on preference *changes*
  (`src/components/preferences/VisualPreferencesProvider.tsx:100`). Fix by
  making the favicon fully script-owned: remove `metadata.icons` from
  `src/app/layout.tsx`, extend the pre-paint script to create or update the
  icon link, and re-apply family attributes + favicon once on provider mount
  as a safety net. Family-based mapping (Dawn/Sunset SVGs) is unchanged.
- **Glow removal.** Remove every static `shadow-glow` usage:
  `src/components/ui/button.tsx:12` (default variant, affects all default
  buttons), `src/app/(app)/_components/AppNav.tsx:33` (brand mark),
  `src/components/games/GameDetailHero.tsx:68`,
  `src/components/wishlist/WishlistDetailHero.tsx:73` (primary buttons).
  Remove the now-pointless suppression rule
  `.game-theme-scope .shadow-glow { box-shadow: none !important }`
  (`src/app/globals.css:455`) so the exception can render inside themed
  scopes. Keep the four `--shadow-glow` token definitions and the
  `@theme` mapping; `shadow-glow` becomes the exception-only utility.
- **Glow exception 1 - Today BuySignal.** The full buy signal panel
  (`src/components/today/TodayHeroGrid.tsx`) gets `shadow-glow` when its
  displayed offer has a discount above 60%.
- **Glow exception 2 - wishlist offers above 80%.** In the wishlist catalog
  (`src/components/wishlist/WishlistCard.tsx`, discount badge on grid and
  list variants) and on the wishlist detail selected offer
  (`src/components/wishlist/WishlistOfferSection.tsx`), the offer gets
  `shadow-glow` when its discount is above 80%.
  (Interpretation: "el detalle de juegos" = the wishlist detail page, the
  only detail surface where offers exist; flagged for owner confirmation.)
- **Sidebar toggle.** Clicking the desktop sidebar (`AppNav` aside, `md+`)
  toggles between expanded (232px) and a collapsed icon-only rail (~68px:
  brand icon, nav icons with `title` tooltips, icon-only sign out; text
  labels and email hidden). Clicks on interactive children (nav links, brand
  link, sign out button) navigate as today and do not toggle. State persists
  in `localStorage` (`backlog-odyssey:sidebar-collapsed`, non-migrating) and
  is restored after mount - no hydration mismatch; mobile bottom nav is
  untouched.

## Out of scope

- Everything else in feature 21 (21b-21h).
- Light/dark favicon variants (favicon stays family-based with the two
  existing SVGs).
- Mobile bottom navigation behavior.
- Staleness gating on the glow thresholds: the glow follows the displayed
  discount value only, per the owner's wording. Tightening to fresh offers
  only is a cheap follow-up if wanted.
- New icon assets or palette changes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Favicon survives reload** - remove `icons` from
      `metadata` in `src/app/layout.tsx`; extend
      `prePaintVisualPreferences` to set (creating the link if missing)
      `link[rel="icon"]` from the stored family; add one mount effect in
      `VisualPreferencesProvider` that runs `commit(state)` once so family
      attributes and favicon are re-applied after hydration. *Done when:*
      with Sunset selected, a hard reload on `/today` keeps the orange
      dragon favicon after hydration (no cyan flash-back); Dawn reload keeps
      the cyan one; switching family in Settings still swaps the favicon
      instantly; `pnpm build` passes.
- [x] **Step 2 - Remove static glow** - delete `shadow-glow` from the four
      usage sites (button default variant, AppNav brand, both hero primary
      buttons) and delete the `.game-theme-scope .shadow-glow` suppression
      rule; keep the token definitions and `@theme` mapping. *Done when:*
      no button, brand mark, or hero action shows the ambient glow in any of
      the four palettes; `rg "shadow-glow" src` returns only token
      definitions and the mapping; `pnpm build` passes.
- [x] **Step 3 - Deal-glow helper and tests** - add
      `src/lib/deal-glow.ts` with `BUY_HEADING_GLOW_THRESHOLD = 60`,
      `OFFER_GLOW_THRESHOLD = 80`,
      `shouldGlowBuyHeading(maxDiscount: number | null | undefined)` and
      `shouldGlowOffer(discount: number | null | undefined)` (null/undefined
      and values at or below the threshold return false), plus Vitest cases
      around each boundary. *Done when:* `pnpm test` passes with the new
      cases.
- [x] **Step 4 - Wire the glow exceptions** - Today `BuySignal`: add
      `shadow-glow` to the full panel via
      `shouldGlowBuyHeading(offer.discountPercent)`; WishlistCard: apply the
      same 60% logic to the full card and `shouldGlowOffer` to the discount
      badge (grid and list variants); buy recommendation cards use the selected
      offer discount with the same 60% threshold; WishlistOfferSection applies
      `shouldGlowOffer` to the selected offer. *Done when:* a BuySignal or buy
      recommendation card above 60% glows on the full component and one at or
      below does not; a wishlist entry above 60% glows on its full catalog card,
      and an offer above 80% glows on its badge and wishlist detail (including a
      themed scope), while values at or below their respective thresholds do not.
- [x] **Step 5 - Sidebar click toggle** - in `AppNav`, add collapsed state
      (default expanded; restored from `localStorage` in a mount effect,
      persisted on toggle), render the icon-only rail when collapsed, and
      toggle on aside clicks that are not on a link or button. *Done when:*
      clicking empty sidebar space collapses to the icon rail and clicking it
      again expands; nav links and sign out work in both states without
      toggling; a reload keeps the chosen state (restored after mount, no
      hydration warning); mobile bottom nav is unchanged; `pnpm build`
      passes.

## Files / areas

- `src/app/layout.tsx` - metadata icons removal, pre-paint script favicon
  handling.
- `src/components/preferences/VisualPreferencesProvider.tsx` - mount-time
  re-apply.
- `src/app/globals.css` - remove suppression rule (tokens unchanged).
- `src/components/ui/button.tsx`, `src/app/(app)/_components/AppNav.tsx`,
  `src/components/games/GameDetailHero.tsx`,
  `src/components/wishlist/WishlistDetailHero.tsx` - glow removal; AppNav
  also gains the collapse behavior.
- `src/lib/deal-glow.ts` (new) + `src/lib/deal-glow.test.ts` (new) -
  thresholds and tests.
- `src/app/(app)/today/page.tsx`, `src/components/wishlist/WishlistCard.tsx`,
  `src/components/wishlist/WishlistOfferSection.tsx` - exception wiring.

## Data / contracts

- No schema or API changes. Reads only the already-displayed
  `selectedOffer.discount` values on rendered surfaces.
- New non-migrating `localStorage` key `backlog-odyssey:sidebar-collapsed`
  (`"1"` = collapsed), same mechanism family as the feature-14 visual
  preferences; not exported or migrated.

## Testing

- Vitest covers the threshold helper (Step 3): boundary values around 60 and
  80, null/undefined, and the max-discount heading path.
- Favicon, glow, and sidebar are visual/interaction: verify manually in the
  running app per step done-whens (family toggle + hard reload for Step 1;
  `rg` evidence plus palette spot-checks for Step 2; a >80% offer entry for
  Step 4; sidebar clicks and reload for Step 5). `pnpm build` gates every
  step.

## Notes for the AI

- Client vs server: `AppNav` and `VisualPreferencesProvider` are client
  components; `layout.tsx` stays a server component (the pre-paint script is
  a plain string there). Today's BuySignal is server-rendered - its glow can be
  computed from the displayed offer data.
- Do not introduce a new glow token; reuse `shadow-glow` as the
  exception-only utility so family colors keep working in all four palettes.
- Sidebar persistence must be read after mount only (mirrors the hydration
  discipline that feature 21h will need); never derive initial collapsed
  state from `localStorage` during render.
- The >60% heading threshold follows the displayed discount even if the
  offer is stale; noted as an accepted interpretation in scope.
- Match existing code style: no comments, `cn()` for conditional classes.

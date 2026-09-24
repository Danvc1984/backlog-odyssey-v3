# Feature: Mobile responsiveness pass

**From build-plan:** feature 35
**Build attempt:** 1
**Branch:** `feature/mobile-responsiveness-pass`
**Status:** verified

## Goal

Make the complete app usable on narrow mobile screens before deployment: no clipped or overflowing text or actions, a proportionate information hierarchy, reachable detail actions, and practical Library and Wishlist browsing.

## Design reference

- [Today focus and worthy-bargain sizing reference](../reference/mobile-bargain-layout-reference.png)

## In scope

- Review every primary public and authenticated route at mobile widths, including its visible loading, empty, error, dialog, disclosure, and overflow states.
- Correct horizontal overflow, clipped text, oversized headings or controls, and sections whose contents are unreachable in the available viewport.
- Keep Game Detail and Wishlist Detail `More actions` reachable on mobile, including when the action set is long.
- Keep compatibility headings and freshness evidence, including `Evidence updated never`, readable without overflow.
- Make the dense Library health strip and Wishlist signals collapsible on mobile while retaining the complete information on desktop.
- Remove the Library and Wishlist list-mode control on mobile and render their existing list URL state as the grid presentation instead. Render Collection detail games as the grid presentation.
- On Today, use the selected offer game's recognizable but still blurred artwork as the background of the `A worthy bargain has surfaced!` panel, retain readable foreground content with the existing fallback when artwork is absent, and align its desktop height to the Today focus slide rather than the carousel controls below it.
- Enable the existing global Wallhaven background on mobile when wallpapers are enabled and reduced-data mode is off, while preserving its decorative treatment and controls.
- Preserve desktop layouts, existing behavior, accessibility, data, and recommendation or provider rules.

## Out of scope

- New product data, routes, server actions, API contracts, schema changes, provider work, recommendation changes, or new list filters.
- A visual redesign unrelated to mobile fit, apart from the approved Today bargain-art treatment and mobile Wallhaven availability, or changes to the established Dawn/Sunset visual system.
- Automated browser-test infrastructure.

## Build loop

Implement and review one checked step at a time. For each UI step, inspect the affected flow in a mobile viewport and show the diff before continuing. Run focused checks when they apply; before final review run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Do not commit without approval.

## Build steps

- [x] 1. Establish responsive layout safeguards across the app shell and primary route structures.
  - Use the existing Tailwind mobile-first breakpoints and shared layout patterns to prevent viewport-width overflow, reduce mobile-only heading and control footprints, and give content an appropriate scroll path instead of clipping it.
  - Cover public sign-in, Welcome, Today, Library, game detail, Wishlist, wishlist detail, Collections, Settings, and the error surface, including their visible dialogs and disclosures.
  - **Done when:** At a narrow mobile viewport, every primary route can be vertically navigated without unintended horizontal page overflow; lengthy text wraps or truncates only when its full value remains available through the existing interaction; and every constrained section remains reachable by the appropriate scroll behavior. Desktop composition remains unchanged.

- [x] 2. Repair mobile detail-page hierarchy, actions, and compatibility evidence.
  - Update `GameDetailHero`, `WishlistDetailHero`, and the catalog and wishlist compatibility sections so titles occupy a proportionate amount of a mobile viewport, action controls fit, and the `More actions` disclosure cannot be cropped by its hero or viewport.
  - Make heading-side evidence and refresh controls wrap or stack without hiding the title or freshness text, including the no-evidence state.
  - **Done when:** On both detail routes at mobile width, long game names, the complete action set, compatibility headings, `Evidence updated never`, stale evidence, and refresh controls are visible and operable without clipping or horizontal overflow. Keyboard and touch disclosure interaction exposes each action and preserves focus visibility.

- [x] 3. Make Library and Wishlist browsing compact and usable on mobile.
  - Add mobile-only disclosure for the Library health strip and Wishlist signals, with an accessible label and the current summary information still available before expansion. Keep the existing full strip visible at desktop widths.
  - Hide the Library and Wishlist list-mode control on mobile, render a `view=list` URL as the established grid presentation at that width, and render Collection detail games as grid cards.
  - **Done when:** Library and Wishlist health summaries collapse and expand by keyboard and touch on mobile, remain fully visible on desktop, mobile browsing exposes only the grid presentation even from a list URL, and Collection detail games use grid cards. Users can still open an item and invoke its available card actions.

- [x] 4. Complete the cross-route mobile acceptance pass and responsive cleanup.
  - Add the approved Today bargain-art treatment, align the bargain panel with the Today focus slide while keeping desktop carousel controls below that row, and enable the existing decorative Wallhaven background on mobile without bypassing the wallpaper-enabled or reduced-data rules.
  - Recheck all primary routes and their relevant empty, error, loading, dialog, long-content, and scrollable-section states after the targeted fixes; repair any remaining responsive regressions in scope.
  - Verify all supported theme modes retain readable contrast, focus indicators, reduced-motion behavior, and mobile bottom-navigation clearance.
  - **Done when:** The Today bargain panel uses its offered game's recognizable blurred artwork when available, otherwise its existing visual fallback, and aligns to the Today focus slide rather than its carousel controls at desktop widths; Wallhaven appears as a decorative global background on mobile only when enabled and reduced-data mode is off; a manual mobile walkthrough of every primary route finds no remaining unintended overflow, cropped control, inaccessible section, or dominant oversized title from this feature's scope; dark, light, and system modes remain readable; and the final automated checks pass.

## Files / areas

- `src/app/(app)/_components/AppNav.tsx` and primary route pages under `src/app/(app)/` - mobile shell, page-level headings, summaries, filters, and route-specific layout.
- `src/components/games/GameDetailHero.tsx`, `CompatibilitySection.tsx`, `LibraryHealthStrip.tsx`, and `LibraryGameCard.tsx` - catalog detail actions/evidence, health summary, and mobile list composition.
- `src/components/wishlist/WishlistDetailHero.tsx`, `WishlistCompatibilityBlock.tsx`, `WishlistList.tsx`, and `WishlistCard.tsx` - wishlist detail actions/evidence and list composition.
- `src/app/(app)/today/page.tsx`, `src/components/today/TodayHeroGrid.tsx`, `src/lib/today-offers.ts`, and `src/components/ui/BlurredArtworkBackdrop.tsx` - offer-art selection and reduced-data-aware Today bargain presentation.
- `src/components/wallpaper/WallpaperBackground.tsx` - mobile availability of the existing decorative wallpaper.
- Shared UI components and other route-local components only where the acceptance pass identifies a responsive defect.

## Data / contracts

No persistence, API, authorization, provider, recommendation, or schema contract changes. `TodayOfferView.imageUrl` carries already-loaded wishlist or inherited base-game IGDB art for presentation only. Existing links, actions, disclosures, detail anchors, and desktop behavior stay intact. Mobile simplification changes presentation only; it must not remove the ability to reach an existing action or detail page.

## Testing

- Baseline before implementation: `pnpm typecheck`, `pnpm test`, and `pnpm build` passed on the pre-feature tree. Vitest reported 133 passing files and 1,298 passing tests.
- This is primarily UI work. The presentation-only Today offer-art value has focused `today-offers` unit coverage; other layout changes need live browser evidence.
- At each affected step, inspect the running app in a narrow mobile viewport. At final review, manually cover every primary route, both detail action disclosures, compatibility evidence with no data and stale data when available, Library and Wishlist collapsed summaries, both list modes, dialogs, and desktop regression checks.
- Final automated gate: `pnpm typecheck && pnpm test && pnpm build`. There is no configured `verify` script or browser-test command.

## Notes for the AI

- Preserve the existing Tailwind and shadcn/ui conventions. Keep server components server-side; add client state only where a mobile disclosure requires it.
- Use mobile-first CSS. Favor wrapping, responsive stacking, or an explicitly scrollable constrained region over hiding functional content.
- The page's mobile bottom navigation must not cover controls or the final content of a scrollable page.
- Do not introduce arbitrary viewport-specific product rules, alter existing data selection, or change desktop information architecture while fixing mobile fit.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9491,"specSha256":"514702126d585cd7d0bd16c2fcf8bdc893cbfdd353b27cb05e7255f5566fb992","branch":"refs/heads/feature/mobile-responsiveness-pass","head":"172e5db2c38d27fece9d077ff18da48686d2b53d","baseRef":"refs/heads/main","baseCommit":"172e5db2c38d27fece9d077ff18da48686d2b53d","sourceTree":"63ccf32ce57b851b194ac07413925ee36b7ca7ab","absentOptional":[]} -->

## Findings

### 35/F-01 [P2] closed - Wishlist offer price bypassed the active theme primary color

**File:** `src/components/wishlist/WishlistOfferSection.tsx:84`
**Found:** 2026-09-23 by `/audit` (scope: Library and Wishlist surfaces; lens: quality)
**Why it matters:** The active feature requires the detail price to use the theme primary color. The hero price follows that rule, but the selected price in the Offers section uses a hard-coded emerald class when discounted, producing conflicting price emphasis in the same Wishlist detail flow.
**Suggested fix:** Render the selected offer price with the primary token and retain a separate semantic treatment only for the discount badge.
**Resolution:** Fixed 2026-09-23. The offer price now uses `text-primary`; the discount badge remains an emerald semantic signal. Closed 2026-09-24 by `/audit`: re-reviewed `WishlistOfferSection.tsx` and confirmed the price token and semantic discount badge are separate.

### 35/F-02 [P3] closed - Card deletion affordances did not match the approved Library/Wishlist model

**File:** `src/components/wishlist/WishlistEntryActions.tsx:72`
**Found:** 2026-09-23 by `/audit` (scope: Library and Wishlist surfaces; lens: quality)
**Why it matters:** Library cards and Library detail now expose the destructive trigger as `Remove entry`, while Wishlist cards still show only a trash icon. The two parallel browsing surfaces therefore give the same category of destructive action inconsistent affordance and label clarity.
**Suggested fix:** Apply one agreed model across both surfaces: icon-only destructive triggers in cards, and visible `Remove entry` triggers in detail views.
**Resolution:** Fixed 2026-09-23. Per the approved interaction model, both Library and Wishlist cards use an icon-only destructive trigger, while their detail pages retain the explicit `Remove entry` label. Closed 2026-09-24 by `/audit`: re-reviewed the Library and Wishlist card/detail trigger paths.

### 35/F-03 [P2] closed - Acquisition view omitted required price-conversion disclosure

**File:** `src/components/wishlist/AcquireWishlistDialog.tsx:203`, `src/components/settings/AccountCard.tsx:217`
**Found:** 2026-09-24 by `/audit` (scope: current; lens: quality, tests)
**Why it matters:** The selected offer can be an estimated display-currency value or fall back to its source currency. The acquisition dialog did not qualify that displayed price, which could make a conversion estimate look authoritative.
**Suggested fix:** Add clear, context-specific copy in the acquisition dialog and explain the regional price/conversion behavior where the user changes those preferences.
**Resolution:** Fixed 2026-09-24. Per the user&apos;s decision, cards remain uncluttered; Account settings explains estimate and source-currency behavior, and the acquisition dialog now identifies estimated values or unavailable conversions in clear language. Closed 2026-09-24 by `/audit`: re-reviewed the Settings, Welcome, and acquisition flows and confirmed the disclosure remains at the selected configuration and decision points.

## Manual try guide

1. Start or reuse `pnpm dev`, then open `http://localhost:3500` with a narrow viewport.
2. Visit Today, Library, Collections, Wishlist, Settings, Welcome, and both detail routes. Open visible dialogs and disclosures, including both `More actions` controls.
3. Open `/library?view=list` and `/wishlist?view=list`; expect grid cards, compact expandable health summaries, and reachable card actions.
4. Toggle theme modes, reduced motion, and reduced data in Settings. Expect readable contrast, visible focus, safe bottom-navigation clearance, and decorative Wallhaven only when wallpapers are enabled and reduced data is off.
5. At desktop width, revisit Today, Library, Wishlist, and both details. Expect the established desktop composition, full health strips, and no cropped controls.

**Watch for:** horizontal page overflow, clipped titles or freshness text, a menu or dialog hidden behind mobile navigation, inaccessible scroll regions, unexpected list cards at narrow width, or artwork/wallpaper shown despite reduced-data settings.

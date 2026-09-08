# Feature 20d - Brand icons

## Goal

Replace the Lucide placeholder glyphs for known availability sources with the
official brand icons the owner placed in `public/`, wire the dragon icon as
the app's identity mark (browser tab icon / favicon and the nav brand), and
mark the wishlist offers source with the ITAD icon. The neutral fallback for
custom sources stays untouched, per the build plan.

Owner decisions steering this feature (2026-09-08):

- Source icons come from the SVG files already committed in `public/`
  (`steam.svg`, `epic-games.svg`, `gog.svg`, `ea-games.svg`, `ubisoft.svg`,
  `battle-net.svg`, `xbox.svg`, `itch-io.svg`, `amazon-games.svg`,
  `humble-bundle.svg`, `rockstar.svg`)
- `dragon-icon.svg` is the icon for the page title (the nav brand mark beside
  "Backlog Odyssey") and the favicon
- `itad.svg` is the icon for the wishlist offers source (IsThereAnyDeal powers
  price enrichment)

## In scope

- Brand icon resolution in `SourceIcon`: when a known source (or the STEAM
  availability source) has a brand file, render the official SVG from
  `public/`; otherwise fall back to the existing Lucide map
  (`Disc3` for ROM, `Box` for custom/unknown sources - unchanged)
- A `brandIcon` field on `KnownSource` (public filename) plus the STEAM entry
  in `availabilitySourcePresentation`, so the mapping is code-owned and typed
- Dragon favicon: remove the stale `src/app/favicon.ico`, set
  `metadata.icons` in `src/app/layout.tsx` to `/dragon-icon.svg`
- Dragon brand mark beside the "Backlog Odyssey" name in `AppNav`
- ITAD icon on the three surfaces that present offers/price data as
  ITAD-powered: the wishlist page description line, the wishlist detail
  offers section header, and the `PriceRefreshPanel` header
- Unit-test updates for the changed presentation mapping
- Visual verification that the colored official logos are legible on all four
  palettes in light and dark (adding a subtle backing plate per icon only if
  a logo disappears, e.g. white-filled glyphs on light backgrounds)

## Out of scope

- The general UI icon set swap (nav, buttons, etc.) - gated feature 20f
- Voice/copy changes - the existing "discounts powered by ITAD" wording and
  all other copy stay verbatim (20e)
- Downloading, optimizing, or restyling the provided SVGs - they are used
  as-is from `public/` with their official colors
- Brand icons for ROM (no official mark; keeps `Disc3`) and custom sources
  (keeps `Box`)
- Touching per-game themes, palette tokens, or typography

## Design reference

- `public/*.svg` - the owner-provided official brand files; the icon set is
  exactly these files, mapped 1:1 to the 10 known sources plus Steam
- `blueprint/context/project-overview.md` - "Themes, voice, and icons":
  official brand icons replace placeholder art for known sources; neutral
  fallback unchanged
- `src/lib/sources/known-sources.ts` - the code-owned catalog and
  presentation resolvers this feature extends

## Build steps

- [x] 1. Extend the source presentation with brand files: add `brandIcon`
      (public filename string) to each `KnownSource` entry and to the STEAM
      branch of `availabilitySourcePresentation` in
      `src/lib/sources/known-sources.ts`; extend `SourceIcon`
      (`src/components/sources/SourceIcon.tsx`) to accept the presentation
      and render the brand SVG via `<img src="/<file>" />` when present,
      keeping the current `size-4 shrink-0` box, `aria-hidden`, and the
      Lucide fallback for everything without a brand file. **Done when:**
      every consumer of `SourceIcon` (library filters, availability editor,
      alternative-sources card, create-game suggestions, recommendation
      factor chips, tune panel, today page) shows the official brand icons
      for known sources and Steam, while ROM rows and custom sources still
      show `Disc3` / `Box`.
- [x] 2. Add the dragon favicon: remove `src/app/favicon.ico`, add
      `metadata.icons` pointing at `/dragon-icon.svg` in
      `src/app/layout.tsx`. **Done when:** the browser tab shows the dragon
      icon on all routes (hard-refresh to bypass the cached .ico) and the
      app still builds.
- [x] 3. Add the dragon brand mark beside the "Backlog Odyssey" name in
      `AppNav` (small inline `<img>` from `public/`, aria-hidden, vertically
      centered with the name). **Done when:** the nav shows the dragon mark
      next to the app name on desktop and mobile without layout shift.
- [x] 4. Add the ITAD icon to the offers-source surfaces: the wishlist page
      description line, the wishlist detail offers section header, and the
      `PriceRefreshPanel` header - each showing `itad.svg` beside the
      existing text/copy. **Done when:** all three surfaces visibly mark the
      offers source with the ITAD icon on light and dark.
- [x] 5. Update `src/lib/sources/known-sources.test.ts` for the `brandIcon`
      fields and presentation changes; run `pnpm test`, `pnpm lint`,
      `pnpm build`. **Done when:** all three commands pass.
- [x] 6. Visual walkthrough across the four palettes in light and dark:
      brand icons legible everywhere they appear (16px is small - check each
      logo), dragon favicon and nav mark correct, ITAD marks present; if any
      white-filled logo vanishes on a light surface, wrap brand images in a
      subtle `bg-card` backing plate and re-verify. **Done when:** every
      surface from step 1 and 4 reads correctly in all four palettes, both
      modes, desktop and mobile widths.

## Files and areas

- `src/lib/sources/known-sources.ts` - `brandIcon` fields + STEAM presentation
- `src/components/sources/SourceIcon.tsx` - brand rendering with fallback
- `src/app/layout.tsx` - metadata icons
- `src/app/(app)/_components/AppNav.tsx` - dragon brand mark
- `src/app/(app)/wishlist/page.tsx`,
  `src/components/wishlist/WishlistOfferSection.tsx`,
  `src/components/wishlist/PriceRefreshPanel.tsx` - ITAD marks
- `src/lib/sources/known-sources.test.ts` - mapping tests
- Read-only: the `public/*.svg` owner-provided files

## Data and contracts

- Load-bearing: the **brandIcon filename contract** - `KnownSource.brandIcon`
  holds a `/public` filename (`"steam.svg"` style, no leading slash) and
  `SourceIcon` renders `/` + that filename. 20g acceptance and any future
  source rely on this shape.
- Load-bearing: the **fallback contract** - sources without a brand file
  keep the Lucide fallback (`FALLBACK_SOURCE_ICON = "Box"`); ROM stays
  `Disc3`. No behavior change for custom sources.
- No DB, export/import, or API changes - icons stay code-owned metadata.

## Testing

- Unit (gate applies): presentation mapping tests in
  `src/lib/sources/known-sources.test.ts` covering brandIcon presence for
  all 10 known sources + Steam, and fallback absence for custom sources
- Visual/manual: per-step done-whens, including the four-palette legibility
  pass in step 6
- `pnpm test`, `pnpm lint`, `pnpm build` as the gates

## Notes for the AI

- Render brand icons as plain `<img>` tags pointing at the public files -
  do not inline, fetch, bundle-process, or recolor them; their official
  colors are the point. Keep `aria-hidden` and the existing size box.
- `SourceIcon` currently takes `iconName` and some call sites pass literal
  Lucide names (the tune panel uses `"MonitorPlay"` for Steam). Expect small
  mechanical edits at call sites to pass the presentation's `brandIcon`
  through - the Steam literal becomes the brand file, ROM/custom literals
  stay as they are. Call sites that already resolve through
  `resolveSourcePresentation` / `availabilitySourcePresentation` only need
  the extra field forwarded.
- The dragon icon is also a Font Awesome free glyph (attribution comment
  inside the file) - fine for this private app; do not strip the comment.
- Do not replace Lucide icons outside the source-icon surfaces - that is the
  gated 20f.
- Copy stays untouched; the ITAD icon accompanies existing text, it does not
  reword it.

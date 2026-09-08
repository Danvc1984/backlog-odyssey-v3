# Feature 20c - Typography

## Goal

Apply the owner-locked typography pairing from the 20a prototype: Cinzel as
the display/heading face for headers and hero moments, Inter as the body/sans
face, with the technical monospace (Geist Mono) unchanged for evidence
labels, freshness stamps, and other technical text. The app already routes
all display and heading text through the `--font-display` / `--font-heading`
tokens, so this is a token re-point plus base-style tuning - no component
rewrites.

## In scope

- Font loading in `src/app/layout.tsx`: load Cinzel (display) and Inter
  (body) via `next/font/google`; keep Geist Mono for the technical face;
  remove the Geist Sans import once nothing references it
- Token re-point in `src/app/globals.css` (both the `@theme inline` block and
  the `:root` duplicates):
  - `--font-sans` -> Inter
  - `--font-display` -> Cinzel
  - `--font-heading` -> Cinzel
  - `--font-mono` / `--font-technical` -> Geist Mono (unchanged)
- Base heading style tuning in `globals.css` for Cinzel's wide serif
  letterforms (letter-spacing, line-height, weight on `h1`/`h2`/`h3` and the
  `.game-theme-scope .game-detail-hero h1` override) - tight negative
  tracking tuned for Geist reads wrong on Cinzel
- Legibility sweep of the few direct `font-display` / `font-heading`
  consumers (Today carousels, dialog titles, detail-card headings, nav brand)
  adjusting only weight/size/tracking where Cinzel clips or overshoots
- Verification that `.technical-label` and all mono surfaces still render
  Geist Mono in both light and dark and both palette families

## Out of scope

- Odyssey voice sweep copy - feature 20e (existing copy stays verbatim)
- Brand and UI icons - 20d/20f
- Palette/token color changes - 20b territory, already done
- Any new typography role, size scale change, or component structure change -
  sizes stay as they are; only the face and its tracking/weight tuning change
- Localizing fonts beyond `latin` subsets or adding fallback webfont loading
  beyond what `next/font` provides

## Design reference

- `blueprint/history/features/20a-prototype-lock.md` - locked decisions
  (owner-confirmed 07 Sep 2026): Cinzel is the display/heading face, Inter is
  the body/sans face, technical monospace remains unchanged
- `src/app/globals.css` - current token mappings and heading base styles
- No image reference needed: the pairing was locked by the owner at the 20a
  prototype review

## Build steps

- [x] 1. Swap the font loading in `src/app/layout.tsx`: import Inter and
      Cinzel from `next/font/google` (keep Geist Mono), expose them as
      `--font-inter` / `--font-cinzel` CSS variables on `<html>` alongside
      the mono variable, and drop the Geist Sans import. **Done when:**
      `pnpm build` succeeds with no unresolved `--font-geist-sans` reference
      left in `layout.tsx`.
- [x] 2. Re-point the tokens in `src/app/globals.css` (`@theme inline` block
      and the `:root` duplicates): `--font-sans` -> `var(--font-inter)`,
      `--font-display` and `--font-heading` -> `var(--font-cinzel)`, mono
      tokens unchanged. **Done when:** the running app renders Inter as body
      text everywhere and Cinzel on all `font-display`/`font-heading`
      surfaces (Today carousels, dialog titles, detail cards) in light and
      dark and in both Dawn and Sunset families; a repo search confirms no
      component or style references `--font-geist-sans` or hardcodes a
      `font-family` outside the token definitions.
- [x] 3. Tune the base heading styles in `globals.css` for Cinzel: adjust
      `letter-spacing`, `line-height`, and `font-weight` on the
      `h1`/`h2`/`h3` block and the `.game-theme-scope .game-detail-hero h1`
      override so headers neither clip nor track too tight; keep `.technical-label`
      and all mono styling untouched. **Done when:** page headers and hero
      headings across Today, Library, Wishlist, and game detail read cleanly
      in Cinzel at desktop and mobile widths, while evidence labels,
      freshness stamps, and timestamps still render in Geist Mono.
- [x] 4. Sweep the four direct consumers (`CurrentlyPlayingCarousel`,
      `FeaturedOffersCarousel`, `dialog.tsx`, `detail-card.tsx`, plus
      `AppNav` brand text) and fix only per-element weight/size/tracking
      where Cinzel overshoots; no structural or copy changes. **Done when:**
      a manual walkthrough of Today, a dialog, a detail page, and the nav
      shows no clipped, overlapping, or awkwardly weighted display text in
      light and dark across both families.
- [x] 5. Run the gates: `pnpm test`, `pnpm lint`, `pnpm build`; visually
      confirm both palette families in light, dark, and system modes on one
      primary route each. **Done when:** all three commands pass and no
      console font-loading errors appear during the walkthrough.

## Files and areas

- `src/app/layout.tsx` - font imports and CSS variable names
- `src/app/globals.css` - token re-point + heading base-style tuning
- At most per-element class tweaks in: `src/components/today/CurrentlyPlayingCarousel.tsx`,
  `src/components/today/FeaturedOffersCarousel.tsx`,
  `src/components/ui/dialog.tsx`, `src/components/ui/detail-card.tsx`,
  `src/app/(app)/_components/AppNav.tsx`

## Data and contracts

- Load-bearing: the **font token contract** - `--font-sans` = Inter (body),
  `--font-display` and `--font-heading` = Cinzel (headers/hero moments),
  `--font-technical` and `--font-mono` = Geist Mono (evidence, freshness,
  timestamps). All future surfaces must keep routing through these tokens
  rather than raw `font-family` values.
- The `next/font` variable names (`--font-inter`, `--font-cinzel`,
  `--font-geist-mono`) are the only place the faces are named; CSS and
  components never reference the font files directly.

## Testing

- Unit tests: none needed - no logic beyond font loading; existing tests must
  keep passing (`pnpm test`)
- Verification is visual per the done-whens (both families, light/dark/system,
  mobile and desktop widths) plus `pnpm lint` and `pnpm build` as gates

## Notes for the AI

- Cinzel is a variable font (weights 400-900, no italic) and Inter is
  variable; load them with `next/font/google` and `display: "swap"` exactly
  like the existing Geist setup - no `<link>` tags, no CSS `@import`.
- Do not re-map `--font-mono` or touch `.technical-label`, freshness stamps,
  or any evidence-label component - the monospace face is explicitly
  unchanged by the owner decision.
- Letter-spacing direction: Cinzel generally wants neutral-to-positive
  tracking (its caps are wide); do not port Geist's negative tracking onto
  it. Tune only what looks wrong, and prefer adjusting the shared base rules
  over per-component overrides.
- Both palette families and all four palettes must be spot-checked: font
  rendering is palette-independent, but this is the 20g acceptance baseline.

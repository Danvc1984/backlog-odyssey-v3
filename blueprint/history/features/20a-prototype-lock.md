# Feature 20a - Prototype lock

## Goal

Lock the visual foundation for the whole Odyssey theme expansion before any
application change: throwaway static mockups under `prototypes/` that validate
the four palettes (Dawn cyan/purple and Sunset orange/yellow, each in light and
dark) and the Cinzel (display) + Inter (body) pairing against real Today,
Library, Wishlist, and game-detail surfaces. The exact Sunset semantic-hue
mapping and the final font call are decided here, by the owner, looking at
realistic content - not abstract swatches.

This feature produces **no application code changes**. Everything lives in
`prototypes/` (throwaway, discarded at `/complete`). Its outputs are:

- `prototypes/theme.css` - the locked design tokens (four palettes + type scale)
- `prototypes/*.html` - static mockups of the four key surfaces
- A recorded owner decision: final palette mapping per family and confirmed
  Cinzel/Inter pairing (recorded in this spec's Build steps and carried into 20b)

## In scope

- `prototypes/theme.css` replicating the feature-14 token architecture
  (background/foreground/card/muted/border/ring + the semantic roles:
  interactive, deal/opportunity, warning, danger, destructive) with four
  palette variants driven by a root class (`dawn-light`, `dawn-dark`,
  `sunset-light`, `sunset-dark`)
- Family-owned semantic hue mapping: each family defines its own hue for
  interactive, deal, warning, danger; role *names* and usage stay identical
  across all four palettes
- Typography tokens: Cinzel for display/heading, Inter for body/sans,
  unchanged technical monospace (system monospace stack is fine in mockups)
- Four surface mockups with realistic content mirroring the real routes:
  Today (dashboard moments, recommendation cards, start-playing), Library
  (filters, game grid, state chips), Wishlist (price offers, target, purchase
  opportunities), and game detail (hero band, metadata, compatibility
  evidence labels in monospace)
- A small in-mockup palette switcher (class swap on `<html>`) so the owner can
  flip all four palettes and light/dark instantly
- Contrast validation of the semantic roles per palette (WCAG AA for text and
  interactive affordances on their backgrounds)
- A standalone `review.html` index linking every mockup and documenting the
  locked decisions

## Out of scope

- Any change to `src/` - no `globals.css` edit, no font install, no component
  work (that is 20b/20c)
- The Settings family selector (20b), voice sweep copy (20e), brand icons
  (20d), UI icon swap (20f)
- Per-game dynamic themes (feature 17) - mockups show only the global palette
- Wallhaven background integration in the mockups
- Responsive/behavioral fidelity - mockups are desktop-first with reasonable
  mobile behavior, but pixel-perfection is not the goal; token and type
  validation is

## Design reference

- `blueprint/context/project-overview.md` - "Themes, voice, and icons" section
  (families, semantic roles, typography pairing) and "Global visual foundation"
  (feature 14 token architecture)
- `src/app/globals.css` - the live `@theme inline` token names the mockups
  must mirror (same role names so 20b can port mechanically)
- No reference image needed: this feature *produces* the design reference
  (`prototypes/` becomes the source of truth for 20b-20g)

## Build steps

- [x] 1. Scaffold `prototypes/` with `theme.css`: replicate the feature-14
      token architecture under the four palette classes (Dawn light/dark first,
      with the existing app palette as the Dawn-light starting point), plus
      `--font-display: 'Cinzel'`, `--font-body: 'Inter'`, and an unchanged
      monospace technical token. Add a Google Fonts import for Cinzel + Inter.
      **Done when:** `theme.css` defines all four palette class blocks and the
      three font tokens; opening a bare HTML page with the class set shows
      background/foreground/text colors switch per class.
- [x] 2. Define each family's semantic hue mapping (interactive, deal,
      warning, danger, destructive) for all four palettes in `theme.css`, with
      foreground-on-color pairs for chips and buttons. **Done when:** every
      semantic role has a hue and a readable foreground pair in all four
      palettes, with roles keeping the same names everywhere.
- [x] 3. Build `today.html`: dashboard greeting moment, recommendation cards
      (play and buy roles with reasons and caveats), start-playing affordance,
      and in-progress section - using display font for the greeting/headers and
      body font everywhere else. **Done when:** the mockup renders fully
      against Dawn light and reads correctly after switching to each of the
      other three palettes via the switcher.
- [x] 4. Build `library.html`: filter row (Not started / In progress / Played
      before buttons + More filters), game grid with state chips and source
      badges, and a card in each of the four states. **Done when:** the mockup
      renders fully and state chips use the semantic roles consistently across
      all four palettes.
- [x] 5. Build `wishlist.html`: a wish entry with price offers, target price,
      a purchase-opportunity highlight (deal role), and a wishlist table row.
      **Done when:** the mockup renders fully across all four palettes with
      the deal role visibly correct on the opportunity highlight.
- [x] 6. Build `detail.html`: game hero band (neutral, not per-game themed),
      metadata block, compatibility evidence labels in monospace, and a DLC
      section. **Done when:** the mockup renders fully across all four
      palettes with evidence labels in the monospace technical token.
- [x] 7. Build `review.html`: an index that links all mockups, embeds a
      side-by-side swatch strip of the four palettes, and lets the switcher
      propagate. Run a contrast pass over the semantic roles (WCAG AA for text
      and interactive elements; note any failing pair and fix the hue in
      `theme.css`). **Done when:** every mockup is reachable from
      `review.html`, and every semantic role in all four palettes passes AA or
      has an explicitly recorded justification.
- [x] 8. Owner review gate: walk the owner through all four surfaces in all
      four palettes; capture the final call on (a) the Sunset family's exact
      semantic mapping and (b) the Cinzel/Inter pairing (keep or adjust).
      Record the locked decisions in `review.html` and tick this step only
      after the owner confirms. **Done when:** the owner has confirmed the
      palette mapping and font pairing, and the decisions are written down for
      20b to port.

  **Locked decisions, owner confirmed 07 Sep 2026:** Sunset uses orange for
  interactive, gold for deal/opportunity, yellow/ochre for warning, and coral
  for danger/destructive. Cinzel is the display/heading face, Inter is the
  body/sans face, and the technical monospace remains unchanged.


## Files and areas

- New: `prototypes/theme.css`, `prototypes/today.html`,
  `prototypes/library.html`, `prototypes/wishlist.html`,
  `prototypes/detail.html`, `prototypes/review.html`
- Not touched: anything under `src/`, `blueprint/` plans (except this spec)

## Data and contracts

No app data. One load-bearing contract for later features: **the token names in
`prototypes/theme.css` must match the feature-14 `@theme inline` role names**
(`--color-*`, `--font-*`) so 20b ports the file mechanically instead of
remapping. `theme.css` is the source of truth from step 2 onward.

## Testing

No unit tests - no application logic exists. Verification is visual: open
`prototypes/review.html` in a browser, flip all four palettes, and confirm
each surface renders correctly (per-step done-whens). The contrast pass in
step 7 is the only measurable gate (WCAG AA).

## Notes for the AI

- Static HTML/CSS only - no build step, no framework, no JavaScript beyond a
  trivial palette-class switcher if needed (a `<select>` writing
  `document.documentElement.className` is enough).
- Mockups are throwaway: never import from `src/`, never edit app code to make
  a mockup work.
- Mirror the real app's content structure (feature-14 Today composition,
  library filters, wishlist offers) closely enough that the owner is judging
  the real surfaces, not wireframes.
- Keep statuses, errors, evidence labels, and caveats factual in mockup copy -
  the voice sweep is 20e, not here.
- The existing app palette (feature 14) is the seed for Dawn light; Dawn dark,
  Sunset light, and Sunset dark are derived in this feature.

# Feature: Game-detail theme application

**From build-plan:** 17b
**Status:** complete

## Goal

Apply the feature-17 derived palette to the catalog game detail page: a
hero band with an artwork-derived wash plus palette-colored accents/actions
and a palette-colored game title. Dark themed detail cards use that palette
color for inherited foreground text except the danger card. Detail surfaces
retain their existing backgrounds. Global semantic tokens stay untouched, and pages without a
palette render exactly as today.

## Design reference

No mockup exists (`prototypes/` was discarded after feature 14, and 19a
owns the next prototype round). The visual target is defined by the plan
rules in project-plan.md section 13: hero band plus decorative tints only,
semantic meanings preserved, contrast overlays, deterministic fallback.
If a concrete visual reference is wanted first, run `/prototype` before
`/implement`; otherwise build within the existing token system.

## In scope

- `src/lib/game-theme.ts`: a palette guard for v1/v2/v3 payload rows and a
  CSS-variable mapper, both pure and unit-tested
- `GameThemeScope`: a client component that sets the per-game CSS variables
  and clears them under reduced-data mode
- Hero band treatment on `GameDetailHero`: palette-derived gradient wash and
  accent border, keeping the existing artwork/gradient/token behavior of
  `DetailHeroArt` unchanged
- Decorative tints on `SectionCard` and `StatusPill` (eyebrow marker, card
  top border, pill border) consumed via CSS variables with global fallbacks
- Wiring on the game detail page: read the snapshot payload, resolve the
  palette, wrap the page content in the scope

## Out of scope

- The screenshots section (17c) and wishlist detail surfaces (17d)
- Any new provider calls or enrichment changes
- Per-game theming on any other route
- Text color changes, semantic token changes, or Wallhaven interaction
- Changes to `DetailHeroArt` resolution logic (artwork/gradient/token stays)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Theme helpers** - create `src/lib/game-theme.ts` with
  `resolvePagePalette(payload: unknown): RawgPalette | null` (returns the
  palette only when all three fields are present hex strings; anything else,
  including v1/v2 rows, returns null) and `paletteToCssVars(palette:
  RawgPalette): Record<string, string>` mapping to `--game-accent`,
  `--game-accent-dark`, `--game-accent-muted`. Ship `game-theme.test.ts`.
  *Done when:* tests cover a valid palette, a v2-shaped row without the key,
  a malformed palette (missing field, non-hex value), and the exact variable
  names emitted; typecheck green.

- [x] **Step 2 - Theme scope component** - create
  `src/components/games/GameThemeScope.tsx`: a client component using
  `useVisualPreferences()` that renders a wrapper div carrying the CSS
  variables when a palette exists and reduced-data is off, and a plain div
  otherwise. Wire it into `/games/[id]`: resolve the palette from
  `rawgPayload` and wrap the page content.
  *Done when:* with `pnpm dev`, a re-enriched (v3) game shows the three
  `--game-accent*` variables on the wrapper in the DOM inspector; toggling
  reduced-data in Settings removes them live; a v2-row game shows none; the
  page looks unchanged.

- [x] **Step 3 - Hero band treatment** - `GameDetailHero` accepts the
  resolved palette (through the scope variables, not a new prop chain) and
  gains scoped CSS classes in `globals.css`: a subtle gradient wash behind
  the text column using `color-mix` on `--game-accent-dark`/`--game-accent`
  over `var(--card)`, and an accent-tinted top border. All rules use
  `var(--game-accent*, <global token>)` fallbacks so pages without a palette
  are pixel-identical.
  *Done when:* screenshots in dark and light show a tinted hero on a themed
  game and an identical hero on an un-themed game; the wash never reduces
  text contrast below the current levels.

- [x] **Step 4 - Decorative tints** - extend `SectionCard` and `StatusPill`
  within the scope: a low-mix accent tint on the card top border and a tinted
  pill border, while detail card backgrounds remain unchanged, all with
  global fallbacks.
  *Done when:* screenshots in dark and light show the tints on a themed
  game; un-themed pages are unchanged; semantic colors (cyan interactive,
  magenta deal, amber warning) are visibly untouched.

- [x] **Step 5 - Acceptance** - run `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. Walk the game detail page for a themed v3 game and a v2-row
  game in dark, light, and system modes, with reduced-data on and off, and
  with the Wallhaven background enabled.
  *Done when:* the theme appears only when a palette exists and reduced-data
  is off; the v2-row page is visually identical to pre-feature rendering;
  checks are green.

## Files / areas

- `src/lib/game-theme.ts` (new) + `src/lib/game-theme.test.ts`
- `src/components/games/GameThemeScope.tsx` (new)
- `src/app/(app)/games/[id]/page.tsx` - palette resolution and scope wiring
- `src/components/games/GameDetailHero.tsx` - hero band classes
- `src/components/ui/detail-card.tsx` - SectionCard/StatusPill tints
- `src/app/globals.css` - scoped theme classes consuming the variables

## Data / contracts

Load-bearing for 17c/17d - lock now:

- CSS variable names: `--game-accent`, `--game-accent-dark`,
  `--game-accent-muted` (hex values from `RawgPalette`)
- `GameThemeScope` props: `{ palette: RawgPalette | null; children:
  ReactNode }` - 17c renders the screenshots section inside this scope and
  17d reuses the component on `/wishlist/[id]`
- `resolvePagePalette` accepts `unknown` and validates structurally, so
  v1/v2 payload rows (which lack the key) resolve to null without casts
- The palette never sets text color: solid card backgrounds and decorative
  accent/action token overrides are scoped to the themed game detail page

## Testing

- Vitest covers the two pure helpers (guard validation, variable mapping)
- Everything else is UI: per-step screenshot evidence in dark and light plus
  the build; the reduced-data behavior is verified live through the Settings
  toggle
- No new server actions or parsers beyond the two helpers

## Notes for the AI

- The one allowed inline style in this feature is the CSS-variable map on
  the `GameThemeScope` wrapper: dynamic theme values cannot be static
  classes, and SSR-rendered variables avoid a flash of unthemed content.
  Everything else stays in Tailwind classes or `globals.css`.
- `GameThemeScope` is a client component (it reads
  `useVisualPreferences()`); the page stays a server component and passes
  resolved data down.
- `color-mix(in oklab, ...)` is the mixing tool; percentages may need
  separate tuning for dark and light modes - put both in the scoped classes.
- Do not override semantic tokens anywhere: the variables are additive and
  every consumer falls back to the global token.
- Follow the existing payload-guard style on the page (`Array.isArray`
  checks); `resolvePagePalette` replaces ad-hoc palette access.
- Single-user app: no per-user scoping. Keep `server-only` boundaries: no
  palette logic moves into client files except through rendered values.

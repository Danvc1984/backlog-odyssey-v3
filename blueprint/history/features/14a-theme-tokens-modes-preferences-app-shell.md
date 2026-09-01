# Feature: Theme tokens, modes, preferences, and app shell

**From build-plan:** feature 14a
**Status:** not started

## Goal

Port the prototype-validated token system into the app, deliver dark/light/system
modes with the same visual hierarchy (not an inversion), add non-migrating
reduced-motion and reduced-data preferences, and restyle the app shell. After
this feature the whole app inherits the new look through tokens, and features
14b-14e compose against a locked visual contract.

## Design reference

- `prototypes/theme.css` - source of truth for colors, radii, shadows, spacing,
  and the display/technical type roles. Port the values into the app's token
  contract; do not copy prototype class CSS component-by-component.
- `prototypes/today.html`, `library.html`, `wishlist.html`, `game-detail.html` -
  shell structure (sidebar brand mark, nav treatment, main content width).
- The prototypes are throwaway and are discarded at `/complete`. The app's
  `globals.css` becomes the token source of truth once this feature ships.

## In scope

- Re-theme the existing shadcn semantic tokens (`--background`, `--card`,
  `--primary`, `--sidebar-*`, etc.) to the prototype palette for dark and
  define a non-inverted light palette.
- Add the product-semantic accent tokens: signal (interactive/progress/ready),
  opportunity (deals/Buy), warning (stale/mixed), success, danger, plus
  text-contrast variants, display/technical font roles, and card/glow shadows.
- Dark, light, and system modes via `next-themes` (already a dependency),
  defaulting to system, with no flash on reload.
- Reduced-motion and reduced-data preferences: client-stored, non-migrating
  (localStorage + html data attributes, no schema change), defaulting from
  system preference where one exists.
- An Appearance section on Settings with only three controls: theme, reduced
  motion, reduced data.
- Typography base (display headers with tight tracking, technical mono labels)
  and the shell: desktop sidebar, mobile bottom navigation, main content width.
- Shared primitives: Button variants and Card styling. Inputs/selects inherit
  the new look through tokens and are only verified, not redesigned.

## Out of scope

- Today dashboard redesign (14b), Library/Wishlist surfaces (14c), detail and
  collection routes (14d), and the route-by-route acceptance pass plus finishing
  Settings controls (14e).
- Carousels, play-next layout, and any new interactive surfaces (14b).
- Any schema migration, provider call, queue, job, recommendation, or price
  behavior change. This feature is CSS + client preferences only.
- Broader Settings and personal-data export (17).
- Remote artwork handling under reduced data: the attribute contract ships now,
  consumers arrive in 14c/14d.
- Landing page `/`, `/error`, and auth screens: they inherit tokens
  automatically; their review belongs to 14e.
- Wallhaven (15) and per-game dynamic palettes (16).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Token foundation in `globals.css`** - Re-theme the shadcn
      token blocks with the prototype palette (dark) and the pinned light
      palette (table below), add the accent/semantic tokens, font-role
      mappings (`--font-display`, `--font-technical` onto the already-loaded
      Geist Sans/Mono), `shadow-card`/`shadow-glow`, `color-scheme` per mode,
      base typography (h1-h3 tracking/scale), and the `.technical-label`
      utility class. No component changes. *Done when:* with no `dark` class
      the app renders the new light palette; adding `dark` to `<html>` in
      devtools renders the prototype dark look; `pnpm build` and `pnpm test`
      pass.
- [x] **Step 2 - Mode switching and the theme control** - Mount
      `next-themes` `ThemeProvider` in the root layout (`attribute="class"`,
      `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`),
      add `suppressHydrationWarning` to `<html>`, and add an Appearance
      section on `/settings` with a System/Light/Dark control. *Done when:*
      picking a mode applies immediately, persists across reload and
      navigation, System tracks the OS setting, there is no flash of the wrong
      mode on reload, and the sonner toaster follows the active mode.
- [x] **Step 3 - Reduced motion and reduced data preferences** - Add a
      `VisualPreferencesProvider` (client) storing two values in localStorage,
      an inline pre-paint script that applies them before first render, html
      `data-motion` / `data-reduced-data` attributes, a `useVisualPreferences`
      hook, the CSS reduce block keyed to system media query plus manual
      override, and the two Appearance controls. Unit-test the pure
      normalize/apply logic.       *Done when:* selecting an override shows the
      matching attribute on `<html>`, survives reload, invalid or missing
      localStorage values fall back to system defaults, a devtools check under
      Reduced shows a test element's computed `animation-duration`/`transition-duration`
      forced near zero while the attribute is present, and the new unit tests
      pass.
- [x] **Step 4 - App shell restyle** - Restyle the desktop sidebar (brand
      mark, token-based nav with visible active states, email + sign-out
      footer) and mobile bottom navigation in `AppNav.tsx`, and give main
      content the prototype's max-width and padding. Same routes, same
      sign-out, same lucide icons; styling only. *Done when:* the shell reads
      as the prototype's structure in both dark and light on desktop and
      mobile widths, all five nav routes work, active state is visible, and
      auth-gated behavior is unchanged.
- [x] **Step 5 - Buttons, cards, and shared surfaces** - Re-theme `Button`
      variants (primary = signal fill with on-signal text and glow; secondary,
      outline, ghost, destructive per tokens) and `Card` (radius, border,
      shadow). Verify inputs/selects/toasts inherited the tokens with no
      component edits; fix only if something renders off-token. *Done when:*
      primary actions are teal with dark text and the glow in both modes,
      cards show the new radius/shadow/border, focus rings are visible on
      keyboard focus in both modes, and `pnpm build` + `pnpm test` pass.

## Files / areas

- `src/app/globals.css` - token blocks, typography base, reduce block, `.technical-label`.
- `src/app/layout.tsx` - ThemeProvider, suppressHydrationWarning, pre-paint script.
- `src/components/preferences/VisualPreferencesProvider.tsx` (new) - provider + hook.
- `src/lib/visual-preferences.ts` (new) - pure normalize/apply logic (unit-tested).
- `src/lib/visual-preferences.test.ts` (new) - Vitest, node environment.
- `src/app/(app)/settings/page.tsx` plus a new `AppearanceSection` client component.
- `src/app/(app)/_components/AppNav.tsx` - shell restyle.
- `src/app/(app)/layout.tsx` - main content width/padding only.
- `src/components/ui/button.tsx`, `src/components/ui/card.tsx` - primitive re-theme.

## Data / contracts

No schema, API, or provider changes. These client contracts are
**load-bearing for 14b-14e** and must not drift:

| Contract | Value | Consumer |
| --- | --- | --- |
| Theme mode | `next-themes`, class strategy, localStorage key `theme` | whole app, toaster |
| Motion attribute | `<html data-motion="reduced">` or `"full"`, absent = system | 14b carousel auto-advance |
| Reduced-data attribute | `<html data-reduced-data="on">` or `"off"`, absent = system | 14c/14d art fallbacks |
| localStorage keys | `backlog-odyssey:motion`, `backlog-odyssey:data` | preferences only |
| Hook | `useVisualPreferences(): { motion, data, setMotion, setData }` | client logic |
| Color utilities | `signal`, `signal-strong`, `signal-text`, `opportunity`, `opportunity-text`, `warning`, `warning-text`, `success`, `danger`, `border-strong` | 14b-14d surfaces |
| Type utilities | `font-display`, `font-technical`, `.technical-label` | labels/evidence/freshness |
| Shadows | `shadow-card`, `shadow-glow` | cards, primary actions |

Token mapping (dark from `prototypes/theme.css`; light palette is pinned here
because the prototype defines only dark - the reviewer can adjust light hexes
at this gate without structural change):

| Token role | Dark | Light |
| --- | --- | --- |
| page / background | carbon `#101217` | warm off-white `#f6f4ef` |
| card / popover | raised `#171a22` | white `#ffffff` |
| card-alt / secondary | `#1c202a` | blue-gray `#e9ecef` |
| sidebar | `#0c1017` | `#efede6` |
| input surface | `#0d131c` | `#ffffff` |
| text primary / foreground | ink `#e7edf0` | navy-carbon `#16202b` |
| text secondary / muted-foreground | `#9ba8b2` | `#4e5c68` |
| text faint | `#65717b` | `#7d8a94` |
| border / line | `#2a333d` | `#d9dfe4` |
| border-strong | `#40505d` | `#b9c2c9` |
| primary (signal fill) | `#16d6c1` | `#16d6c1` |
| on-signal text | `#06201d` | `#06201d` |
| signal-strong / signal-text | `#45f2dd` | `#0c8577` |
| opportunity fill / text | `#ee4d9b` / `#ff8ac0` | `#ee4d9b` / `#c22575` |
| warning fill / text | `#f2b45d` | `#f2b45d` / `#9a6208` |
| success | `#72e19a` | `#1f8a4d` |
| danger / destructive | `#ff7f88` | `#d43f4a` |
| ring / focus | signal | signal |
| hero/gradient art surfaces (midnight, spotlight, detail-art) | prototype dark gradients | unchanged dark gradients with light ink |

Font decision: keep the already-loaded Geist Sans/Geist Mono. The prototype
lists Avenir Next/Inter and IBM Plex Mono; Geist fills the same display and
technical roles without new font payloads. Display = Geist Sans with the
prototype's tight tracking scale; technical = Geist Mono at 10-11px uppercase
wide-tracked labels.

## Testing

Vitest gate is on, so the logic-bearing step ships tests:

- `src/lib/visual-preferences.test.ts` - normalize/apply logic: accepted
  values pass through, invalid/corrupt/missing values fall back to system
  defaults, the attribute map is correct for each combination, and the
  system-fallback path respects the media query flags the provider passes in.
- Mode switching, shell, buttons/cards are UI: verified with `pnpm build`
  plus live dev-server evidence in dark and light (devtools attribute checks
  for step 3, screenshots for steps 4-5).
- Final gate: `pnpm build` and `pnpm test` (no `Verify` command is declared;
  `pnpm lint` and `pnpm typecheck` are available and should stay green).

## Notes for the AI

- Server components by default; only the provider, Appearance controls, and
  nav are client. This feature needs no Server Actions at all.
- Single-user app: no per-user query scoping applies; nothing here touches Prisma.
- Never trust stored preferences blindly: parse and normalize localStorage
  values before applying; unknown values mean system default.
- The pre-paint script must run before first paint (inline in the root
  layout) or dark-mode users get a light flash; pair with
  `suppressHydrationWarning` on `<html>`.
- Scope the reduced-motion CSS to the standard duration/iteration reduction
  pattern, not a blanket `* { all: none }`; shadcn menus and the toaster rely
  on transitions still functioning.
- Do not port prototype classes wholesale; port values into the token
  contract and let existing Tailwind/shadcn components resolve them.
- Respect the writing standard: no em dashes anywhere in code, comments, or docs.

# Feature 20b - Family tokens and selector

## Goal

Introduce the two palette families - Dawn (cyan/teal-purple, the existing
feature-14 palette) and Sunset (orange/yellow) - each in light and dark, over
the current token architecture, and let the owner pick a family in Settings
beside the existing light/dark/system control. System mode keeps resolving
light/dark within the selected family. The four palettes were validated in the
20a prototype; the locked decisions from
`blueprint/history/features/20a-prototype-lock.md` drive the Sunset hues.

Approach: families are **hue layers**. Neutrals (background, foreground, card,
muted, border, sidebar surfaces) stay shared across families; every
hue-bearing token (interactive cluster, deal, warning, danger, destructive,
success, chart hues, sidebar accents, glow) is overridden per family. Dawn
light/dark remain the un-scoped defaults (`:root` / `.dark`); Sunset is a
`data-family="sunset"` override on `<html>`, so Dawn needs zero new CSS.

Family selection follows the existing visual-preferences pattern
(localStorage + pre-paint script + provider), the same way motion/data
preferences work and the same way next-themes stores the light/dark mode.
No database, AppSettings, or export/import change - this is a client device
preference like theme mode, not account data.

## In scope

- Sunset light hue overrides (`[data-family="sunset"]`) and Sunset dark hue
  overrides (`[data-family="sunset"].dark`) in `src/app/globals.css`, using
  the 20a locked mapping: orange interactive, gold deal/opportunity,
  yellow/ochre warning, coral danger/destructive
- Family preference primitives in `src/lib/visual-preferences.ts`:
  `FAMILY_STORAGE_KEY`, `FAMILY_ATTRIBUTE`, `ThemeFamily` type
  (`"dawn" | "sunset"`), `normalizeFamily`, and extending
  `applyVisualAttributes` for the family attribute (Dawn = attribute absent)
- Pre-paint script update in `src/app/layout.tsx` so the family attribute is
  set before first paint (no flash of Dawn for Sunset users)
- `VisualPreferencesProvider` exposure of `family` / `setFamily`
- Settings family selector in `AppearanceSection` - segmented control beside
  the Theme mode control, same interaction pattern (optimistic set, label
  "Dawn" / "Sunset", hydration-safe placeholder like the existing controls)
- Contrast validation of the new Sunset hue pairs against AA for text and
  interactive affordances, recorded in the spec or code comment reference
- Unit tests extending `src/lib/visual-preferences.test.ts` for the family
  primitives

## Out of scope

- Typography (Cinzel/Inter port) - feature 20c
- Brand icons, voice sweep, UI icon swap, cross-app acceptance - 20d/20e/20f/20g
- Database persistence, export/import schema - the family is device-local
  like theme mode; revisit only if the owner asks
- Any per-game theme (feature 17) change - those read semantic tokens and stay
  correct automatically
- Changing Dawn's existing hue values at all

## Design reference

- `blueprint/history/features/20a-prototype-lock.md` - locked decisions
  (owner-confirmed 07 Sep 2026): Sunset = orange interactive, gold
  deal/opportunity, yellow/ochre warning, coral danger/destructive; Dawn is
  the existing app palette
- `src/app/globals.css` - token architecture to extend (`@theme inline` role
  names stay unchanged; families only re-point the raw `--*` variables)
- The prototypes were throwaway and discarded at 20a completion; the archived
  decisions above are the source of truth

## Build steps

- [x] 1. Add the Sunset light block to `src/app/globals.css`:
      `[data-family="sunset"] { ... }` overriding the hue-bearing variables
      (`--primary`, `--primary-foreground`, `--ring`, `--signal`,
      `--signal-strong`, `--signal-text`, `--opportunity`,
      `--opportunity-text`, `--warning`, `--warning-text`, `--success`,
      `--danger`, `--destructive`, `--chart-1`..`--chart-5`,
      `--sidebar-primary`, `--sidebar-ring`, `--shadow-glow`) with the locked
      Sunset light hues; leave all neutral variables untouched.
      **Done when:** with `data-family="sunset"` manually set in devtools,
      the running app shows Sunset light hues (orange interactive, gold deal)
      while layout and neutrals are unchanged, and `:root` Dawn is untouched.
- [x] 2. Add the Sunset dark block: `[data-family="sunset"].dark { ... }`
      with the dark-mode counterparts (brighter hues for dark backgrounds,
      following the Dawn dark adjustment pattern). **Done when:** with
      `data-family="sunset"` plus `.dark` set, the app shows Sunset dark
      hues; Dawn dark still renders exactly as before with no attribute.
- [x] 3. Extend `src/lib/visual-preferences.ts`: `FAMILY_STORAGE_KEY`
      (`"backlog-odyssey:family"`), `FAMILY_ATTRIBUTE` (`data-family`),
      `ThemeFamily`, `normalizeFamily` (anything unknown -> `"dawn"`), and
      extend `applyVisualAttributes` to set/remove the family attribute
      (Dawn removes it, Sunset sets it). Extend
      `src/lib/visual-preferences.test.ts`. **Done when:** `pnpm test` passes
      with new coverage for normalize + attribute application.
- [x] 4. Wire persistence: extend the `prePaintVisualPreferences` inline
      script in `src/app/layout.tsx` to apply `data-family` from localStorage
      before paint, and extend `VisualPreferencesProvider` to load, normalize,
      persist, and expose `family` / `setFamily` alongside motion/data.
      **Done when:** reloading the app with `sunset` stored shows the Sunset
      palette from first paint (no Dawn flash), and clearing storage falls
      back to Dawn.
- [x] 5. Add the family selector to `AppearanceSection`: a `SettingRow`
      titled "Palette family" placed directly after the Theme row, using the
      existing `SegmentedControl` (Dawn / Sunset), hydration-safe like the
      neighboring controls, and calling `setFamily`. **Done when:** in the
      running app, Settings shows the selector beside the mode control;
      switching updates every hue-bearing surface immediately, survives
      reload, and combines correctly with light/dark/system mode changes.
- [x] 6. Contrast pass: verify the Sunset semantic pairs
      (signal/opportunity/warning/danger text-on-background and
      foreground-on-color) meet WCAG AA in both light and dark; adjust hue
      values in `globals.css` where a pair fails and re-verify. **Done when:**
      every Sunset pair passes AA or has a recorded justification, and
      `pnpm build` succeeds.

  **Contrast verification (recorded 07 Sep 2026):** computed WCAG ratios for
  the shipped Sunset hues — light: primary `#c2410c` on page bg 4.71 / on card
  5.18, primary-foreground `#fff4ec` on primary 4.78, opportunity `#b45309` on
  bg 4.57, warning `#9c6208` on bg 4.59, danger/destructive `#c93b2e` on bg
  4.61; dark: primary `#ff9330` on bg 8.45 / on card 7.84, primary-foreground
  `#241106` on primary 8.18, signal-strong `#ffb45e` on card 9.89,
  opportunity-text `#ffcf3d` on card 11.80, warning `#f5b23d` on card 9.37,
  danger `#ff7f68` on bg 7.57. All text and foreground-on-color pairs ≥ 4.5:1.
  Non-text justification: light `--sidebar-ring` `#e8622c` on the light sidebar
  is 2.88:1 (below the 3:1 non-text target) by design — it follows the
  inherited Dawn bright-accent pattern (Dawn's own light sidebar ring `#16d6c1`
  is 1.57:1) and acts as a supplementary focus ring, not the sole indicator.

## Files and areas

- `src/app/globals.css` - two new family blocks, nothing else moved
- `src/lib/visual-preferences.ts` + `src/lib/visual-preferences.test.ts`
- `src/app/layout.tsx` - pre-paint script extension only
- `src/components/preferences/VisualPreferencesProvider.tsx` - family exposure
- `src/components/settings/AppearanceSection.tsx` - one new SettingRow

## Data and contracts

- Load-bearing: the **family attribute contract** - `data-family` on
  `<html>`, values `dawn` (absent/default) and `sunset`; storage key
  `backlog-odyssey:family`. 20g's acceptance sweep and any future family rely
  on this shape.
- Load-bearing: the **hue-layer rule** - families override hue-bearing tokens
  only; neutrals stay shared. Future palettes follow the same rule.
- The `@theme inline` role names do not change, so components and the
  feature-17 theme scopes need no edits.

## Testing

- Unit (gate applies): `normalizeFamily` and the extended
  `applyVisualAttributes` in `src/lib/visual-preferences.test.ts`
- Visual/manual: per-step done-whens in the running app (family switch,
  persistence, mode combinations, no Dawn flash on reload)
- `pnpm build` as the integration gate

## Notes for the AI

- Follow the motion/data preference pattern exactly - same provider, same
  pre-paint script shape, same hydration-safe control behavior. Do not add a
  second preference mechanism and do not fold the family into next-themes.
- CSS specificity: `@custom-variant dark` marks `.dark *` descendants; the
  dark block selector must be `[data-family="sunset"].dark` (both classes on
  `<html>`), matching how the existing `.dark` block is scoped.
- Do not touch Dawn values, `@theme inline` mappings, or any component class.
  If a surface looks wrong in Sunset, it is a hue value problem, not a
  component problem.
- `--font-*` tokens are feature 20c; leave typography alone.

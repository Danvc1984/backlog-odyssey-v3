# Feature: Cross-app acceptance

**From build-plan:** feature 20g
**Status:** not started

## Goal

Prove the four shipped palettes (Dawn light, Dawn dark, Sunset light, Sunset
dark) across every primary route on desktop and mobile, in light, dark, and
system modes, with keyboard, focus, contrast, reduced-motion, and reduced-data
review. Close the gap with small presentational fixes where the families drift,
record the evidence, and gate feature 20 as done before 21.

This is an acceptance pass over shipped work (20a through 20f). It is not a
redesign: product rules, queries, actions, schemas, recommendation ranking, and
price behavior stay untouched.

## Design reference

- `blueprint/history/features/20a-prototype-lock.md` - locked direction
  (Sunset mapping and Cinzel/Inter pairing, owner-confirmed 07 Sep 2026)
- `blueprint/history/features/20b-family-tokens-and-selector.md` - family
  attribute contract and the recorded Sunset contrast table
- `src/app/globals.css` - `:root`/`.dark` Dawn blocks and
  `[data-family="sunset"]` / `[data-family="sunset"].dark` overrides

The prototypes were throwaway and discarded; the shipped app plus the locked
decisions above are the reference.

## In scope

- A structured acceptance walkthrough of every primary route:
  `/`, `/welcome`, `/today`, `/library`, `/games/[id]`, `/wishlist`,
  `/wishlist/[id]`, `/collections`, `/collections/[id]`, `/settings`
- Matrix: 4 palette-mode combinations x 2 viewports (desktop and 390x844
  mobile), plus system mode resolving light/dark within the selected family
- Keyboard, focus-visible, and target-size review per route per palette
- Contrast verification of hue-bearing text and affordances per palette,
  recorded as a ledger in this spec
- Reduced-motion and reduced-data review across both families
- Small in-scope fixes found during the pass: token/CSS value adjustments,
  focus/ARIA attributes, overflow or target-size corrections, per-family hue
  reconciliation within the locked mapping

## Out of scope

- Any change to product rules, data model, server actions, queries, provider
  boundaries, recommendation ranking, or price behavior
- Re-litigating the full 14f state review (loading/empty/error/stale/operation
  states are spot-checked only where hue-bearing surfaces meet a palette)
- New palette families, new icons, new copy (20b/20d/20e shipped; the general
  UI icon swap decision is 20f's, already closed)
- Feature 21 deployment work; automated browser testing (this project keeps no
  E2E runner by standing decision)
- Anything larger than a presentational fix: those become `/fix` items and are
  recorded as leftovers, not absorbed here

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step. Browser walkthroughs are owner-driven
   manual passes against `pnpm dev` (http://localhost:3500); the AI guides the
   route list, applies fixes, and records results in the Acceptance log below.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Route walkthrough checklist

Apply to every route in every sweep. Record pass/fail per route in the
Acceptance log; fix or log anything that fails.

1. **Surfaces and hue roles** - interactive, deal/opportunity, warning,
   danger, and success hues read as the active family's mapping; neutrals are
   unchanged across families; no Dawn bleed into Sunset or the reverse.
2. **Keyboard and focus** - every interactive element is reachable in order,
   shows a visible focus state (family-owned `--ring`), dialogs trap and
   escape correctly, carousels (Today, screenshots) are keyboard-operable,
   nothing is focus-trapped or skipped.
3. **Contrast** - hue-bearing text (badges, prices, deal and warning labels,
   ProtonDB tag states, caveats) is readable at AA; the page passes a visual
   scan and anything doubtful goes to the contrast ledger step.
4. **Layout** - desktop: no clipped or stacked-broken sections. Mobile
   390x844: no horizontal overflow, bottom navigation intact, header actions
   wrap sanely, carousels usable with touch targets large enough.
5. **Per-game themes (detail routes only)** - hero band, accent tints, and
   screenshots still compose with the active family; contrast overlays hold
   over artwork; games without artwork show the deterministic fallback.
6. **Hue-bearing state spot-check** - one stale or error or operation surface
   per route family (e.g. freshness chips on Today, enrichment panel on
   Library, queue progress in Settings) renders correctly in the palette.

Representative records for detail routes:

- `/games/[id]`: (a) the main game with an enriched v3 snapshot, (b) a game
  without artwork (fallback path), (c) a ROM-only game (no compatibility UI)
- `/wishlist/[id]`: (a) a base wish with snapshot and offers, (b) a wish
  without a snapshot, (c) a DLC wish if one exists
- `/collections/[id]`: a collection with members; the empty state if easy

Reaching `/welcome`: the route redirects to `/today` while
`AppSettings.onboardingCompleted` is true (src/app/welcome/page.tsx:12), and
with the flag false every app route redirects to `/welcome`. So review it as a
dedicated sub-check at the **end** of each family's desktop sweep: temporarily
set `onboardingCompleted=false` (Prisma Studio or SQL on the dev DB), walk
light, dark, and system, then restore the flag by completing the onboarding
form (the real flow) rather than editing the DB back. Mobile sweeps do one
mode spot-check of `/welcome`. `/` is reached logged out.

System-mode check per family: set mode to System in Settings, flip the OS
appearance, and confirm light/dark resolve within the selected family with no
cross-family flash and no Dawn flash on reload for Sunset.

## Build steps

- [x] **Step 1 - Automated baseline** - run `pnpm lint`, `pnpm typecheck`,
      `pnpm test`, and `pnpm build`; record all four results in the Acceptance
      log; start `pnpm dev`. Fix nothing here unless a shipped-work failure
      blocks the pass (then note it as a finding first). *Done when:* all four
      commands are green with results recorded, and the dev server responds on
      port 3500.
- [x] **Step 2 - Dawn desktop sweep** - walk every primary route at desktop in
      Dawn light, then Dawn dark, then Dawn system, applying the checklist.
      Apply small fixes found (token values, focus/ARIA, overflow) with a
      re-verify after each. Finish with the `/welcome` sub-check. *Done when:*
      the Acceptance log has a recorded result for every route x mode cell,
      system resolves within Dawn, and every fix has a shown diff plus
      re-verification.
- [x] **Step 3 - Dawn mobile sweep** - same matrix at 390x844: overflow,
      bottom navigation, targets, carousels, dialogs. Same fix-and-reverify
      loop. *Done when:* every route x mode cell recorded for Dawn mobile with
      no unresolved layout or target failures.
- [x] **Step 4 - Sunset desktop sweep** - the Step 2 matrix with
      `data-family="sunset"` (switch via the Settings family selector),
      confirming per-game tint overlays and all hue roles read as Sunset. Same
      fix-and-reverify loop, including system resolving within Sunset and the
      `/welcome` sub-check. *Done when:* every route x mode cell recorded for
      Sunset desktop.
- [x] **Step 5 - Sunset mobile sweep** - the Step 3 matrix under Sunset. *Done
      when:* every route x mode cell recorded for Sunset mobile.
- [x] **Step 6 - Reduced-motion and reduced-data pass** - with reduced motion
      on: Today carousels and the screenshots carousel are manual, no
      auto-advance anywhere. With reduced data on: Wallhaven background hard
      off, screenshots show the token fallback, per-game themes use abstract
      fallbacks. Also set both preferences to System and confirm each mirrors
      the OS setting (visual-preferences "system" resolution). Check both
      families at desktop plus one mobile spot-check. *Done when:* both
      reduced modes and their System resolution are recorded for Dawn and
      Sunset with the expected behaviors observed.
- [x] **Step 7 - Contrast ledger** - compile computed WCAG ratios for every
      hue-bearing text pair and doubtful affordance flagged during the sweeps,
      per palette, light and dark. Sunset inherits the 20b recorded semantic
      table; Dawn has no durable recorded baseline, so record its core
      semantic pairs (primary, signal, opportunity, warning, danger text and
      foreground-on-color) here alongside any newly flagged pairs. Adjust hue
      values within the locked family mapping where a pair fails and
      re-verify in the app. *Done when:* every recorded pair passes AA (4.5:1
      text) or 3:1 (non-text) or carries a written justification, and the
      ledger section below is filled in.
- [x] **Step 8 - Acceptance summary and re-run** - complete the summary table,
      list any leftovers routed to `/fix`, re-run the four automated commands,
      and record final results. *Done when:* the summary table is complete,
      every step above is checked, and lint, typecheck, test, and build are
      green on the final state.

## Files / areas

- `src/app/globals.css` - only if a hue value or reduced-mode fallback needs
  adjustment; family blocks stay `data-family`-scoped
- `src/lib/visual-preferences.ts` - read-only expected; no contract change
- Focused presentational components (focus/ARIA/overflow fixes only), e.g.
  Today carousels, Library/Wishlist cards, detail sections, Settings controls
- `blueprint/context/current-feature.md` - the Acceptance log below is filled
  in here during `/implement`

## Data / contracts

- No new schema, types, routes, or API shapes.
- Load-bearing (must not change): the family attribute contract (`data-family`
  on `<html>`, Dawn = attribute absent, Sunset = `"sunset"`, storage key
  `backlog-odyssey:family`) and the reduced-preference attributes
  (`data-reduced-data`, reduced-motion) from `src/lib/visual-preferences.ts`.
  Any fix that would rename or re-key these is out of scope.
- Load-bearing: the hue-layer rule from 20b - families override hue-bearing
  tokens only; neutrals stay shared. Contrast fixes adjust hue values, never
  neutral tokens or `@theme inline` role names.

## Testing

- No new logic is expected; this is an acceptance feature. If any fix turns
  out to touch logic-bearing code (a formatter, validator, or server action),
  it ships a focused Vitest test in the same diff per the coding-standards
  gate.
- Browser evidence is manual by standing decision (no Playwright): the owner
  walks the checklist live against `pnpm dev`; the AI records outcomes.
- Automated gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  recorded at Step 1 and re-run at Step 8.

## Notes for the AI

- Stay inside the acceptance frame: a found problem is either a small
  presentational fix (token value, focus/ARIA attribute, overflow, target
  size) done in-step, or a recorded leftover for `/fix`. Never refactor,
  restructure, or change behavior to make a check pass.
- Sunset fixes adjust `[data-family="sunset"]` hue values only; Dawn is the
  inherited baseline and only changes if Dawn itself fails a check.
- The overview's build-order line for feature 20 and its "next workflow
  action" note are stale (they still list 20e/20f as remaining); the build
  plan is the checked-state authority. Do not spec against them; `/complete`
  archives this spec and the next `/overview` refresh reconciles the text.
- Respect the reduced-preference implementations exactly as shipped
  (pre-paint script, attributes, provider); verify, do not rework.
- The duplicated `19c` label in build-plan.md is a known cosmetic issue in
  completed items; leave it alone.

## Acceptance log

Filled in by `/implement`. Tables below are the record of record.

### Automated baseline (Step 1)

| Check | Result |
| --- | --- |
| pnpm lint | PASS, exit 0 |
| pnpm typecheck | PASS, exit 0 |
| pnpm test | PASS, 123 files, 1209 tests |
| pnpm build | PASS, exit 0; known dynamic `/today` warnings only |

Dev server: existing `pnpm dev` process reused on port 3500; `curl http://localhost:3500/` returned HTTP 200.

### Route results (Steps 2-5)

Per sweep, one row per route; cells record pass / fixed+pass / fail(leftover).
`/welcome` rows are recorded once per family (desktop light/dark/system plus
the mobile spot-check) with the flag-reset procedure noted above.

| Route | Dawn desktop (L/D/Sys) | Dawn mobile | Sunset desktop | Sunset mobile |
| --- | --- | --- | --- | --- |
| / | pass, redirects to `/today` while onboarding is complete | pass, redirects to `/today`; no overflow | pass, redirects to `/today`; Sunset tokens verified in light/dark/system | pass, redirects to `/today`; no overflow and Sunset family retained |
| /welcome | pass, redirects to `/today` when complete; incomplete flow rendered and was restored | pass, redirects to `/today`; one mobile spot-check | pass, incomplete flow rendered under Sunset dark and was restored through the form | pass, redirects to `/today`; one mobile spot-check |
| /today | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present | pass, light/dark/system; no overflow and Sunset primary/signal tokens verified | pass, light/dark/system; no overflow and bottom navigation present |
| /library | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present |
| /games/[id] | pass, light/dark/system; no overflow and focus-visible check | pass, light/dark/system; no overflow and bottom navigation present | pass, light/dark/system; no overflow, RAWG game tint retained | pass, light/dark/system; no overflow and bottom navigation present |
| /wishlist | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present |
| /wishlist/[id] | pass, light/dark/system; no overflow and focus-visible check | pass, light/dark/system; no overflow and bottom navigation present | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present |
| /collections | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present | pass, light/dark/system; no overflow | pass, light/dark/system; no overflow and bottom navigation present |
| /collections/[id] | N/A, no collection detail link exists in current data | N/A, no collection detail link exists in current data | N/A, no collection detail link exists in current data | N/A, no collection detail link exists in current data |
| /settings | pass, light/dark/system; no overflow | fixed+pass, Steam actions wrap at 390px; no overflow and bottom navigation present | pass, light/dark/system; no overflow | fixed+pass, Steam actions wrap at 390px; no overflow and bottom navigation present |

### Reduced modes (Step 6)

| Check | Dawn | Sunset |
| --- | --- | --- |
| Reduced motion: manual carousels, no auto-advance | pass, `data-motion="reduced"`; Today reported zero CSS animations and controls remained manual | pass, same result; Sunset family retained in internal navigation |
| Reduced motion: System resolution mirrors OS | pass, attributes absent and OS reported no reduced-motion preference | pass, attributes absent and OS reported no reduced-motion preference |
| Reduced data: Wallhaven off, token fallbacks, abstract themes | pass through internal navigation, `data-reduced-data="on"`; no Wallhaven image and game detail used abstract fallback | pass through internal navigation, same fallback; mobile Settings spot-check passed at 390x844 |
| Reduced data: System resolution mirrors OS | pass, attribute absent and OS reported no reduced-data preference | pass, attribute absent and OS reported no reduced-data preference |

### Contrast ledger (Step 7)

| Token/pair | Palette + mode | Ratio | Requirement | Result |
| --- | --- | --- | --- | --- |
| primary / signal text on background and card | Dawn light | 5.00 / 5.50 | 4.5:1 text | PASS |
| primary-foreground on primary | Dawn light | 5.41 | 4.5:1 text | PASS |
| opportunity, warning, danger, success text on background / card | Dawn light | 5.01 / 5.50; 4.63 / 5.09; 5.36 / 5.89; 4.88 / 5.37 | 4.5:1 text | PASS |
| primary / signal text on background and card | Dawn dark | 10.19 / 9.46 | 4.5:1 text | PASS |
| primary-foreground on primary | Dawn dark | 9.27 | 4.5:1 text | PASS |
| opportunity, warning, danger, success text on background / card | Dawn dark | 8.61 / 7.99; 10.23 / 9.49; 7.71 / 7.16; 11.55 / 10.73 | 4.5:1 text | PASS |
| primary / signal text on background and card | Sunset light | 4.71 / 5.18 | 4.5:1 text | PASS, inherited 20b pair |
| primary-foreground on primary | Sunset light | 4.78 | 4.5:1 text | PASS, inherited 20b pair |
| opportunity, warning, danger, success text on background / card | Sunset light | 4.57 / 5.02; 4.59 / 5.04; 4.61 / 5.06; 5.36 / 5.89 | 4.5:1 text | PASS, success adjusted in 20g |
| primary / signal text on background and card | Sunset dark | 8.45 / 7.84 | 4.5:1 text | PASS, inherited 20b pair |
| primary-foreground on primary | Sunset dark | 8.18 | 4.5:1 text | PASS, inherited 20b pair |
| opportunity, warning, danger, success text on background / card | Sunset dark | 12.71 / 11.80; 10.10 / 9.37; 7.57 / 7.03; 11.55 / 10.73 | 4.5:1 text | PASS, inherited 20b pair |
| family ring on primary surface | Dawn/Sunset light and dark | 5.00+ where the primary ring is used; light sidebar rings 1.57 (Dawn) / 2.88 (Sunset) | 3:1 non-text | Primary rings pass; sidebar rings are supplementary focus accents, not sole indicators, matching the recorded 20b justification |

(Sunset inherits the 20b recorded semantic-pair table; record Dawn's core
semantic pairs here plus any pairs flagged during the sweeps.)

### Fixes applied and leftovers

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | Settings Steam action group overflowed to 605px at 390px | Removed the shrink-only layout constraint and allowed the action group to wrap; verified at 390x844 in all Dawn modes |
| 2 | Direct hard navigation with stored reduced/family preferences reset the root attributes and logged a hydration mismatch; internal navigation retained them | Leftover for `/fix`: this crosses the shipped pre-paint/provider hydration boundary and is outside the presentational scope of 20g |
| 3 | Dawn light primary, danger, success, and primary-foreground pairs were below AA | Adjusted only Dawn light hue values in `globals.css`; computed ratios now pass AA |
| 4 | Sunset light success text was below AA at 3.98:1 | Darkened the Sunset light success/chart-5 hue; computed ratios now pass AA |

### Summary (Step 8)

| Check | Final result |
| --- | --- |
| lint / typecheck / test / build | PASS: lint exit 0; typecheck exit 0; 123 files / 1209 tests passed; build exit 0 with known dynamic `/today` warnings |
| Route matrix complete | PASS for all available routes across Dawn/Sunset desktop and mobile; `/collections/[id]` N/A because current data has no collection detail link |
| Reduced modes verified | PASS for internal navigation and mobile spot-check; direct hard-navigation hydration reset remains a `/fix` leftover |
| Contrast ledger complete | PASS, every recorded text pair meets 4.5:1; non-text sidebar-ring exceptions justified |
| Leftovers routed to /fix | 1 hydration/pre-paint/provider boundary issue recorded; no open presentational failure remains |

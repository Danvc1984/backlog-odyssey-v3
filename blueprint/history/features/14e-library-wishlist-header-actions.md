# Feature: Library and Wishlist header action rework

**From build-plan:** feature 14e
**Status:** not started

## Goal

Finish the header-action areas of the two browsing pages and their supporting
Settings operations so every action,
operation status, and follow-up section speaks the shared 14b/14c/14d design
language, and add ProtonDB compatibility tags to the game cards in both views
so the first thing a card communicates is how it runs on this hardware.

## Design reference

- `prototypes/library.html`, `prototypes/wishlist.html`, and
  `prototypes/theme.css` restored from git commit `602df5f` (the same restore
  14c/14d used) as the operative composition reference for this feature. This
  environment cannot render images, so the restore happens at implementation
  time and the HTML carries the exact structure; the header/action philosophy
  is also captured in the archived 14c/14d specs.
- `blueprint/reference/reference material*.png` are the original design pack
  already behind the prototypes; treat the prototypes as authoritative.
- The shared token system is already ported into `src/app/globals.css` by 14a,
  so there is no theme port step in this feature.
- Header/status vocabulary to homogenize against (from 14b/c/d and the
  prototypes): pill `button button-secondary` for run actions, chip links for
  review entries (filter-chip language), `technical-label` eyebrows and
  monospace counts/timestamps, `+ Add` primary buttons, and Mexico City
  timestamps for every operation.

## In scope

- Homogenized Library header actions: `Review DLC (n)` and `Review duplicates`
  become chip-style links in the filter-chip language, aligned with the
  existing `Update recommendations` and `Add game` buttons. URLs, conditions,
  and behavior unchanged.
- Homogenized Wishlist header actions and statuses: the sync chip, import
  button, update-recommendations button, price refresh, compatibility sweep,
  and `Add wish` form one coherent right-aligned cluster with consistent
  button, chip, status-line, and follow-up card treatment.
- A shared Mexico City timestamp formatter extracted from the two duplicate
  copies, used by the price refresh and compatibility sweep status lines and
  the sync chip.
- ProtonDB compatibility tags on game cards in both views: `LibraryGameCard`
  (grid and list variants) and `WishlistCard` (focus and list variants) render
  a compact ProtonDB tier chip when ProtonDB evidence exists for the game or
  wish, using the same tier labels/colors the detail pages already use.
- The wishlist import result panel aligned with the review-card visual
  language.
- Wishlist and catalog enrichment operations moved to Settings to keep the
  browsing-page headers focused.

## Out of scope

- Any query, filter parameter, action, URL, or operation behavior change. The
  two list queries extend only with the identity and ProtonDB snapshot fields
  the card tag needs, and nothing else.
- Compatibility evidence beyond the ProtonDB tier tag on cards: anti-cheat,
  Windows fallback, staleness, personal overrides, and the full evidence
  blocks stay on the detail pages.
- Today, Game Detail, and Collections headers (14f). The shared
  `UpdateRecommendationsButton` is restyled consistently but remains exactly
  one component, so Today inherits the same visual but gets no separate work.
- Duplicate-review branch, dialogs, empty states, searchParams, or
  reduced-data art behavior.
- Wallhaven (15), per-game palettes (16), cross-app acceptance (14g).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - ProtonDB tag infrastructure** - Add
      `src/lib/protondb-tags.ts` with the shared ProtonDB tier label/class
      maps and a pure `deriveCardTier` helper
      (`steamAppId`, `isRomOnly`, `snapshotResult` -> tier or null, reusing
      `parseProtonDbSummary`), plus a test. Add the compact server-side
      `ProtonDbTag` component (tier chip, `aria-label` with the tier). No page
      wiring yet. *Done when:* the new test passes, both detail components can
      still rely on their existing local maps untouched, and `pnpm build`
      passes.
- [x] **Step 2 - Library query and card tags** - Extend the `/library` list
      query with `externalIds` (namespace STEAM_APP) and `compatSnapshots`
      (provider PROTONDB, latest) for each game, derive `isRomOnly` from the
      already-loaded availability, pass the derived `protonDbTier` into
      `LibraryGameCard`, and render `ProtonDbTag` in the grid and list card
      variants. Games without a parseable ProtonDB snapshot, ROM-only games,
      and games without a Steam identity show no tag. *Done when:* cards with
      ProtonDB evidence show the tier chip, games with no evidence show none,
      the tag works in both variants, and `pnpm build` + `pnpm test` pass.
- [x] **Step 3 - Wishlist query and card tags** - Extend the `/wishlist` list
      query with `compatSnapshots` (provider PROTONDB, latest) per entry,
      derive `protonDbTier` per entry, thread it through `WishlistList` into
      `WishlistCard`, and render `ProtonDbTag` in the focus and list variants.
      DLC wishes, identity-less wishes, and wishes without a snapshot show no
      tag. *Done when:* base-game wishes with ProtonDB evidence show the tier
      chip, everyone else shows no tag, both variants render it, and `pnpm
      build` + `pnpm test` pass.
- [x] **Step 4 - Library header action cluster** - Restyle `Review DLC (n)`
      (warning-tinted chip, keeps its link and condition) and `Review
      duplicates` (neutral chip) in the filter-chip language, and align their
      sizing/spacing with `Update recommendations` and `Add game`. *Done
      when:* the Library header actions read as one cluster in dark and light
      on desktop and mobile, every previous link URL and condition is
      unchanged, and `pnpm build` passes.
- [x] **Step 5 - Shared status formatter and operation status lines** - Extract
      the shared Mexico City timestamp formatter into
      `src/lib/format-times.ts` with a test; use it in `PriceRefreshPanel` and
      `WishlistCompatSweepPanel`. Align the two run-status lines to the same
      `technical-label`-style presentation while keeping the conversion-warning
      and ITAD attribution visible. *Done when:* both panels produce identical
      status-line structure and Mexico City timestamps through the shared
      formatter, the formatter test passes, and `pnpm build` + `pnpm test`
      pass.
- [x] **Step 6 - Wishlist sync chip and import result follow-up** - Use the
      shared formatter in `WishlistSyncChip` (which currently formats in the
      browser's default locale), align the chip to the chip language, and
      restyle the import result panel to match the import review card while
      keeping its dismiss and scroll-to-review actions. *Done when:* the sync
      chip timestamp matches the other status timestamps, the chip and result
      panel read as part of the cluster, all existing actions still work, and
      `pnpm build` + `pnpm test` pass.
- [x] **Step 7 - Visual and build acceptance** - Walk both pages in every
      variant (Library grid/list, Wishlist focus/list), dark, light, and
      system modes, desktop and mobile, with and without evidence and ROM-only
      games present, plus keyboard/screen-reader labels on the new chips and
      tags. Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm typecheck`.
      *Done when:* the header clusters and tags render correctly everywhere,
      no console errors, no hydration mismatches, and all four commands pass.

## Files / areas

- `src/lib/protondb-tags.ts` (new) + `src/lib/protondb-tags.test.ts` (new) -
  shared tier maps, `deriveCardTier`, card tag decision.
- `src/components/games/ProtonDbTag.tsx` (new) - compact tier chip used by
  both card families.
- `src/lib/format-times.ts` (new) + `src/lib/format-times.test.ts` (new) -
  Mexico City timestamp formatter for operation status lines.
- `src/app/(app)/library/page.tsx` - list query identity + ProtonDB snapshot
  fields, `protonDbTier` derivation, header action links as chips.
- `src/components/games/LibraryGameCard.tsx` - accept and render
  `protonDbTier` in grid and list variants.
- `src/app/(app)/wishlist/page.tsx` - list query ProtonDB snapshot field,
  per-entry `protonDbTier`, header cluster alignment.
- `src/components/wishlist/WishlistList.tsx` - thread `protonDbTier`.
- `src/components/wishlist/WishlistCard.tsx` - accept and render
  `protonDbTier` in focus and list variants.
- `src/components/wishlist/PriceRefreshPanel.tsx`,
  `src/components/wishlist/WishlistCompatSweepPanel.tsx`,
  `src/components/wishlist/WishlistSyncChip.tsx`,
  `src/components/wishlist/ImportSteamWishlistButton.tsx` - shared formatter,
  homogenized status lines and import result card.

## Data / contracts

No schema, migration, or action changes.

- Load-bearing: the ProtonDB tier union and the `ProtonDbTag` component
  signature (`{ tier }`) are the shared contract for card-level ProtonDB
  evidence, reused by both pages and all four card variants. Later surfaces
  (14g acceptance, detail pages) keep their richer evidence blocks.
- Load-bearing: the shared `formatMexicoTimestamp` (`Date | string | null` or
  invalid -> `null` or formatted `es-MX` in `America/Mexico_City`) becomes the
  single source for operation timestamps across both run panels and the sync
  chip.
- Library `LibraryGameCardEntry` gains `protonDbTier` derived server-side
  from `externalIds` (STEAM_APP), availability (`availability.some(ROM) &&
  !availability.some(STEAM)` = ROM-only), and the latest PROTONDB
  `compatSnapshots` result via `parseProtonDbSummary`.
- Wishlist entry view gains `protonDbTier` derived from `steamAppId` and the
  latest PROTONDB `compatSnapshots` result. Absence of a snapshot means no
  tag; no inference from catalog snapshots (wishlist compat storage is
  deliberately parallel per 11d).

## Testing

Vitest gate is on; the logic-bearing pieces ship tests:

- `src/lib/protondb-tags.test.ts` - every tier maps to a label and class; the
  derive helper returns a tier for a strong/parseable snapshot, null for a
  missing or malformed snapshot, null for ROM-only games, and null when no
  Steam identity exists. The test mocks `server-only` the same way
  `protondb-api.test.ts` does, since `deriveCardTier` imports
  `parseProtonDbSummary`.
- `src/lib/format-times.test.ts` - a valid date yields a string formatted in
  `es-MX` and `America/Mexico_City` (assert on the date parts present rather
  than an exact locale string, which varies across ICU builds), an
  invalid/null value yields null, and the output is stable across calls.
- Everything else is UI composition: verified with `pnpm build` plus live
  dev-server evidence in dark and light at desktop and mobile widths (manual
  browser walkthrough; no Playwright in this project).
- Final gate: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Notes for the AI

- The pages stay server components; the tag and chips are server-rendered
  presentational markup. Existing client controls (`PriceRefreshPanel`,
  `WishlistCompatSweepPanel`, `ImportSteamWishlistButton`,
  `UpdateRecommendationsButton`) keep their client behavior and just change
  markup and the formatter import.
- ROM-only detection in the library must reuse the game-detail rule
  (`availability.some(ROM) && !availability.some(STEAM)`), never a new query.
- Insufficient-confidence ProtonDB reports still parse to a tier through
  `parseProtonDbSummary`; the tag shows the tier and the detail pages remain
  the authoritative evidence surface.
- Keep `UpdateRecommendationsButton` as the single shared component: restyle
  through class adjustments only, never a page-specific fork.
- Do not add counts, compatibility rows, new filters, or new queries to cards;
  the card tag reads only the fields this feature adds to the two existing
  queries.
- Respect the writing standard: no em dashes in code, comments, or docs.

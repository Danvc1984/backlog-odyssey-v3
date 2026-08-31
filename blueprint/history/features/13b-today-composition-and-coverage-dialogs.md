# Feature: Today composition and coverage dialogs

**From build-plan:** feature 13b
**Status:** not started

## Goal

Finish the functional Today dashboard: compose the remaining sections the plan
assigns to it — main/in-progress games with active-backlog progress, the two
actionable catalog-coverage counts with accessible click-open dialogs, the
three best current wishlist offers, and provider freshness with background
operation status. Everything composes data that already exists; Today stays a
read-only local view (the only write path remains 13a's activity cache).

## Design reference

None. Functional UI under the current look; feature 14 owns visual redesign,
layout, and hierarchy.

## In scope

- **Active-backlog progress, aligned to the plan formula.** `project-plan.md`
  §12 defines progress as `PLAYED_BEFORE / (NOT_STARTED + IN_PROGRESS +
  PLAYED_BEFORE)` with `ABANDONED` shown separately and excluded from the
  denominator. The 13a loader currently returns a started-share
  (`IN_PROGRESS` + `PLAYED_BEFORE`); this feature reshapes `activeBacklog` to
  per-state counts plus a separate `abandoned` count and renders the plan
  formula. Universe stays visible (non-hidden) base games.
- **Main game and games in progress.** The visible base game flagged
  `isMainGame` (linked to its detail page) and other visible base games in
  `IN_PROGRESS` (excluding the main game, name-ascending). Quiet empty states
  for each.
- **Two coverage counts with accessible dialogs.** RAWG-metadata coverage
  (visible base games without any RAWG `MetadataSnapshot`) and
  recommendation-profile coverage (visible base games failing the profile
  completeness definition). Each count opens a dialog listing up to ten
  affected game titles linking to `/games/[id]`, expandable in pages of ten
  until exhausted, with a remaining count, a header stating the count's basis
  (provider metadata vs local personal fields), and an empty note when
  nothing needs attention. A zero count disables the trigger.
- **Three best current offers.** One best offer per wishlist entry via the
  existing `buildEntryOfferView` selection, fresh only (existing 48-hour
  `OFFER_FRESHNESS_WINDOW_MS`), ranked: discount percentage descending with a
  null discount ranking as zero, then
  target-price met (price at or below `targetPriceMxn`) before not-met or
  absent target, then price ascending, then name ascending for determinism;
  top three displayed. Each row shows discount, price in its real returned
  currency (per the 10b-c "real returned-currency display" decision, not
  forced MXN), store, fetched-at freshness, a link to `/wishlist/[id]`, and a
  link to the external seller page. Quiet empty state when no fresh offers
  exist.
- **Provider freshness and operation status.** Display-only block:
  - Per-provider last success from existing records: Steam
    (`SteamConnection.lastSyncAt`), RAWG (newest `MetadataSnapshot.fetchedAt`),
    ITAD (newest `PriceRefresh` with status `SUCCESS` or `PARTIAL` by
    `finishedAt`), compatibility (newest
    `CompatibilitySnapshot.fetchedAt`); "never" when absent.
  - Background operations from existing records: `EnrichmentJob` counts by
    status (queued, running, retry-wait, failed), plus any currently
    `RUNNING` `SyncRun`, `PriceRefresh`, or `WishlistCompatSweep` row with its
    started time.
  - Links point at the existing management surfaces in Settings; nothing here
    triggers or retries work.
- Unit tests for all new logic (Vitest gate is on).

## Out of scope

- Visual hierarchy, layout order polish, theming, and charts (feature 14).
- Restructuring the existing Play next / Buy sections, Tune-this-run,
  taste setup, or the 13a Recent Steam activity block; they keep their places.
  The plan's "three latest play-next and buy results" is already satisfied by
  these sections rendering the latest explicit runs.
- Any new server actions, provider calls, or automatic refreshes. Today never
  runs a sync or enrichment; only the 13a activity-cache refresh writes.
- Per-provider staleness thresholds or colored freshness policies: the block
  shows last-success times and ages, not invented warning rules.
- New caveat logic for keyshop or activation warnings on the offers block;
  the wishlist detail page remains authoritative for those.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Data-health loader reshape** - In
  `src/lib/today-data-health.ts`: extend the slim universe select with
  `name`; reshape `activeBacklog` to
  `{ playedBefore, inProgress, notStarted, total }` plus a separate
  `abandoned` count (visible base games, `ABANDONED` excluded from `total`);
  add `rawgMissing` and `profileIncomplete` title lists
  (`CoverageTitle = { id: string; name: string }`, name-ascending, over the
  same universes as the counts); keep the existing coverage count fields.
  Update the 13a tests for the new shape and the title-list ordering.
  *Done when:* `today-data-health.test.ts` proves the per-state counts, the
  separate abandoned count, and both title lists (ordering, membership,
  hidden/DLC exclusion); `pnpm test` and `pnpm typecheck` green.
- [x] **Step 2 - Main/in-progress and progress section** - New
  `src/components/today/TodaySummary.tsx` (server-rendered) placed above the
  Play next section: main game linked to its detail page, other in-progress
  games as detail links (name-ascending), the progress line rendered as the
  plan formula (`playedBefore of total played through`), and the abandoned
  count shown separately. Empty states: "no main game selected" hint linking
  to `/library`, "nothing in progress", and 0/0 renders without a division
  display. Load main and in-progress rows with one narrow Prisma query in the
  page. *Done when:* manual walkthrough shows the section with a main game,
  in-progress games, correct numbers against real library states, and each
  empty state; `pnpm build` green.
- [x] **Step 3 - Coverage dialog component and RAWG dialog** - New
  `src/components/today/CoverageDialog.tsx` (client component wrapping the
  existing shadcn `dialog.tsx`, serializable props only): trigger showing the
  count with its label, disabled at zero; dialog lists the first ten titles
  as links to `/games/[id]`, a `Show more` control expanding by ten with the
  remaining count until exhausted, and an empty note when the list is empty.
  Wire the RAWG coverage count to it, with a header stating the provider
  metadata basis. *Done when:* manual walkthrough opens the dialog from
  Today, shows ten linked titles, pages through all of them, and disables
  the trigger at zero; keyboard operation works; `pnpm build` green.
- [x] **Step 4 - Profile coverage dialog** - Reuse `CoverageDialog` for the
  recommendation-profile count, with a header stating the local basis
  (interest plus one of non-`NONE` priority, preferred environment, or game
  experience; rating and default play state count for nothing). *Done when:*
  manual walkthrough shows profile-incomplete titles matching the tested
  definition and the dialog behaves identically; `pnpm build` green.
- [x] **Step 5 - Three best current offers** - New pure
  `rankTodayOffers(views, now)` in a new `src/lib/today-offers.ts` over the
  existing `buildEntryOfferView` results: keep only fresh selected offers,
  rank by discount desc, target-met before not-met/absent, price asc, name
  asc, cap three; render `src/components/today/TodayOffers.tsx` above the
  operations block with discount, real-currency price, store, fetched-at,
  wishlist-detail link, and seller link, plus a quiet empty state. Load
  wishlist entries with their offers and targets in one Prisma query.
  *Done when:* `today-offers.test.ts` covers the ranking matrix (discount
  order, target tiebreak, nulls, stale exclusion, three-cap, name tiebreak);
  manual walkthrough shows the top three against seeded offers and the empty
  state; `pnpm test` and `pnpm build` green.
- [x] **Step 6 - Provider freshness and operation status** - New pure
  aggregation plus `loadTodayOperations()` in `src/lib/today-operations.ts`
  reading only existing records (provider last-success times, EnrichmentJob
  status counts, RUNNING run rows); render
  `src/components/today/TodayOperations.tsx` with per-provider last-success
  ages ("never" when absent), operation counts, running rows with started
  times, and links to the existing Settings surfaces. No triggers. *Done
  when:* `today-operations.test.ts` covers the aggregation (counts, running
  rows, never/absent handling); manual walkthrough reflects real job and run
  states; `pnpm test` and `pnpm build` green.
- [x] **Step 7 - Verification** - Run `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`. Manual pass: full `/today` walkthrough on a real
  catalog — progress numbers match library states; both dialogs page
  correctly and stay keyboard-accessible; offers block matches the top fresh
  offers on the wishlist; provider freshness and operation counts match
  reality; existing Play next, Buy, taste setup, and Steam activity sections
  behave exactly as before. *Done when:* all commands are green and every
  observation holds.

## Files / areas

- `src/lib/today-data-health.ts` (+ test): reshape, abandoned count, title lists
- `src/lib/today-offers.ts`, `src/lib/today-operations.ts` (+ tests): ranking
  and aggregation logic
- `src/components/today/TodaySummary.tsx`, `CoverageDialog.tsx`,
  `TodayOffers.tsx`, `TodayOperations.tsx`: new sections
- `src/app/(app)/today/page.tsx`: wiring the sections together
- Reused unchanged: `src/lib/offer-selection.ts` (`buildEntryOfferView`,
  `OFFER_FRESHNESS_WINDOW_MS`), `src/lib/steam-activity.ts`, existing
  shadcn `dialog.tsx`

## Data / contracts

Load-bearing for feature 14 (visual redesign composes the same shapes):

- `TodayDataHealth` (reshaped):
  `{ activeBacklog: { playedBefore, inProgress, notStarted, total },
  abandoned: number,
  rawgMetadata: { covered, total, missing: CoverageTitle[] },
  recommendationProfile: { complete, total, incomplete: CoverageTitle[] } }`.
  Universes are fixed: visible base games; `ABANDONED` excluded from the
  backlog denominator.
- `CoverageTitle = { id: string; name: string }`.
- `TodayOfferView`:
  `{ wishlistEntryId, gameName, discountPercent: number | null,
  price: number, currency: string, store: string, fetchedAt: string,
  targetMet: boolean }` — dates serialized as ISO strings for the client.
- `TodayOperationsView`:
  `{ providers: { name, lastSuccessAt: string | null }[],
  jobs: { queued, running, retryWait, failed },
  runningRuns: { kind, startedAt: string }[] }`.
- All new sections are display contracts over existing stored records; no
  schema changes in this feature.

## Testing

- Vitest gate is on (`pnpm test`). In-scope logic with required tests:
  - Backlog per-state counts, separate abandoned count, coverage title lists
    (Step 1).
  - Offer ranking matrix: freshness exclusion, discount order, target
    tiebreak, null discount/target handling, three-cap, name tiebreak
    (Step 5).
  - Operations aggregation: status counts, running-run inclusion, absent
    records (Step 6).
- Section rendering and dialog behavior ride on the per-step manual
  walkthroughs plus `pnpm build`.

## Notes for the AI

- Server components by default; only `CoverageDialog` is a client component
  (radix dialog requires it). Pass it serializable props — ISO strings, not
  Date objects.
- Single-user app: existing Today queries read Prisma directly without a user
  filter; follow that pattern. No new server actions anywhere in this
  feature.
- Today remains read-only except 13a's `refreshSteamActivityCacheIfStale()`;
  none of these sections may enqueue, sync, or refresh anything.
- Reuse, do not re-implement: offer selection and freshness from
  `src/lib/offer-selection.ts`, entry views from `buildEntryOfferView`,
  catalog identity conventions as-is. `prices` are Prisma decimals — go
  through `toOfferNumber` / `toNumber()`.
- Offer display keeps the 10b-c real returned-currency decision even though
  the plan's older wording says "MXN".
- Deterministic ordering everywhere: name-ascending final tiebreaks for lists
  and rankings, matching project conventions.
- Tests mock `@/lib/prisma` and `server-only` following
  `src/lib/compat-queue.test.ts`; pure functions take plain rows.
- Use generated Prisma enums (`PlayState`, `EnrichmentJobStatus`,
  `SyncStatus`) rather than string literals where types allow.

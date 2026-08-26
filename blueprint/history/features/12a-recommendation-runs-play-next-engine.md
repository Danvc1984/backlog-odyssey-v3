# Feature: 12a - Recommendation runs and play-next engine

**From build-plan:** feature 12a (sub-item of 12, Recommendation engine)
**Status:** not started

## Goal

Deliver the recommendation engine's foundation: a dual-reference storage
contract, a deterministic and explainable play-next list, one explicit
`Update recommendations` action that creates both runs, and a Today display
with in-run dismissal. Buy recommendations ship in 12b; calibration ships in
12c. This is the first visible half of feature 12.

## In scope

- Schema: `RecommendationItem` dual reference (catalog game or wishlist
  entry), `RecommendationFeedback` reworked into a persistent dismissal log.
- Play-next eligibility, deterministic scoring, and explanation factors
  (pure, unit-tested).
- Compatibility as warning-only context for play-next items (never scored).
- `updateRecommendations` server action: creates a PLAY_NEXT run (top 3) and
  an empty BUY run, prunes runs older than 12 months, returns counts.
- `dismissRecommendation` server action: one log row per dismissal.
- `/today` recommendations UI: header action, empty states, play-next list
  with factor chips, buy section empty note.
- `Update recommendations` button in Library and Wishlist headers.
- Game detail: "Latest recommendation" block when the game appears in the
  latest PLAY_NEXT run.

## Out of scope

- Buy eligibility and scoring (offer quality, target price, DLC affinity,
  no-pricing caveats): 12b.
- Calibration effect on scoring (adjusted interest) and detail-page
  calibration explanations: 12c.
- Dashboard composition (main game, in-progress, Steam activity, best offers,
  freshness, operation progress): 13.
- Scheduled or automatic runs: 18.
- Any provider calls from the run action (the run is pure DB read/write).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema migration** - Make `RecommendationItem.gameId`
  optional and add `wishlistEntryId String?` with a cascade relation to
  `WishlistEntry`. Rework `RecommendationFeedback` into the dismissal log:
  `gameId String?`, `wishlistEntryId String?`, `kind RecommendationKind`
  (was String), `createdAt`; drop `reason` and `expiresAt`; index
  `[gameId, kind]` and `[wishlistEntryId, kind]`. *Done when:*
  `pnpm prisma:migrate` produces a clean migration, `prisma migrate status`
  is in sync, and `pnpm typecheck` passes on the regenerated client.
- [x] **Step 2 - Play-next engine (pure)** - `src/lib/recommendations/`:
  `types.ts` (explanation factor/caveat types), `play-next.ts` (eligibility,
  score, rank with tiebreak, top-3 cap, factor builder), `compat-context.ts`
  (compatibility caveat builder from effective Bazzite status, staleness,
  anti-cheat, ROM-only). *Done when:* unit tests pass for the full
  eligibility matrix, every scoring factor, null interest, name tiebreak,
  top-3 cap, and every compat caveat branch.
- [x] **Step 3 - Run and dismiss actions** - `src/actions/recommendations.ts`:
  `updateRecommendations` (auth, one transaction: compute play-next list,
  create PLAY_NEXT run with items, create empty BUY run, prune runs with
  `createdAt` before `now - 365 days`, return run ids, counts, prunedRuns)
  and
  `dismissRecommendation` (auth, Zod input with exactly one target, insert
  one log row). *Done when:* action tests pass (both runs created, items
  capped at 3 with rank/score/explanations, prune cutoff at 12 months,
  dismiss input validation and insert) and a live call creates two runs in
  the DB.
- [x] **Step 4 - Today recommendations UI** - Rewrite `/today`: header with
  `UpdateRecommendationsButton` (client: calls the action, toast,
  `router.refresh()`), no-runs empty state with CTA, "Play next" section
  (rank, name link to `/games/[id]`, score, positive/negative factor chips,
  caveat chips; "No eligible games right now." when the run has no items),
  "Buy" section with a "No buy recommendations yet." note. *Done when:*
  `pnpm build` passes and, live, clicking Update shows up to 3 play-next
  items with explanations on /today; before any run the empty state with the
  button renders.
- [x] **Step 5 - In-run dismissal** - Dismiss button on the play-next card:
  calls `dismissRecommendation`, hides the item in local state, toast
  "Dismissed for this run". *Done when:* live, dismissing hides the item
  until reload, a `RecommendationFeedback` row exists with the right kind
  and target, and a reload brings the item back.
- [x] **Step 6 - Header actions and game detail block** -
  `UpdateRecommendationsButton` in the /library and /wishlist header action
  rows; game detail page renders a "Latest recommendation" block (rank,
  score, factor chips, caveat chips) when the game is in the latest
  PLAY_NEXT run. *Done when:* `pnpm build` passes and, live, the button is
  present on both headers and a recommended game's detail page shows the
  block with factors matching the Today list.

## Files / areas

- `prisma/schema.prisma` (+ one migration)
- `src/lib/recommendations/` (new: `types.ts`, `play-next.ts`,
  `compat-context.ts`, and their tests)
- `src/actions/recommendations.ts` (+ test)
- `src/components/recommendations/` (new: `UpdateRecommendationsButton.tsx`,
  `RecommendationItemCard.tsx`)
- `src/app/(app)/today/page.tsx` (rewrite from stub)
- `src/app/(app)/library/page.tsx`, `src/app/(app)/wishlist/page.tsx`
  (header button only)
- `src/app/(app)/games/[id]/page.tsx` (latest-recommendation block)

## Data / contracts

Load-bearing for 12b, 12c, and 13:

- **`RecommendationItem` dual reference** - `gameId` and `wishlistEntryId`
  are both optional; exactly one is set, enforced in code. PLAY_NEXT items
  always reference a catalog `Game`; BUY items always reference a
  `WishlistEntry`. This resolves the open question in the project overview:
  buy items never create provisional `Game` records.
- **`RecommendationFeedback` dismissal log** - one row per dismissal:
  `gameId?`, `wishlistEntryId?`, `kind` (`PLAY_NEXT`/`BUY`), `createdAt`.
  The calibration counter is `floor(rows for (target, kind) / 3)` interest
  points, applied in 12c. Rows are cumulative and never pruned.
- **Explanation JSON** on each item -
  `positive: { factor, label, points }[]`,
  `negative: { factor, label, points }[]`,
  `caveats: { factor, label }[]`.
- **Factor keys (locked)** - `interest`, `priority`, `play_soon`, `replay`,
  `abandoned`, `calibration`, `offer_discount`, `target_hit`, `dlc_affinity`,
  `compat_bazzite`, `compat_tinkering`, `compat_fallback`, `compat_required`,
  `compat_unknown`, `compat_stale`, `anticheat`, `compat_na`, `no_pricing`,
  `stale_offer`, `keyshop`, `compat_base_game`. 12a uses the play-next and
  compat keys; 12b/12c use the rest.
- **Run `context` JSON** - `{ eligible: { playNext: number, buy: number },
  prunedRuns: number }`.
- **Play-next eligibility** - `Game.type` is `BASE_GAME`; a `LibraryEntry`
  exists (games without one never appear in the library and are excluded);
  not `hidden`; not `isMainGame`; `playState` is `NOT_STARTED`, or
  `replayCandidate` is true with `playState` `PLAYED_BEFORE`/`ABANDONED`.
  `IN_PROGRESS` and DLC never enter.
- **Play-next score (locked, additive)** -

  | Factor | Points | Side |
  | --- | --- | --- |
  | Interest (null = 0) | interest x 10 | positive |
  | Priority NONE / LOW / MEDIUM / HIGH | 0 / 2 / 4 / 6 | positive (when not NONE) |
  | `playSoon` flag | +3 | positive |
  | `replayCandidate` with `PLAYED_BEFORE`/`ABANDONED` | +2 | positive |
  | `playState` is `ABANDONED` | -2 | negative |
  | Calibration (12c) | -(floor(dismissals/3) x 10) | negative |

  Rank by score desc; ties break by name, case-insensitive asc. Keep the top
  3.
- **Compatibility is warning-only** - it never contributes score points in
  any state. Play-next caveats: effective Bazzite status
  (`compatOverrideStatus` ?? ProtonDB snapshot ?? `UNKNOWN`) maps to
  `compat_bazzite` (positive, 0 points, when `READY`), `compat_tinkering`,
  `compat_fallback`, `compat_required`, or `compat_unknown`; snapshot
  older than 180 days adds `compat_stale`; AWAY `Denied`/`Broken` adds
  `anticheat`; ROM-only games (every availability row is `ROM`) get the
  neutral `compat_na` note and no other compat caveats; no Steam App ID
  yields `compat_unknown`.

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `play-next.test.ts` - eligibility matrix (DLC, hidden, main game,
  IN_PROGRESS, missing LibraryEntry, non-replay PLAYED_BEFORE/ABANDONED all
  excluded; NOT_STARTED and replay-flagged states included), each scoring
  factor, null interest = 0, name tiebreak, top-3 cap.
- `compat-context.test.ts` - ROM-only, no App ID, each Bazzite status,
  stale snapshot, AWAY Denied/Broken.
- `recommendations.test.ts` (actions) - both runs created in one
  transaction, items capped at 3 with rank/score/explanations, prune cutoff
  at `now - 365 days`, dismiss input validation (exactly one target) and
  log-row insert.
- Steps 4, 5, 6 are UI/integration: verified with `pnpm build` plus a live
  dev-server walkthrough, not unit tests.

## Notes for the AI

- Server components by default; only `UpdateRecommendationsButton` and
  `RecommendationItemCard` are client components.
- Every server action: `requireUser()` first, Zod-validate input, return the
  `{ success, data, error }` pattern.
- The run action makes no provider calls: pure DB reads and writes. No
  overlap protection needed (manual, fast); a double-click just creates
  another run and the UI reads the latest.
- Price refresh must never create or replace a run; the existing assertion in
  `src/actions/prices.test.ts` must stay green.
- Pure engine functions take `now: Date` as a parameter (no `Date.now()`
  inside) so tests are deterministic.
- Reuse existing badge/chip styling conventions (see `STATUS_CLASSES` in
  `src/components/games/CompatibilitySection.tsx`); follow the dark-first
  token palette already in `globals.css`.
- 12b will extend the run action with buy candidates using
  `buildEntryOfferView`/`selectCheapestOffers` from `src/lib/offer-selection.ts`;
  12c will swap raw interest for adjusted interest in both engines. Keep the
  engine functions shaped so those are small diffs.
- No em dashes in code, comments, or UI strings (project writing standard).

## Findings

_None resolved by this feature. F-16 [P3] unverified remains in the ledger._

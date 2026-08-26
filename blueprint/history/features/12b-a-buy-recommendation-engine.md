# Feature: 12b-a - Buy recommendation engine

**From build-plan:** feature 12b-a (sub-item of 12b, Buy recommendations)
**Status:** not started

## Goal

Turn the empty BUY run created by 12a into an explainable, persisted shortlist
of wishlist purchases. Picks reflect durable Interest and trustworthy current
offer quality without turning stale prices, a target hit, or DLC ownership into
an automatic purchase recommendation.

## In scope

- Pure buy-candidate eligibility, scoring, offer-quality and explanation
  builders, with deterministic tests.
- Base-game wishlist eligibility and DLC eligibility only when its linked
  catalog base game still exists and is owned.
- Fresh selected-offer discount points, target-price signal, historical-low
  proximity as a score-tie tiebreak, and one boost-only DLC affinity tier.
- Explicit no-pricing, stale-offer, and keyshop caveats on persisted BUY items.
- Extend the existing `updateRecommendations` transaction to load buy
  candidates, create BUY items, retain the existing 12-month run pruning, and
  return buy counts.

## Out of scope

- Today, wishlist-detail, or card UI for BUY items, including user dismissal:
  12b-b.
- New price refreshes, provider calls, target-price editing, or offer selection
  changes. The run only reads persisted offers through existing selection
  semantics.
- Game experience, metadata/activity re-ranking, weighted rotation, retained
  candidate batches, deal-saturation roles, `Show another`, or Tune-this-run:
  12c.
- Dismissal-counter calibration: 12d.
- A new wishlist availability/source field. A standalone base-game wish has no
  catalog availability record, so ROM-only exclusion applies only to an
  eligible DLC's linked owned base game.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at
   the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Pure buy eligibility and score contract** - Add
  `src/lib/recommendations/buy.ts` and focused unit tests. Model a wishlist
  candidate with its selected offer plus, for DLC, its linked catalog base and
  `LibraryEntry`. Implement the eligibility matrix, score/factor builder, and
  non-alphabetical rank tiebreak. *Done when:* tests prove base wishes are
  eligible; DLC needs an owned base; a DLC with a ROM-only base is excluded;
  stale/unpriced wishes remain eligible; Interest, fresh discount, target hit,
  and each DLC-affinity branch produce the locked explanations; equal scores
  use historical-low proximity before stable non-name ordering; the output is
  capped at three.
- [x] **Step 2 - Persist BUY run items** - Extend
  `src/actions/recommendations.ts` to load wishlist entries, valid persisted
  offers, and the minimal base-game context; feed them through the pure engine;
  and create BUY `RecommendationItem`s in the existing transaction instead of
  an empty run. Preserve PLAY_NEXT behavior and the shared pruning cutoff.
  *Done when:* action tests show one transaction creates both runs, BUY items
  reference only `wishlistEntryId`, ranks/scores/factors/caveats are persisted,
  `context.eligible.buy` and result counts match the eligible pool, and an
  empty eligible pool still creates a successful empty BUY run.
- [x] **Step 3 - Regression and run proof** - Run the recommendation and offer
  test coverage plus the applicable static checks; use a local authenticated
  run or narrowly scoped database assertion to confirm one explicit update
  creates a BUY run from persisted wishlist data without starting a price
  refresh. *Done when:* tests and checks pass, the persisted run contains only
  wishlist references, and the existing assertion that price refresh does not
  create or replace a recommendation run remains green.
- [x] **Step 4 - Currency-safe historical-low and ROM-only correction** - Use
  the offer's persisted display-currency `historicalLow`, never its source
  currency value, for the historical-low rank tiebreak. Treat a DLC base as
  ROM-only only when every availability row is `ROM`. *Done when:* focused
  tests prove a converted MXN offer ignores a USD source historical low, and a
  mixed ROM plus non-ROM base remains eligible while an all-ROM base is still
  excluded.

## Files / areas

- `src/lib/recommendations/buy.ts` and `buy.test.ts` (new)
- `src/lib/recommendations/types.ts` (buy candidate types only, if shared)
- `src/actions/recommendations.ts` and `src/actions/recommendations.test.ts`
- Existing `src/lib/offer-selection.ts` and its tests remain the authoritative
  offer-selection contract; change only if a demonstrated type gap requires it.
- No Prisma migration and no UI route/component changes are expected.

## Data / contracts

- **Target reference:** Every BUY `RecommendationItem` sets
  `wishlistEntryId`; `gameId` is null. The existing exactly-one-target rule
  remains load-bearing.
- **Eligibility:** a `BASE_GAME` wishlist entry is eligible. A `DLC` entry is
  eligible only when `baseGameId` resolves to an existing catalog base game;
  missing/deleted bases are excluded. A DLC whose base has only `ROM`
  availability is excluded. No-price and stale-price entries remain eligible
  so their Interest can still be represented, with caveats.
- **Selected offer:** call `selectCheapestOffers(entry.offers, now)` once per
  candidate. It retains its existing currency, expiry, MXN-preference, and
  48-hour freshness behavior. Never compare price amounts across currencies or
  make a provider call.
- **Score, additive and locked for 12b-a:**

  | Factor | Points | Explanation |
  | --- | ---: | --- |
  | Interest (`null` = 0) | `interest × 10` | positive `interest` |
  | Fresh selected offer with numeric 0-100% discount | `floor(discount / 10)`, max 10 | positive `offer_discount` when above 0 |
  | Fresh selected MXN offer at or below a non-null `targetPriceMxn` | +8 | positive `target_hit` |
  | Eligible DLC whose owned base is rated >=4, `PLAYED_BEFORE`, or replay-flagged | +6 once | positive `dlc_affinity` |

  A missing, malformed, zero, or stale discount earns zero points. A target
  only produces points when both prices are comparable MXN values; it never
  suppresses another valid offer. DLC affinity is boost-only and never
  penalizes a DLC whose base lacks those signals.
- **Ranking:** score descending. On equal scores, a fresh selected offer with
  a valid positive historical low ranks by the smaller `(price - historicalLow)
  / historicalLow` gap; candidates without a comparable historical low tie
  behind those with one. Remaining exact ties use `updatedAt` descending, then
  the opaque record id solely for stable persistence. No game name or
  alphabetical ordering decides a displayed recommendation. Keep the top 3.
  Weighted rotation replaces this temporary deterministic tail in 12c.
- **Caveats:** `no_pricing` when no selectable valid offer exists;
  `stale_offer` when the selected valid offer is older than 48 hours; `keyshop`
  when the selected offer has ITAD flag `H`. Caveats have zero score and do not
  change eligibility. Reuse the locked JSON shape:
  `positive`/`negative` are `{ factor, label, points }[]`; `caveats` is
  `{ factor, label }[]`.
- **Run context/result:** extend the existing context to
  `{ eligible: { playNext, buy }, prunedRuns }`; return `buyItems` and
  `buyEligible` alongside the existing play counts. This is a backward-safe
  additive server-action result.

## Testing

Vitest is the gate; logic-bearing changes ship tests in the same diff.

- `buy.test.ts` covers the eligibility matrix, all score rows, null Interest,
  fresh-vs-stale 48-hour boundary, non-MXN/no-target behavior, selected
  keyshop/no-price/stale caveats, affinity is boost-only, historical-low
  tiebreak, non-name residual tiebreak, and top-three cap.
- `recommendations.test.ts` extends its mocks and assertions for BUY loading,
  item persistence, context/result counts, empty success, and no regression to
  PLAY_NEXT/pruning/dismiss validation.
- `offer-selection.test.ts` stays green as the canonical freshness, expiry,
  currency, and keyshop behavior.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and
  `git diff --check` before handoff. Manual proof is a local run/database
  inspection, not a UI walkthrough, because 12b-b owns the Buy surfaces.

## Notes for the AI

- Server components by default. This feature adds no client component and
  makes no route/UI change.
- `updateRecommendations` stays authenticated, fast, and transactional. It
  only performs PostgreSQL reads/writes and must not call Steam, ITAD, RAWG, or
  price-refresh actions.
- Keep provider data as soft, replaceable evidence. Existing local Interest
  remains authoritative; do not overwrite fields or mutate wishlist offers.
- Reuse `toOfferNumber`, `selectCheapestOffers`, and `isKeyshopOffer` rather
  than duplicating provider/currency logic. Pass `now: Date` into pure helpers
  for deterministic tests.
- 12c intentionally replaces the provisional exact-tie tail with candidate
  batches and weighted rotation. Do not bring future adaptive storage or UI
  into this feature.
- No em dashes in code, comments, or UI strings (project writing standard).

## Findings

_None resolved by this feature. Preserve the live findings ledger state._

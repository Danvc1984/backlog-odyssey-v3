# Feature: 19d Buy practical fit and setup-adapted environment fields

**From build-plan:** feature 19d (completes 19)
**Status:** complete

## Goal

Buy recommendations and wishlist discovery become setup-aware: wishlist
compatibility evidence enters the buy engine as a heavy practical-fit penalty
plus caveat on no-fallback Linux setups - never an exclusion - while
compatibility contributes nothing on all-Windows setups. Preferred-environment
choices and the derived profile stop assuming devices the owner does not have:
options adapt to the configured setup and environment evidence for
non-configured devices no longer feeds the profile.

## Design reference

None. Engine work plus an option-list change on the existing personal-fields
form; no new visual language.

## In scope

- Wishlist compatibility evidence in the buy pipeline: confirmed-identity
  base-game wishes carry their stored ProtonDB/AWAY evidence into buy
  ranking and persisted caveats.
- The heavy practical-fit penalty: a wish whose evidence classifies as
  EXCLUDED by the locked `classifyPlayPracticality` contract (anti-cheat
  Denied/Broken without override, or REQUIRED Linux, on a Linux setup with
  no Windows fallback) takes a large uncapped negative rerank factor plus a
  visible caveat - it can still appear, never excluded.
- SOFT classes keep existing-scale penalties (the play environment points);
  PLAYABLE READY gets the small positive; UNKNOWN or unconfirmed-identity
  wishes get no penalty, only the persist-time caveat.
- Compat verdict caveats appended to persisted buy items (today only play
  items get them), gated by the same setup.
- Configured-environment options: the preferred-environment select on game
  detail offers only devices that exist (LINUX when a Linux device exists,
  STEAM_DECK when the handheld runs Linux, WINDOWS when any Windows device
  exists), always including the saved value.
- Derived-profile adaptation: `ENVIRONMENT` dimension evidence from a
  preferred environment that is not a configured device is skipped during
  profile rebuild and candidate dimension resolution, so legacy values for
  devices the owner no longer has do not steer ranking.

## Out of scope

- Play-engine changes (19c is done); any new exclusion from buy.
- DLC wishes: they get no practicality input and no compat caveats - DLC
  compatibility follows the owned base game (11d precedent), and inherited
  base-game evidence stays out of scope (17d precedent).
- Taste setup: it does not set preferred environments in the implemented
  flow, so there is nothing to restrict there; verified during research.
- Merge dialog: it only preserves field values across a merge, no option
  list of its own; unchanged.
- Feature 21 cron; Today layout changes; new run-context contracts.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Wishlist evidence in the buy pipeline** - Extend
  `loadBuyCandidates` to select `steamAppId`, `steamAppIdProvenance`, the
  wishlist compat snapshots, and env rows; add `compatEvidenceForWish`
  beside `compatEvidenceFor` (confirmed `steamAppId` means identity;
  otherwise `hasSteamIdentity: false`; DLC wishes return null evidence);
  thread the per-wish evidence through to `buildBuyPipeline`.
  *Done when:* unit tests cover confirmed, unconfirmed, null-identity, and
  DLC mapping; `pnpm test` and `pnpm typecheck` pass.

- [x] **Step 2 - Practical-fit penalty and buy caveats** - Extend
  `RerankBuyInput` with the wish's `classifyPlayPracticality` result; add
  `BUY_PRACTICAL_FIT_PENALTY = -10` in `types.ts` applied to the EXCLUDED
  class as an uncapped `practical_fit` negative factor (label from the
  classify reason), status points from `RERANK_ENVIRONMENT_POINTS` for
  PLAYABLE/SOFT classes, zero for UNKNOWN; extend
  `persistRecommendationRuns` to append the gated compat verdict to buy
  item caveats the way play items already do. *Done when:* tests prove a
  top-deal EXCLUDED wish ranks below a mid PLAYABLE wish yet stays present
  in its role, no penalty and no caveats on all-Windows setups, and caveats
  appear on persisted buy items on no-fallback setups; suites green.

- [x] **Step 3 - Configured-environment options** - Add pure
  `availableEnvironments(setup)` to `environment-fit.ts` returning the
  device-backed `Environment` values with tests; the game detail page
  passes the configured list to `PersonalFieldsForm`, which renders those
  options and always includes the saved value even when it is no longer a
  configured device. *Done when:* derivation tests cover every setup shape;
  a walkthrough shows only configured devices offered on game detail, a
  legacy saved value still visible and clearable, and `pnpm build` passes.

- [x] **Step 4 - Profile environment filtering** - Thread the configured
  environments (from the pipeline's setup, with the existing missing-row
  default) through `rebuildRecommendationProfile` and
  `resolveCandidateDimensionValues`; skip the `ENVIRONMENT` dimension value
  when the preferred environment is not a configured device, leaving all
  other dimensions untouched. *Done when:* profile tests prove a legacy
  WINDOWS value on a no-Windows setup stops feeding the ENVIRONMENT
  dimension while other evidence persists, and the pipeline passes the
  setup on the `updateOsSetup` synchronous re-run path; suites green.

## Files / areas

- `src/lib/recommendations/pipeline-helpers.ts` - wishlist evidence selects
  and `compatEvidenceForWish` (+ tests).
- `src/lib/recommendations/run-pipeline.ts` - buy evidence threading, buy
  persist caveats, configured environments for the profile.
- `src/lib/recommendations/rerank.ts`, `src/lib/recommendations/types.ts` -
  buy rerank practicality input and the penalty constant (+ tests).
- `src/lib/recommendations/profile.ts` - ENVIRONMENT filtering (+ tests).
- `src/lib/recommendations/environment-fit.ts` - `availableEnvironments`
  (+ tests).
- `src/app/(app)/games/[id]/page.tsx`,
  `src/components/games/PersonalFieldsForm.tsx` - configured options.

## Data / contracts

- No schema changes and no migration.
- Reuses the locked 19c contracts: `classifyPlayPracticality`,
  `compatContributes`, and the reason `{ factor, label }` vocabulary. The
  buy penalty maps EXCLUDED to `BUY_PRACTICAL_FIT_PENALTY = -10`
  (`practical_fit` factor) and never to exclusion.
- The missing-AppSettings default stays the 19c convention (LINUX primary,
  no fallback, no handheld) so pipeline behavior is consistent across both
  engines.
- Penalty placement: the `practical_fit` factor bypasses the taste and
  quality clamps by construction (it is its own additive factor), which is
  what makes it heavy; nothing else in the buy rerank changes.

## Testing

Vitest is the declared runner: Steps 1, 2, and 4 are logic-bearing and ship
tests in the same diff; Step 3's pure helper ships tests while its form
wiring rides on build plus walkthrough. Walkthrough evidence: on the current
no-fallback Linux setup, a wishlist entry with anti-cheat-denied evidence
drops below unaffected picks in Buy yet remains visible with its caveat
instead of disappearing; an unconfirmed-identity wish shows the unknown
caveat without a penalty; switching the setup to all-Windows in Settings and
regenerating runs removes all compat factors and caveats from buy items;
a game saved with preferred environment Windows on a setup without Windows
devices shows the saved value in the form but stops steering the profile
until reassigned.

## Notes for the AI

- Buy must never hard-exclude: the EXCLUDED class only reorders and labels.
  This is the documented asymmetry with play (19c). With a thin pool a
  penalized wish may still take a Best Fit or Deal role; the caveat travels
  with the item.
- `persistRecommendationRuns` buy branch needs the evidence map threaded
  from the pipeline; keep the play branch's behavior byte-identical.
- `PersonalFieldsForm` is a client component; receive the configured options
  as props computed on the server page from the setup, not via a new server
  call.
- Profile filtering happens at aggregation only: stored library entries keep
  their values, and the merge dialog keeps preserving them.
- Keep labels factual and reuse the existing reason strings from
  `environment-fit.ts`; no Odyssey voice on evidence copy, no em dashes.

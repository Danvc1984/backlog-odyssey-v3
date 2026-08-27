# Feature: Roles, batches, and deal saturation

**From build-plan:** feature 12c-e-a (first half of 12c-e)
**Status:** not started

## Goal

Give both engines their role-shaped output: play runs show two best-fit roles,
one qualified out-of-the-box role, and one change-of-pace role; buy runs show
two best-fit roles and one deal role, switching to one best-fit plus two deals
under fresh-deal saturation. Roles are stored on run items, qualified
candidate batches are retained in run context for the 12c-e-b rotation, and
role labels appear on Today and the wishlist buy card. Baseline scoring,
re-rank magnitudes, eligibility, and cold-start behavior from 12c-d are
unchanged; roles select from the adjusted pool, they do not rescore it.

## In scope

- `RecommendationRole` enum and a nullable `role` column on
  `RecommendationItem`, migration.
- New `src/lib/recommendations/roles.ts`: play and buy role assignment over
  the adjusted pool with floors, fallback caveats, and per-role batches.
- Buy saturation check (fresh 80%+ offers, 3-plus and 20% thresholds).
- Run context gains batches and saturation (additive; load-bearing for
  12c-e-b rotation).
- `recordRunExposure` items carry an optional role (completes the 12c-b
  payload contract `{ role?: string }`), wired from run items.
- Role labels on Today for both engines and a role chip on the wishlist
  detail buy card; pre-12c-e runs (role null) render exactly as today.

## Out of scope

- `Show another` rotation, exposure cooldowns, ROTATION event emission, and
  Start-playing with main-game handling (12c-e-b): this feature retains the
  batches they consume but ships no interaction on top.
- Any change to eligibility, baseline points, re-rank magnitudes, tiebreak
  order, or the cold-start selector's diversity logic (its pick count changes
  from 3 to 4 for play only, per the role count).
- Tune-this-run and presets (12c-f), dismissal calibration (12d), Today
  dashboard composition (13).

## Data / contracts (load-bearing)

### Role enum

`BEST_FIT_1`, `BEST_FIT_2`, `OUT_OF_THE_BOX`, `CHANGE_OF_PACE`, `DEAL`.
`RecommendationItem.role` is nullable: rows from older runs have no role and
the UI treats them as unlabeled results.

### Play role assignment

Four roles over the adjusted pool (re-ranked order), never overlapping:

1. `BEST_FIT_1`, `BEST_FIT_2`: the first two pool entries. No floor.
2. `OUT_OF_THE_BOX`: the first remaining entry whose effective environment
   status is `READY` (the same resolved `envStatus` the environment-fit factor
   uses). ROM-only and unknown-status candidates do not qualify. If none
   remains, the best remaining entry takes the role with the
   `role_fallback` caveat "No ready-to-play candidate left for this role".
3. `CHANGE_OF_PACE`: the remaining entry with the lowest nonzero taste points
   (most contrary to learned taste). Only in `RERANKED` mode; in cold start,
   or when every remaining taste points value is zero, the best remaining
   entry takes the role with the caveat "No taste signal yet for a change of
   pace".

A role with no remaining candidate at all (fewer eligible entries than roles)
is simply absent from the run: runs may carry one to four play items.

Cold start assigns roles to the four diversified picks in pick order (the
selector limit becomes 4 for play): picks 1-2 are the best-fit roles,
out-of-the-box applies its `READY` floor across picks with the same fallback,
change-of-pace always takes its fallback caveat (no taste basis).

### Buy role assignment and saturation

- Saturation check over eligible wishes: count wishes whose selected cheapest
  offer is fresh (existing 48-hour window) with `discount >= 80`. Saturated
  when the count is 3 or more and at least 20% of eligible wishes (guard the
  share against zero eligible wishes; unsaturated). Stored in
  buy context as `saturation: { saturated, fresh80Count, eligibleCount }`.
- Normal: `BEST_FIT_1`, `BEST_FIT_2` (top adjusted), `DEAL` (one). Saturated:
  `BEST_FIT_1`, two `DEAL` items (ordered by discount).
- Deal floors: quality = selected offer fresh and not keyshop (no
  `stale_offer`/`keyshop` caveat); fit = `interest >= 2` or positive taste
  points. Highest fresh discount wins. If no remaining candidate meets the
  floors, the best remaining entry takes the role with the `role_fallback`
  caveat "No offer met the deal floor".
- Roles pick from remaining candidates after higher roles claim theirs; a
  candidate fills at most one role.

### Batches in run context (consumed by 12c-e-b)

```ts
context.roles = {
  batches: Record<RecommendationRole, string[]>, // candidate ids, role order
  saturation?: { saturated: boolean; fresh80Count: number; eligibleCount: number },
};
```

- Batches exclude every currently displayed candidate and are ordered per
  role: best-fit batches in adjusted order, out-of-the-box in adjusted order
  filtered to `READY`, change-of-pace ascending by taste points, deals by
  fresh discount descending. A candidate may appear in several batches (it is
  the display set, not the batches, that must not overlap).
- Play run context gains `roles` for both modes; buy context gains `roles`
  with `saturation` only on buy runs.

### Exposure payload

`recordRunExposure` items gain optional `role`, validated as a
`RecommendationRole` value when present and written into the event `payload`
as `{ role }`. The Today tracker passes each item's role from the run rows.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Schema and migration** - add `RecommendationRole` and the
  nullable `role` column to `RecommendationItem`; run `pnpm prisma:migrate`.
  *Done when:* `pnpm prisma migrate status` reports up to date and
  `pnpm typecheck` is green.
- [x] **Step 2 - Play role assignment** - `roles.ts`: non-overlapping
  assignment with floors, fallback caveats, and per-role batches over an
  adjusted pool; cold-start pick-order assignment with the 4-item limit.
  *Done when:* tests cover floor satisfaction and fallback, change-of-pace
  picking lowest nonzero taste, non-overlap, batch ordering and display-set
  exclusion, cold-start pick-order roles, pool exhaustion leaving roles
  unfilled, and `pnpm test` is green.
- [x] **Step 3 - Buy saturation and role assignment** - the saturation check
  with both thresholds and deal selection with quality/fit floors in both
  saturated and normal shapes.
  *Done when:* tests cover the threshold boundaries (2 vs 3 fresh 80+ offers,
  19% vs 20% share, zero eligible wishes), deal floor enforcement and
  fallback, the 1+2 shape under saturation, discount ordering of two deals,
  and `pnpm test` green.
- [x] **Step 4 - Engine and action wiring** - `rerankPlayCandidates` and
  `rerankBuyCandidates` also return the full adjusted pool with per-candidate
  `tastePoints` (and `deal` inputs for buy: fresh discount, keyshop flag);
  the action assigns roles, writes `role` on run items, adds `roles` to both
  contexts (plus `saturation` on buy), and extends `recordRunExposure` with
  the optional role.
  *Done when:* action tests show items persisted with roles in display order
  (4 play, 3 buy), context batches matching the assignment, old context keys
  intact, and exposure rows carrying `{ role }`; `pnpm test` green.
- [x] **Step 5 - Role labels** - a small role-to-label map and grouping on
  Today (play: Best fit, Out of the box, Change of pace; buy: Best fit, Deal),
  a role chip on the wishlist detail buy card, and the role prop threaded
  through the tracker. Pre-role runs render unchanged.
  *Done when:* a manual walkthrough shows grouped labeled roles for a fresh
  run and the old unlabeled layout for a pre-migration run; build green.
- [x] **Step 6 - Verification** - manual pass: run `Update recommendations`,
  confirm four labeled play roles and three buy items, inspect
  `context.roles` batches in Prisma Studio, and create a fresh 80%+ offer
  situation (edit one wish's offers in dev data) to see the saturated 1+2
  shape and `saturation` context. `pnpm build` and `pnpm test` green.

## Files / areas

- `prisma/schema.prisma` + new migration
- `src/lib/recommendations/roles.ts` (new) + `roles.test.ts` (new)
- `src/lib/recommendations/rerank.ts` (+ test): pool return, taste points,
  deal inputs, cold-start limit 4
- `src/lib/recommendations/types.ts`: role type, context additions
- `src/actions/recommendations.ts` (+ test): wiring, item roles, context,
  exposure role
- `src/components/recommendations/RunExposureTracker.tsx`: role passthrough
- `src/app/(app)/today/page.tsx` and a small roles label component
- `src/app/(app)/wishlist/[id]/page.tsx`: role chip on the buy card

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `roles.ts`: play floors/fallbacks/batches, cold-start assignment, buy
  saturation boundaries, deal floors, both buy shapes.
- `rerank`/`recommendations` tests: pool return shape, persisted roles,
  context additions, exposure payload.
- UI steps (5) and the walkthrough (6) ride on the running app plus the
  build.

## Notes for the AI

- Single-user app: `requireUser()` at action entries; follow
  `{ success, data, error }`; Zod-validate the extended exposure input.
- Do not touch baseline scoring, re-rank magnitude constants, eligibility, or
  the cold-start genre-diversity logic; 12c-d tests are the guard. The only
  cold-start change is the play pick count (3 to 4).
- Role assignment reads the adjusted pool once and never rescores; if a rule
  seems to need a new score, stop and re-read the spec.
- `role` is nullable by design: never backfill old rows, and guard every
  consumer for null.
- Batches are ids only; resolving names/targets at rotation time is 12c-e-b's
  job.
- Branch: `feature/recommendation-roles-batches-saturation`.

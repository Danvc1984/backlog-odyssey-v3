# Feature: Calibration from dismissal counters and true refresh

**From build-plan:** feature 12d
**Status:** complete

## Goal

Make repeated dismissals matter and make `Update recommendations` feel fresh.
Calibration is computed, never written back: both engines score with an
adjusted interest derived from durable per-target dismissal counters (one
interest point per three cumulative dismissals of the same recommendation
type, floor 0), and the game and wishlist detail pages explain the adjustment.
New runs additionally exclude candidates shown or rotated within the exposure
cooldown, so consecutive updates rotate in different games while the pool
allows, with a thin-pool fallback so the list never starves. No schema
migration; calibration counters already have a durable home.

## In scope

- `src/lib/recommendations/calibration.ts`: adjusted-interest math and the
  calibration explanation factor.
- Engine wiring: feedback counts per target and kind, calibrated interest
  into both engines' candidate inputs, calibration factors.
- Calibration explanations on the game detail and wishlist detail pages.
- A stale-exposure filter applied to the candidate pool at run creation
  (both engines), reusing the 7-day exposure cooldown, with a context count
  for observability.

## Out of scope

- Write-back calibration: stored `interest` on `LibraryEntry`/`WishlistEntry`
  is never mutated by this feature; the user-entered value stays exactly as
  edited.
- Cooldown effects on scoring: exclusion only, never a score penalty; the
  profile and preferences are untouched by the filter.
- Dismissal-based exclusion: a dismissed item hides only during its current
  run (existing behavior); it may return in later runs, gradually lowered by
  calibration.
- Counting `DISMISSAL` events for calibration: events prune after 12 months;
  counters come exclusively from `RecommendationFeedback` rows, which nothing
  prunes on a schedule.
- Today dashboard composition (13), settings/export (17).

## Data / contracts (load-bearing)

### Calibration

- Counter source: `RecommendationFeedback` rows per `(gameId | wishlistEntryId,
  kind)` — `PLAY_NEXT` counters for play candidates, `BUY` counters for
  wishes. Rows accumulate per dismissal click and are removed only by
  `Restart recommendations` (already deletes them), which lifts calibration.
- `CALIBRATION_DISMISSALS_PER_POINT = 3`; `CALIBRATION_POINTS_PER_INTEREST = 10`.
- `calibratedInterest(interest, count)`: null interest stays null (no signal
  to adjust); otherwise `max(0, interest - floor(count / 3))`.
- When adjusted is below the entered interest, the engines receive the
  calibrated value and a negative `calibration` factor explains it:
  `Dismissed N times` with points `-(entered - adjusted) * 10`. Shown points
  always equal applied points; the baseline interest factor label shows the
  adjusted value (e.g. "Interest 4" for an entered 5).
- One interest point is worth 10 baseline points (interest x10), so each
  three-dismissal step visibly outweighs single small factors while still
  below a full interest level change per step.

### Detail-page explanation

- Game detail (near the personal fields) and wishlist detail (near the
  interest stars) show a note only when `interest != null` and
  `floor(count / 3) > 0`: "Interest shown as adjusted: you dismissed this
  recommendation N times (5 -> 4)." Adjusted 0 displays the floor
  ("(5 -> 0)").
- Counts are read per page load from the indexed feedback rows; no new
  tables, no caching.

### True refresh (stale-exposure filter at run creation)

- Reuses `EXPOSURE_COOLDOWN_DAYS = 7`. A candidate's last exposure is the
  newest `EXPOSURE` or `ROTATION` event targeting it.
- Applied to the re-rank pool before scoring and role assignment, for both
  engines and both modes: if the non-stale candidates fill the display count
  (4 play, 3 buy), stale candidates are excluded entirely; otherwise stale
  candidates stay, ordered oldest-exposure-first (never-exposed counts as
  oldest), so role picks and rotation batches naturally prefer fresh games.
- Exposure events are written when a run is displayed (run-mount tracker),
  so refreshing repeatedly without viewing in between shows the same picks:
  the refresh is against what was actually shown.
- `context.staleExcluded` records how many candidates the filter removed
  (additive; existing context keys unchanged).
- Batches derive from the filtered pool, so rotation (12c-e-b) cannot offer
  a stale candidate either; its own per-pick cooldown check remains as the
  second guard.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Calibration lib** - `calibration.ts` with the constants,
  `calibratedInterest`, and the factor builder; add
  `CALIBRATION_DISMISSALS_PER_POINT`/`CALIBRATION_POINTS_PER_INTEREST` to the
  recommendation types.
  *Done when:* tests cover 0/2/3/6/9 dismissals (0, 0, -1, -2, -3 steps),
  the floor at 0, null interest passthrough, and the factor appearing only
  when adjustment is nonzero; `pnpm test` green.
- [x] **Step 2 - Engine wiring** - grouped feedback counts for the eligible
  candidates in both engines; calibrated interest replaces the raw value in
  the candidate inputs; calibration factors appended to negatives.
  *Done when:* action tests show a 3-dismissal play candidate scoring 10
  lower with the factor and adjusted label, a 6-dismissal wish dropping two
  steps, floor 0 clamping, null interest untouched, and kind isolation
  (PLAY_NEXT dismissals do not affect BUY counters); `pnpm test` green.
- [x] **Step 3 - Detail-page explanations** - the calibration note on the
  game detail personal-fields area and the wishlist detail interest row,
  with counts loaded per page.
  *Done when:* a manual walkthrough dismisses one recommendation three times
  across runs and sees the note with the original-to-adjusted values on both
  pages, absent on an uncalibrated game; build green.
- [x] **Step 4 - Stale-exposure filter** - the filter helper over the pool
  with the fallback ordering, wired before `rerankPlayCandidates`/
  `rerankBuyCandidates`; `context.staleExcluded` added.
  *Done when:* tests cover the 7-day boundary (fake timers), full exclusion
  when the fresh pool fills the display count, fallback inclusion ordered
  oldest-exposure-first when it does not, and both engines plus cold start
  getting the filtered pool; `pnpm test` green.
- [x] **Step 5 - Verification** - manual pass: dismiss a play recommendation
  three times across three runs (adjusted interest and detail note visible),
  then run `Update recommendations` twice and confirm the play and buy picks
  change while the eligible pool allows, watching `context.staleExcluded`
  in Prisma Studio; then exhaust the pool (few eligible games) and confirm
  the fallback keeps the list full. `pnpm build` and `pnpm test` green.

## Files / areas

- `src/lib/recommendations/calibration.ts` (new) + `calibration.test.ts` (new)
- `src/lib/recommendations/types.ts`: constants
- `src/actions/recommendations.ts` (+ test): counters, wiring, filter
- `src/app/(app)/games/[id]/page.tsx` + a small note component: explanation
- `src/app/(app)/wishlist/[id]/page.tsx`: explanation

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `calibration.ts`: step math, floor, null, factor presence.
- `recommendations.ts`: both engines' calibrated scoring and factors, kind
  isolation, stale filter boundaries and fallback, context additions.
- UI step (3) and the walkthrough (5) ride on the running app plus the build.

## Notes for the AI

- Single-user app: `requireUser()` at action entries; follow
  `{ success, data, error }`.
- The counter source is `RecommendationFeedback` and only that; never count
  `DISMISSAL` events for calibration (they prune), and never prune feedback
  rows on a schedule. `Restart recommendations` deleting them is the only
  reset path.
- Do not mutate `LibraryEntry.interest` or `WishlistEntry.interest` anywhere
  in this feature; if a write-back seems needed, stop and re-read the spec.
- The `calibration` factor key already exists in `ExplanationFactorKey`; do
  not add a new one.
- Feedback counts are one grouped query per run; no per-candidate queries.
- The stale filter never scores or penalizes: exclusion and ordering only.
- Branch: `feature/dismissal-calibration-true-refresh`.

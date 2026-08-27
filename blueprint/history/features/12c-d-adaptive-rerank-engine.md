# Feature: Adaptive re-ranking engine

**From build-plan:** feature 12c-d
**Status:** not started

## Goal

Re-rank the deterministic baseline with the taste layer 12c-c shipped: profile
signals and `PREFER`/`NEUTRAL`/`AVOID` overrides, plus Steam activity,
environment fit, and quality signals, all with uncertainty safeguards (support
scaling, per-family caps, absence never penalizes) and a cold-start mode that
diversifies by genre and labels its limited basis. Baseline scoring stays the
primary driver: re-ranking adjusts, it never replaces. No schema migration;
this feature consumes existing storage.

## In scope

- New `src/lib/recommendations/rerank.ts`: candidate dimension resolution,
  taste scorer (profile + preferences), Steam activity / environment fit /
  quality scorers, clamps, cold-start selector.
- Shared dimension-value resolution extracted from `profile.ts` so the rebuild
  and the re-ranker read metadata identically.
- Wiring into `updateRecommendations` for both engines, with re-ranked
  ordering, merged explanation factors, and run-context mode flags.
- New explanation factor keys and a cold-start note on `/today`.
- Run context records the re-rank mode and applied factor counts (load-bearing
  for 12c-e's retained batches and roles).

## Out of scope

- Roles (best fit / out-of-the-box / change-of-pace), qualified candidate
  batches, `Show another` rotation, exposure cooldowns, deal saturation, and
  Start-playing (12c-e).
- Tune-this-run soft preferences and presets (12c-f): they will filter or
  weight the candidate pool before this engine runs; no hook is built yet.
- Dismissal-counter calibration (12d).
- Compatibility evidence factors: the baseline already applies
  `buildCompatContext` factors and caveats and they are unchanged. The only
  new compat-adjacent signal here is environment fit against the user's
  preferred environment; compat is never double-counted.
- Steam activity signals for buy candidates and environment signals for
  wishes: wishes carry no availability or environment of their own, and the
  base game's ownership affinity is already the DLC factor.
- Changes to eligibility rules, baseline point values, tiebreak semantics, or
  run retention.

## Data / contracts (load-bearing)

### Re-rank magnitude contract

Baseline points keep their current values (interest x10 dominates). Re-rank
adjustments are bounded:

| Signal             | Points                                                               |
| ------------------ | -------------------------------------------------------------------- |
| Derived taste      | per dimension: `clamp(weight x min(1, support/2), -3, +3)`            |
| `PREFER` override  | +4 once per dimension where any candidate value matches               |
| `AVOID` override   | -6 once per dimension where any candidate value matches               |
| `NEUTRAL` override | vetoes that dimension's derived contribution (no points)              |
| Taste total        | strongest-first until the combined taste adjustment reaches +/-12     |
| Steam activity     | +2 when a replay/abandoned candidate's `steamLastPlayed` is within 180 days |
| Environment fit    | READY +2, `READY_WITH_TINKERING` +1, `FALLBACK_RECOMMENDED` -2, `REQUIRED` -3, else 0 |
| Quality            | +2 metacritic >= 85, +1 RAWG rating >= 4.5, -1 metacritic < 55; clamped +/-3 |

- Override conflicts on one dimension resolve deterministically: `AVOID` beats
  `PREFER` beats `NEUTRAL` (safe by default). The `[dimension, value]` unique
  constraint does not prevent two values of one dimension holding different
  attitudes.
- The taste cap drops lowest-|points| contributions last; shown points always
  equal applied points. Steam, environment, and quality are outside the taste
  cap but each bounded above.
- Derived weights come straight from the 12c-c profile payload (decayed sums);
  no new decay math here.
- Support scaling means a single event moves a value at half strength; two or
  more at full strength. Absent evidence contributes nothing and never
  penalizes; a candidate with no resolvable metadata simply gets no taste
  factors.

### Candidate dimension values

Resolved by one shared function extracted from `profile.ts` (same sources the
rebuild reads): genres, tags, first publisher, era bucket, duration band,
maturity name, series sibling names from a v2 RAWG payload, plus
`gameExperience` and, for catalog games, `preferredEnvironment`. v1 payload
rows lack `esrbRating`/`seriesGames` and contribute no maturity/series values.
When several events feed one dimension the rebuild already merged them; the
re-ranker only reads the aggregate.

### Cold-start mode

Triggered for an engine when the profile's `evidence.eventsConsidered` is
below `COLD_START_MIN_EVENTS` (5) or every taste dimension is empty. In
cold-start mode no taste, preference, or quality factors are applied
(there is no trustworthy basis for them); the engine still applies baseline
points, Steam activity, and environment fit, and selection greedily diversifies
across genres: walk the baseline-ordered eligible pool, take an item, and skip
a later item that shares a genre with an already-picked item whenever an
unpicked item with a different genre remains. Every selected item carries a
`limited_basis` caveat: "Cold start: limited history, showing a varied mix".
Run context records `mode: "COLD_START"`.

### Run context (additive, consumed by 12c-e)

```ts
context.rerank = {
  mode: "RERANKED" | "COLD_START",
  applied: { taste: number, steam: number, environment: number, quality: number },
};
```

Counts are how many candidates received a nonzero factor of each family.
Baseline runs keep their existing context fields; nothing is removed.

### Explanation factor keys (new)

`taste_profile` (one factor per contributing dimension, label naming the
value, e.g. "RPG affinity"), `preference` ("You avoid Mature" / "You marked
Couch gaming as preferred"), `steam_recent`, `environment_fit`, `quality`,
plus the `limited_basis` caveat. `FactorChips` renders generically by point
sign, so no chip changes are needed.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Shared resolution and types** - extract
  `resolveCandidateDimensionValues(payload, personal)` from `profile.ts`
  (rebuild refactored onto it, behavior unchanged), add the re-rank types and
  the magnitude constants from the tables above, and extend
  `ExplanationFactorKey` with the new keys.
  *Done when:* `profile.test.ts` still passes untouched, new resolution tests
  cover v2 and v1 payloads and personal fields, and `pnpm test` is green.
- [x] **Step 2 - Taste scorer** - `rerank.ts`: per-dimension derived
  contributions with support scaling and the +/-3 clamp, override application
  with conflict order and `NEUTRAL` veto, strongest-first +/-12 cap with
  factor generation (`taste_profile`, `preference`).
  *Done when:* tests cover support scaling at 1 and 2+ events, the +/-3 clamp,
  veto, override conflict order, the cap dropping weakest contributions, and
  zero-evidence candidates getting nothing; `pnpm test` green.
- [x] **Step 3 - Steam, environment, and quality scorers** - the three pure
  functions with their point rules and guards (null/absent inputs yield no
  factor; quality clamped).
  *Done when:* boundary tests for each (179/180 days for Steam recency,
  every compat status, metacritic 54/55 and 84/85, rating 4.4/4.5);
  `pnpm test` green.
- [x] **Step 4 - Cold-start selector** - mode resolution from profile evidence
  plus the greedy genre-diverse selection over the baseline-ordered pool with
  `limited_basis` caveats.
  *Done when:* tests cover the threshold, diversity skipping (shared genre
  skipped while a different-genre item remains), fallthrough when variety is
  exhausted, and factor suppression in cold-start mode; `pnpm test` green.
- [x] **Step 5 - Play engine wiring** - `loadCandidates` gains
  `gameExperience`, `preferredEnvironment`, the latest RAWG snapshot,
  `steamPlaytimeTotal`/`steamLastPlayed`, and `envCompat`; the action builds
  views, applies taste/aux scorers or the cold-start selector, and sorts by
  adjusted score with the existing name tiebreak before the top-3 slice. Buy
  run untouched in this step.
  *Done when:* action tests show a reordered pool with merged factors and
  points, context carrying `rerank`, baseline-only behavior when the profile
  is empty, and unchanged eligibility; `pnpm test` green.
- [x] **Step 6 - Buy engine wiring** - `loadBuyCandidates` gains
  `gameExperience` and the wish's RAWG snapshot; the buy tiebreak comparator
  is exported from `buy.ts` and reused to sort by adjusted score; cold-start
  diversification applies to the buy pool the same way (genres from the wish
  payload).
  *Done when:* action tests show re-ranked buy items with taste/quality
  factors, the tiebreak chain preserved for equal adjusted scores, and
  DLC wishes resolving taste through their own snapshot;
  `pnpm test` green.
- [x] **Step 7 - Today cold-start note and verification** - small server note
  above the play-next section when the latest play run's context mode is
  `COLD_START`; then a manual walkthrough: run `Update recommendations` and
  confirm re-ordered results with new factor chips, add a preference in
  Settings, re-run and see the `preference` factor, then `Restart
  recommendations`, re-run, and see the cold-start note, varied picks, and
  `limited_basis` caveats.
  *Done when:* the walkthrough shows each behavior in the running app and
  `pnpm build` and `pnpm test` are green.

## Files / areas

- `src/lib/recommendations/rerank.ts` (new) + `rerank.test.ts` (new)
- `src/lib/recommendations/profile.ts` (+ test): resolution extraction
- `src/lib/recommendations/types.ts`: factor keys, re-rank types, constants
- `src/lib/recommendations/buy.ts` (+ test): comparator export
- `src/actions/recommendations.ts` (+ test): loading, view building, wiring
- `src/app/(app)/today/page.tsx` + a small note component: cold-start label

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `rerank.ts`: resolution (v1/v2), taste math (scaling, clamps, veto,
  conflict order, cap), aux scorers' boundaries, cold-start selector and mode.
- `profile.test.ts`: unchanged behavior after the extraction.
- `recommendations.test.ts`: both engines re-rank, merge factors, record
  context, preserve eligibility and baseline values; cold-start path.
- Step 7 rides on the running app plus the build.

## Notes for the AI

- Single-user app: `requireUser()` at action entries; follow
  `{ success, data, error }`; no per-user scoping.
- Do not modify baseline scoring functions' existing contracts; 12a/12b tests
  are the guard. Export what the re-ranker needs (buy comparator) instead of
  duplicating tiebreak logic.
- The re-ranker is a pure consumer of the profile payload and preference rows;
  never write to either from it.
- Preference matching is exact string equality against canonical values; do
  not normalize case.
- No schema migration: profile, preferences, snapshots, availability, and
  envCompat all exist. If a migration seems needed, stop and re-read the spec.
- Keep the build plan's "without letting discounts alone decide" out of this
  feature: offer points are unchanged; saturation is 12c-e.
- Branch: `feature/adaptive-rerank-engine`.

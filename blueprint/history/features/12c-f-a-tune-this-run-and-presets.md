# Feature: Tune-this-run and presets

**From build-plan:** feature 12c-f-a (first half of 12c-f)
**Status:** not started

## Goal

Add the opt-in Tune-this-run layer: a per-engine soft preference context
(experience, length, genres/tags, sequel posture, era, casual/mature) that
weights the candidate pool before the baseline runs, with the thin-pool case
explained rather than hidden. Tuning persists per engine so the panels and
the existing `Update recommendations` button stay decoupled, and named
`RecommendationPreset` rows save, load, and delete whole tune contexts. No
change to baseline scoring, re-rank magnitudes, role assignment, rotation, or
eligibility; tune is one bounded pre-baseline adjustment.

## In scope

- `TuneContext` type, Zod schema, and persistence: a
  `RecommendationTuneState` singleton (play and buy tune) and a
  `RecommendationPreset` model (unique name, tune payload), migration.
- Tune matching and weighting lib with the thin-pool helper.
- `updateRecommendations` wiring: tune points into the pool before
  re-ranking, `tune_match` factors, thin-pool caveats, and the applied tune
  recorded in run context.
- Tune state and preset server actions (save, clear, load, delete).
- Two tune panels on Today (above each engine) with preset controls, and a
  known-values helper feeding the genre/tag selects.
- `restartRecommendations` extension: presets and tune state join the reset.

## Out of scope

- Taste setup (12c-f-b): the guided flow, `TASTE_SETUP_ANSWER` events, and
  personal field writes. The profile already honors those event weights.
- Hard filtering: tune never removes candidates from the pool; matching is a
  bounded bonus and non-matching candidates stay eligible.
- Sequel posture changes to scoring beyond the tune bonus; the posture is a
  match test only.
- Rotation and Start-playing (12c-e-b, shipped): tune applies only when a
  run is created; rotated-in items keep the run's original context.
- Today dashboard composition (13), calibration (12d).

## Data / contracts (load-bearing)

### Tune context

```ts
interface TuneContext {
  experience: GameExperience | null; // PC_GAMING, MULTIPLAYER_COOP, COUCH_GAMING, ON_THE_GO
  length: "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG" | null;   // duration band keys
  genres: string[];  // RAWG genre names, any-match
  tags: string[];    // RAWG tag names, any-match
  sequelPosture: "SEQUEL" | "STANDALONE" | null;
  era: "PRE_2005" | "Y2005_2014" | "Y2015_2019" | "Y2020_PLUS" | null;
  maturity: "CASUAL" | "MATURE" | null;
}
```

- Zod schema is strict; unknown keys reject; canonical values only (no
  free-form strings beyond genre/tag names).
- Maturity mapping: `CASUAL` = ESRB Everyone or Everyone 10+; `MATURE` = Teen,
  Mature, or Adults Only; any other or missing rating matches neither.
- Sequel posture: `SEQUEL` matches when `deriveSequelRelationship` from 8e
  returns at least one sequel for the candidate (payload `releaseDate` +
  `seriesGames`); `STANDALONE` matches when `seriesGames` is empty. v1
  payloads (no `seriesGames` key) match `STANDALONE`.

### Weighting and thin pool

- Each matched criterion adds `TUNE_MATCH_POINTS = 5`; the total is capped at
  `TUNE_TOTAL_CAP = 10`. Non-matching candidates get nothing: soft preference,
  no penalty, no exclusion.
- The bonus joins the pool before re-ranking as its own `tune_match` factor
  (label naming the tuned criteria, e.g. "Tuned for Couch gaming"), so shown
  points always equal applied points and 12c-d's magnitude contract is
  untouched. Tune applies in both re-rank modes: it is explicit user intent
  for this run, not profile inference, so cold start does not suppress it.
- Thin pool: when the number of candidates matching at least one criterion is
  below the engine's display count (4 play, 3 buy), `context.tune.thinPool`
  is true and non-matching displayed items carry the `tune_thin_pool` caveat
  "Only N candidates match your tune". Matching items show no caveat.

### Persistence and reset

```prisma
model RecommendationTuneState {
  id      Int  @id @default(1)
  playTune Json?
  buyTune Json?
  updatedAt DateTime @updatedAt
}

model RecommendationPreset {
  id        String   @id @default(cuid())
  name      String   @unique
  tune      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- Tune state is a singleton upsert (`id = 1`, WallpaperState pattern) with
  one optional tune per engine; `null` means untuned. It persists until
  changed or cleared, so panels and the update button do not share client
  state.
- `saveRecommendationPreset` upserts by unique name; loading a preset writes
  it into that engine's tune state; deleting is by id.
- `restartRecommendations` now deletes presets and tune state alongside the
  five existing tables.

### Run context

Additive: `context.tune = { play: TuneContext | null, buy: TuneContext |
null, thinPool: boolean }` on the run it applied to. Rotation, cooldowns, and
role batches are untouched.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Schema, types, and reset** - `RecommendationPreset`,
  `RecommendationTuneState`, migration; `TuneContext` type and Zod schema in
  the recommendation types; `restartRecommendations` deletes both new tables.
  *Done when:* `pnpm prisma migrate status` is clean, `pnpm typecheck` green,
  and the reset test shows seven tables emptied.
- [x] **Step 2 - Tune matching lib** - `src/lib/recommendations/tune.ts`:
  per-criterion matchers (experience, duration band, era, genres/tags
  any-match, maturity mapping, sequel posture via `deriveSequelRelationship`),
  the capped scoring, and the thin-pool counter.
  *Done when:* tests cover each matcher (maturity mapping including Teen,
  posture with v1 payloads and missing releaseDate), the 5-point/10-cap math,
  zero-criteria tunes scoring nothing, and the thin-pool threshold against
  the 4/3 display counts; `pnpm test` green.
- [x] **Step 3 - Run wiring** - the action loads tune state, resolves
  candidate match inputs from the rows it already parses, adds tune points to
  the pool scores with `tune_match` factors before re-ranking, adds
  thin-pool caveats, and records `context.tune`.
  *Done when:* action tests show a tuned run reordering candidates with the
  factor present, an untuned run byte-identical in behavior to today, the
  thin-pool caveat on non-matching displayed items, and `context.tune`
  recorded; `pnpm test` green.
- [x] **Step 4 - Tune and preset actions** - `saveTuneState(engine, tune)`,
  `clearTuneState(engine)`, `saveRecommendationPreset({ name, tune })`
  (upsert on name), `deleteRecommendationPreset({ id })`, and a
  `listKnownGenreTagValues` helper (distinct genre and tag names across RAWG
  catalog and wishlist snapshots, sorted).
  *Done when:* action tests cover per-engine save/clear, upsert-overwrite of
  a preset name, deletion, validation rejections, and the distinct-values
  helper; `pnpm test` green.
- [x] **Step 5 - Tune panels** - a client panel above each engine on Today:
  the selects (fixed option lists plus the genre/tag multi-select fed by
  `listKnownGenreTagValues`), Save tune, Clear tune, and the thin-pool note
  rendered from the latest run's context. Untuned state shows the collapsed
  panel with an "Opt-in" hint.
  *Done when:* a manual walkthrough saves a tune for each engine, runs
  `Update recommendations`, sees the `tune_match` factor and the thin-pool
  note when applicable, clears, and the build is green.
- [x] **Step 6 - Preset controls** - inside each panel: save current tune
  under a name, list existing presets, load one into that engine (writes tune
  state, panel reflects it), delete.
  *Done when:* a manual walkthrough saves, loads, overwrites, and deletes a
  preset with rows verified in `pnpm prisma studio`; build green.
- [x] **Step 7 - Verification** - manual pass: tune play for a narrow genre
  and buy for length `SHORT`, run updates, confirm reordering, factors, and
  `context.tune`; restart recommendations and confirm presets and tune state
  are gone (seven-table reset). `pnpm build` and `pnpm test` green.

## Files / areas

- `prisma/schema.prisma` + new migration
- `src/lib/recommendations/tune.ts` (new) + `tune.test.ts` (new)
- `src/lib/recommendations/types.ts`: `TuneContext`, constants, factor keys
- `src/actions/recommendations.ts` (+ test): wiring, tune/preset actions,
  reset extension
- `src/components/recommendations/TuneThisRunPanel.tsx` (new, client)
- `src/app/(app)/today/page.tsx`: panels above each engine

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `tune.ts`: matcher matrix (including maturity mapping and posture edges),
  capped scoring, thin-pool counting.
- `recommendations.ts`: tuned vs untuned run behavior, factors and caveats,
  `context.tune`, tune state and preset actions, seven-table reset.
- UI steps (5 and 6) and the walkthrough (7) ride on the running app plus the
  build.

## Notes for the AI

- Single-user app: `requireUser()` at action entries; Zod-validate tune and
  preset inputs; follow `{ success, data, error }`.
- Tune is opt-in and soft: never exclude, never penalize, never touch
  eligibility or role assignment. If a rule seems to need a hard filter,
  stop and re-read the spec.
- The weighting joins before re-ranking by adding to the pool score with its
  own factor; do not fold it into baseline scoring functions (12a/12b/12d
  tests are the guard).
- Genre/tag values are canonical RAWG names from snapshots; the same string
  match rule as the profile and preferences applies.
- Preset and tune-state payloads are versionless JSON; if the tune shape ever
  changes, migrate leniently (drop unknown fields) rather than crash.
- `deriveSequelRelationship` stays an 8e helper; tune only consumes it.
- Branch: `feature/tune-this-run-presets`.

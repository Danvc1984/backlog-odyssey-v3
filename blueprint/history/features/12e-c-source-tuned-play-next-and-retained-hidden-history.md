# Feature: Source-tuned play-next and retained hidden history

**From build-plan:** feature 12e-c
**Status:** not started

## Goal

Close out the source-aware recommendation work. Tune-this-run gains inclusive,
modest source boosts (Steam, ROM, any or specific alternative sources) with
visible icon-decorated explanations on matching play-next cards, buy behavior
stays untouched, the separation between hidden-game eligibility and retained
play history is locked by tests, and unhidden abandoned replay candidates
become explained, low-priority Out-of-the-Box second chances instead of
ordinary competitors.

## Design reference

None. Functional UI under the current look; feature 14 owns visual redesign.

## In scope

- `TuneContext` extension: an optional `sourceTune` block (Steam, ROM, all
  alternatives, or selected alternative-source IDs) stored in the existing
  play tune state and play presets JSON, backward-compatible with stored v1
  contexts.
- Source matching in the play pipeline: a modest additive boost for eligible
  games whose availability rows match the selected sources, applied where the
  existing tune weighting applies, with non-matching games kept in the pool.
- Source explanations on Today play cards: the factor lists matched source
  names and the card renders each source's icon beside the text.
- Tune-this-run play panel: a Sources section with the built-ins, the
  all-alternatives choice, and one icon-decorated checkbox per saved active
  alternative source.
- Out-of-the-Box second chances: abandoned plus replay-flagged games no
  longer compete for best-fit or change-of-pace roles; they fill
  Out-of-the-Box only when no other candidate does, always with an
  explanation caveat, and join the Out-of-the-Box rotation batch.
- Test locks for retained hidden history: hidden games stay ineligible while
  their completion and abandonment events still feed the profile.
- Unit tests for all new logic (Vitest gate is on).

## Out of scope

- Buy recommendations and pricing: the buy pipeline never applies the source
  boost, the buy tune panel shows no Sources section, and seller ranking and
  price comparison are untouched.
- Any automatic run triggering; source tuning applies only on explicit
  `Update recommendations` runs.
- Schema or migration changes: tune contexts and presets stay JSON.
- Source selection and availability UI (12e-b, done), event recording paths
  (already ungated for hidden games), exposure cooldowns, calibration
  counters, role qualification floors, and Steam activity scoring.

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

- [x] **Step 1 - Tune context extension with v1 compatibility** - In
  `src/lib/recommendations/types.ts` add the `sourceTune` block
  (`{ steam: boolean; rom: boolean; allAlternatives: boolean;
  alternativeSourceIds: string[] }`, nullable) and the
  `SOURCE_TUNE_MATCH_POINTS` constant (3). Extend `tuneContextSchema` with the
  field as optional and nullable so every stored `playTune`, `buyTune`, and
  preset JSON without it still parses; `parseStoredTune` must not start
  returning null for existing saves. *Done when:* tests prove a v1 tune
  object without `sourceTune` parses unchanged and a v2 object round-trips;
  `pnpm test` and `pnpm typecheck` green.
- [x] **Step 2 - Source matching and boost** - In
  `src/lib/recommendations/tune.ts` add pure `matchSourceTune(sourceTune,
  candidateSources)` over `{ source, alternativeSourceId }[]`: inclusive OR
  across selections, a multi-source game matches every selected source it
  has, `allAlternatives` matches any alternative row, and a game with no
  availability rows matches nothing. Add `applySourceTune(pool, sourceTune,
  sourcesById)` mirroring `applyTune`: matched items gain
  `SOURCE_TUNE_MATCH_POINTS`, a `source_tune` positive factor labeled
  "Matches your source tune: Steam, Epic Games Store" carrying the matched
  `sourceNames`, and non-matching items stay in the pool unmodified. Add
  `source_tune` to `ExplanationFactorKey` and an optional serializable
  `sourceNames?: string[]` to `ExplanationFactor`. *Done when:* tests cover
  each selection combination, the multi-source list, the no-rows case, the
  empty-selection no-op, and the factor payload shape; `pnpm test` green.
- [x] **Step 3 - Play pipeline wiring and buy neutrality** - In
  `src/actions/recommendations.ts`: extend `loadCandidates` availability to
  include `alternativeSourceId` and the source name, build a per-candidate
  source view, and call `applySourceTune` on the play pool right after
  `applyTune` (before rerank). The buy pipeline gets no source call. The run
  context echoes the full tune automatically. An action test proves a
  source-tuned play run boosts a matching candidate and a buy run's scores
  are byte-identical with the same `sourceTune` present in stored state.
  *Done when:* `recommendations.test.ts` covers the play boost and buy
  neutrality; `pnpm test` and `pnpm typecheck` green.
- [x] **Step 4 - Tune panel Sources section** - Extend `TuneThisRunPanel`
  with a Sources section rendered only for `PLAY_NEXT`: checkboxes for Steam,
  ROM, and "Any alternative source", plus one checkbox per saved active
  alternative source with its `SourceIcon`. The Today page loads non-archived
  alternative sources and passes them to the play panel; the buy panel
  receives none. Save, clear, and preset flows persist `sourceTune`
  unchanged. *Done when:* manual walkthrough tunes play-next with Epic
  selected, runs `Update recommendations`, and sees an Epic-sourced game
  boosted with the matched-source chip; switching sources and re-running
  changes the boost; the buy panel shows no Sources section; `pnpm build`
  green.
- [x] **Step 5 - Icon-decorated source explanations** - In `FactorChips`
  render a `SourceIcon` beside the label for factors carrying `sourceNames`,
  resolving each name through `resolveSourcePresentation` (known labels get
  their registry icon, custom names the fallback icon, icons `aria-hidden`
  beside visible text). Factors without `sourceNames` render exactly as
  before. *Done when:* manual walkthrough shows the matched-source chip with
  icons on a boosted Today card; unrelated chips are visually unchanged;
  `pnpm build` green.
- [x] **Step 6 - Out-of-the-Box second chances** - Add
  `second_chance` to `ExplanationFactorKey`. Extend `assignPlayRoles` with an
  optional ordered `secondChances` id list (abandoned plus replay-flagged,
  ordered by the same calibrated baseline scoring as the main pool): while any
  primary candidate remains, second chances never take BEST_FIT_1, BEST_FIT_2,
  or CHANGE_OF_PACE; they fill OUT_OF_THE_BOX only when that role would
  otherwise be empty, always with a "Second chance: previously abandoned,
  flagged for replay" caveat; unconsumed second chances join the
  OUT_OF_THE_BOX batch after primary candidates; when the primary pool is
  completely empty they fill all roles so Today is not blank; the reserve
  holds in both RERANKED and COLD_START modes. Wire the split in
  `updateRecommendations` after exposure-cooldown filtering so recently shown
  second chances stay cooldown-excluded. *Done when:* `roles.test.ts` covers
  reserve behavior, the empty-primary fill, batch placement, and both modes,
  and an action test shows an abandoned replay game demoted out of best fit
  while others exist; `pnpm test` green.
- [x] **Step 7 - Hidden-history test locks** - Add focused tests: a hidden
  game is ineligible for play-next; its recorded COMPLETION and ABANDONMENT
  events still raise the matching profile dimensions in
  `rebuildRecommendationProfile` (event recording is already ungated in
  `game-detail.ts`, so no production change belongs here). *Done when:*
  `play-next.test.ts` and `profile.rebuild.test.ts` prove the separation;
  `pnpm test` green.
- [x] **Step 8 - Verification** - Run `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, and `pnpm prisma migrate status`. Manual pass:
  save a play tune with two alternative sources and verify boosted cards with
  icon chips, confirm a non-matching game still appears unboosted, load a
  preset across engines and confirm buy output never shifts, flag an
  abandoned game as a replay candidate with stronger games present and
  confirm it only surfaces as Out-of-the-Box with the second-chance caveat.
  *Done when:* all commands green and every observation above holds.

## Files / areas

- `src/lib/recommendations/types.ts`: `sourceTune`, points constant, factor
  keys, `sourceNames`
- `src/lib/recommendations/tune.ts` (+ test): source matching and boost
- `src/lib/recommendations/roles.ts` (+ test): second-chance reserve
- `src/actions/recommendations.ts` (+ test): pipeline wiring, buy neutrality,
  second-chance split
- `src/components/recommendations/TuneThisRunPanel.tsx`,
  `FactorChips.tsx`, `src/app/(app)/today/page.tsx`: Sources UI and chips
- `src/lib/recommendations/play-next.test.ts`,
  `profile.rebuild.test.ts`: hidden-history locks

## Data / contracts

Load-bearing: the tune context JSON shape is shared by stored tune state and
named presets, and run context echoes it; factors are persisted as JSON on
run items and must stay plain serializable data.

- `TuneContext.sourceTune`:
  `{ steam: boolean; rom: boolean; allAlternatives: boolean;
  alternativeSourceIds: string[] } | null`, optional in
  `tuneContextSchema` so v1 JSON keeps parsing. Present only in play usage;
  the buy engine ignores it even when a preset carries it.
- `SOURCE_TUNE_MATCH_POINTS = 3`, distinct from `TUNE_MATCH_POINTS` (5) to
  encode the "modest" boost.
- `matchSourceTune(sourceTune, candidateSources)` returning matched
  descriptors; matching is OR across selections and lists every matched
  source for multi-source games.
- `ExplanationFactor.sourceNames?: string[]` (optional, serializable); icons
  are derived client-side from names via `resolveSourcePresentation`, never
  stored.
- New `ExplanationFactorKey` values: `source_tune`, `second_chance`.
- `assignPlayRoles(pool, mode, secondChances?)` with the reserve invariant
  above; second chances are ordered by baseline scoring.
- Run context JSON: `tune.play` and `tune.buy` now may include
  `sourceTune`; readers must treat it as optional.
- No database schema changes.

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `types.ts`: v1 tune parse compatibility, v2 round-trip.
- `tune.ts`: selection combinations, multi-source matching, no-rows case,
  empty-selection no-op, factor payload.
- `recommendations.ts`: play boost applied, buy scores identical with a
  stored `sourceTune`, second-chance demotion.
- `roles.ts`: reserve placement, empty-primary fill, batch order.
- `play-next.test.ts` and `profile.rebuild.test.ts`: hidden eligibility and
  retained evidence.
- UI steps (4 and 5) and step 8 ride on the running app plus `pnpm build`,
  per the Browser Verification standard; no Playwright.

## Notes for the AI

- Single-user app: `requireUser()` at every action entry; Zod-validate all
  inputs; follow `{ success, data, error }`.
- The strict tune schema nulls stored contexts on any parse failure: the
  `sourceTune` field must remain optional and nullable, and step 1's
  compatibility test is the guard. Never "clean up" old stored JSON.
- Buy neutrality is absolute: no `applySourceTune` call in the buy pipeline,
  no Sources section on the buy panel, and step 3's byte-identical buy test
  is the regression guard.
- Inclusive means inclusive: non-matching eligible games always remain in
  the pool; source tuning never needs thin-pool relaxation and must not
  alter the existing tune thin-pool count.
- Second chances never apply to hidden games (eligibility already excludes
  them) and never carry a negative signal beyond the existing abandoned
  scoring.
- Keep factor payloads serializable; resolve icons from names in the client.
- No new package dependencies; `SourceIcon` and `resolveSourcePresentation`
  already exist from 12e-b.
- Branch: `feature/source-tuned-play-next`.

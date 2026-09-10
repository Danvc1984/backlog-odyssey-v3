# Feature: Handheld-aware fit and context (22b)

**From build-plan:** feature 22b
**Status:** not started

## Goal

The handheld-suitable flag from 22a becomes engine evidence: flagged games get
a modest handheld-fit boost in play and buy wherever the setup has a Linux
handheld, compatibility explanations frame the Linux handheld as the evidence
target on Windows-primary setups, and the Windows-handheld rescue lifts the
no-fallback hard exclusion for flagged games with a visible explanation while
non-flagged games keep today's exclusion and penalty byte-for-byte.

## Design reference

None. Engine and label work; the new factors and caveats render through the
existing run-item explanation surfaces (natural-language chips from 21b) and
the existing compatibility sections.

## Semantics (locked here)

1. **Handheld-fit boost.** When `handheldOs === "LINUX"` and the entry is
   flagged (`handheldSuitable === true`), both engines apply one positive
   `handheld_fit` factor with `HANDHELD_FIT_POINTS = 2` and the label
   "Marked as a handheld option". The boost is independent of primary OS and
   of compatibility evidence (on a Windows primary with a Linux handheld the
   env rerank factor stays null today; the boost is the signal that applies).
   Unmarked entries get nothing: the absence of a mark is not a caveat.
2. **Windows-handheld rescue.** On `primaryOs === "LINUX"` with no Windows
   fallback and `handheldOs === "WINDOWS"`, a flagged game whose evidence
   would classify `EXCLUDED` (anti-cheat `Denied`/`Broken` without override,
   or effective Linux `REQUIRED`) classifies `SOFT` instead, with reason
   factor `handheld_rescue` and a label that says the Windows handheld can run
   it. Play keeps the game in the pool, roles, and batches with the caveat as
   a visible explanation and no `context.play.exclusions` entry. Buy applies
   the normal SOFT environment points plus the rescue caveat instead of
   `BUY_PRACTICAL_FIT_PENALTY`. Unflagged behavior is unchanged everywhere.
3. **Handheld framing.** When `primaryOs === "WINDOWS" && handheldOs ===
   "LINUX"`, the only Linux device is the handheld, so Linux evidence is
   framed for it: detail compatibility rows title the Linux row "Linux
   handheld" and the persist-time tinkering caveat reads "Needs tinkering on
   your Linux handheld". A pure `linuxDevicePhrase(setup)` helper ("Linux" vs
   "your Linux handheld") owns the wording.
4. **Setup changes.** No new wiring: `updateOsSetup` already re-derives
   compatibility and synchronously re-runs the pipeline, and the pipeline
   reads the flag from the candidate rows, so setup or flag changes shape the
   next runs under normal run semantics. Tests prove the flip.
5. **Unchanged.** The Out-of-the-Box READY floor on no-fallback setups (a
   rescued `REQUIRED` game still cannot take Out-of-the-Box);
   `FALLBACK_RECOMMENDED` and `UNKNOWN` classes (never excluded, soft
   caveats as today); the `context.play.exclusions` contract shape; the
   heavy `BUY_PRACTICAL_FIT_PENALTY` for unflagged wishes; buy never excludes.

## In scope

- `classifyPlayPracticality(setup, evidence, handheldSuitable?)` gaining the
  rescue classification and its two rescue reason labels (+ tests).
- `linuxDevicePhrase(setup)` pure helper in `os-setup.ts` (+ tests).
- Factor keys `handheld_fit` and `handheld_rescue` in `ExplanationFactorKey`,
  `HANDHELD_FIT_POINTS = 2`, and a `handheld` counter on
  `RerankAppliedFactors`.
- `handheldFit` input on play and buy rerank candidates; the boost factor in
  `rerankPlayCandidates` and `rerankBuyCandidates` (+ tests).
- Play pipeline: `loadCandidates` selects the flag; the exclusion pass builds
  a rescue-caveat map; `buildPlayPipeline` appends the rescue caveat to pool
  items pre-rerank; rescued games skip `playExclusions` (+ tests).
- Buy pipeline: `loadBuyCandidates` selects the flag and `wishViews` carry it;
  `buildBuyPipeline` appends the rescue caveat pre-rerank (+ tests).
- Framing: compat-context tinkering caveat label; `CompatibilitySection` and
  `WishlistCompatibilityBlock` Linux row titles from the phrase, passed as
  props from the game and wishlist detail pages.

## Out of scope

- No profile dimension, tune option, taste-setup field, or data-health
  completeness counting for the flag; the flag is a direct soft factor.
- No caveat or penalty for unmarked games (absence of a mark is not a
  signal); no Library or Wishlist card badges, no new filters.
- No evidence gating of the boost: a flagged game with poor Linux evidence
  still gets the boost; the compat caveats carry the negative side.
- No change to the Out-of-the-Box READY floor, the exclusions run-context
  shape, or `BUY_PRACTICAL_FIT_PENALTY` for unflagged wishes.
- The pre-existing compat quirk on Windows primary with a Linux handheld
  where a `FALLBACK_RECOMMENDED` status reads "Windows fallback recommended,
  but none is configured"; observed, left untouched.
- Old stored runs render as persisted; only new runs carry the new factors.
- Feature 23 playtime evidence and feature 24 deployment.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Rescue core and device phrase** - extend
  `classifyPlayPracticality(setup, evidence, handheldSuitable?)` in
  `src/lib/recommendations/environment-fit.ts`: on a Linux primary with no
  Windows fallback and `handheldOs === "WINDOWS"`, a flagged candidate with
  anti-cheat `Denied`/`Broken` (no override) or effective `REQUIRED`
  classifies `SOFT` with reason factor `handheld_rescue` and labels "Anti-cheat
  blocks Linux, but your Windows handheld can run it" / "Needs Windows, but
  your Windows handheld can run it"; every other classification is unchanged.
  Add `linuxDevicePhrase(setup)` to `src/lib/os-setup.ts` returning
  "Linux" or "your Linux handheld" (Windows primary with Linux handheld).
  *Done when:* tests cover flagged/unflagged across Linux-only, Linux with
  fallback, Windows primary with Linux handheld, and all-Windows setups for
  both excluded classes, plus the phrase helper for every setup shape; unflagged
  results are identical to today; `pnpm test` and `pnpm typecheck` pass.
- [x] **Step 2 - Boost factor plumbing** - add `handheld_fit` and
  `handheld_rescue` to `ExplanationFactorKey`, `HANDHELD_FIT_POINTS = 2`, and
  `handheld: number` to `RerankAppliedFactors` in
  `src/lib/recommendations/types.ts`; add optional `handheldFit?: boolean` to
  `RerankPlayInput` and `RerankBuyInput` and push the boost factor (positive,
  score += 2, `applied.handheld += 1`) in `rerankPlayCandidates` and
  `rerankBuyCandidates`. *Done when:* rerank tests prove the boost in both
  engines, the applied counter, and no boost when unflagged or on setups
  without a Linux handheld; existing suites updated and green.
- [x] **Step 3 - Play pipeline: rescue and boost** - `loadCandidates` in
  `pipeline-helpers.ts` selects `handheldSuitable` and `PlayRow.libraryEntry`
  carries it; `runRecommendationPipeline` passes the flag into the exclusion
  classification, collects a rescue-caveat map from rescued candidates, and
  passes it to `buildPlayPipeline`, which appends the caveat to pool item
  caveats pre-rerank and computes `handheldFit: setup.handheldOs === "LINUX"
  && entry.handheldSuitable === true` per candidate. Rescued games stay in
  the pool, exposure handling, roles, and batches and are absent from
  `context.play.exclusions`. *Done when:* pipeline tests prove a flagged
  anti-cheat-denied game on a Linux no-fallback setup with a Windows handheld
  enters the pool with the rescue caveat and no exclusion entry, the unflagged
  twin stays excluded, the boost appears on a flagged game on a Linux-handheld
  setup (including Windows primary), and setup flips re-derive per the
  existing synchronous re-run; suites green.
- [x] **Step 4 - Buy pipeline: rescue and boost** - `loadBuyCandidates`
  selects `handheldSuitable`; `wishViews` carries it into `buildBuyPipeline`,
  which computes `handheldFit` per wish, appends the rescue caveat pre-rerank
  when the practicality reason factor is `handheld_rescue`, and keeps the
  unflagged `EXCLUDED` penalty path untouched. *Done when:* tests prove a
  flagged `REQUIRED` wish on a no-fallback setup with a Windows handheld takes
  the SOFT environment points plus the rescue caveat instead of
  `BUY_PRACTICAL_FIT_PENALTY`, the unflagged twin keeps the heavy penalty and
  caveat, a flagged DLC wish gets the boost with no compat evidence, and
  all-Windows setups show neither; suites green.
- [x] **Step 5 - Handheld framing** - use `linuxDevicePhrase` in
  `buildCompatContext` so the tinkering caveat reads "Needs tinkering on your
  Linux handheld" when the primary is Windows with a Linux handheld (other
  caveat labels unchanged); pass the phrase from
  `src/app/(app)/games/[id]/page.tsx` and
  `src/app/(app)/wishlist/[id]/page.tsx` into `CompatibilitySection` and
  `WishlistCompatibilityBlock` to title the Linux row "Linux handheld" on
  that setup. *Done when:* compat-context tests prove the framed label on
  Windows primary with a Linux handheld and unchanged labels elsewhere;
  walkthrough shows the row titles; `pnpm build` passes.
- [x] **Step 6 - Full verification** - run `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, and `pnpm build`, and walk the manual path end to end. *Done
  when:* all commands pass and the walkthrough below behaves as described.

## Files / areas

- `src/lib/recommendations/environment-fit.ts` (+ tests) - rescue classes.
- `src/lib/os-setup.ts` (+ tests) - `linuxDevicePhrase`.
- `src/lib/recommendations/types.ts` (+ tests if fixture-covered) - factor
  keys, `HANDHELD_FIT_POINTS`, `RerankAppliedFactors.handheld`.
- `src/lib/recommendations/rerank.ts` (+ tests) - boost inputs in both
  engines and the applied counter.
- `src/lib/recommendations/pipeline-helpers.ts` (+ tests) - flag selects.
- `src/lib/recommendations/run-pipeline.ts` - rescue map, boost inputs,
  caveat threading (+ tests via `run-pipeline.test.ts` and
  `src/actions/recommendations.test.ts` fixture updates).
- `src/lib/recommendations/compat-context.ts` (+ tests) - framed label.
- `src/components/games/CompatibilitySection.tsx`,
  `src/components/wishlist/WishlistCompatibilityBlock.tsx`,
  `src/app/(app)/games/[id]/page.tsx`,
  `src/app/(app)/wishlist/[id]/page.tsx` - Linux row titles (Step 5).

## Data / contracts

- No schema or migration changes; the flag is the 22a contract
  (`handheldSuitable: Boolean?`, `true` = marked, `null`/`false` = unmarked).
- **Load-bearing:** `classifyPlayPracticality(setup, evidence,
  handheldSuitable?)` - the third parameter is optional so existing callers
  compile, and unflagged output is byte-identical to 19c/19d.
- **Load-bearing run-context addition:** `RerankAppliedFactors` gains
  `handheld: number` on new runs (stored rerank JSON is tolerant; the
  existing `applied` fixture in `src/actions/recommendations.test.ts` gains
  the key). `context.play.exclusions` keeps its shape; rescued games simply
  never enter it.
- New factor vocabulary: `handheld_fit` (positive, points 2) and
  `handheld_rescue` (caveat/reason). Old runs render as persisted.
- Rescue reason labels are carried on the practicality reason and appended as
  caveats pre-rerank; `persistRecommendationRuns` needs no change.

## Testing

Vitest is configured (`pnpm test`); logic-bearing steps ship tests.

- Step 1: classification matrix (flagged/unflagged by setup by evidence class,
  override-wins, ROM-only unchanged) and `linuxDevicePhrase` per setup shape.
- Step 2: boost factor in play and buy rerank, applied counting, and the
  no-boost cases (unflagged, no Linux handheld).
- Steps 3-4: pipeline rescue-in-pool with caveat and exclusion absence, buy
  penalty swap, DLC wish boost without compat evidence, setup-flip through the
  synchronous re-run.
- Step 5: framed tinkering label tests; row titles ride on the walkthrough.
- Manual walkthrough: on a Linux no-fallback setup, add a Windows handheld in
  Settings (confirmation dialog, synchronous re-run), mark an anti-cheat-denied
  game as a handheld option, and confirm it now appears in Play Next with the
  "playable on your Windows handheld" explanation while the Today exclusions
  note no longer counts it and an unflagged twin stays hidden with the note;
  in Buy, confirm the flagged wish no longer sinks under the heavy penalty and
  carries the rescue caveat; on a setup with a Linux handheld, confirm a
  flagged game shows the "Marked as a handheld option" chip in Play Next and
  Buy (try a Windows primary with a Linux handheld too), and the Linux row is
  titled "Linux handheld"; clear the flag or switch the handheld OS and
  confirm the next run drops the boost.

## Notes for the AI

- Keep `environment-fit.ts` and `os-setup.ts` pure and client-safe; only
  `run-pipeline.ts` and `pipeline-helpers.ts` touch Prisma.
- The boost is NOT gated on compatibility evidence or primary OS - only on
  `handheldOs === "LINUX"` plus the flag. This is the one open design call
  from the plan's "boost or caveat" wording; if the owner prefers an
  evidence-aware split, adjust the gating in Step 2 and its tests.
- Unflagged behavior must remain byte-identical: the rescue is an additive
  branch inside the two `EXCLUDED` paths, and the buy penalty branch keeps
  firing for unflagged `EXCLUDED` results.
- The rescue does not touch `requireReadyForOutOfTheBox`; Out-of-the-Box keeps
  its READY floor on no-fallback setups.
- The rescue caveat is appended pre-rerank in the pipeline build functions, so
  `rerank.ts` only learns about the boost; keep `persistRecommendationRuns`
  unchanged.
- Existing runs render as persisted: new factors appear only on runs generated
  after this feature lands.
- Labels stay factual (no Odyssey voice on evidence copy) and free of em
  dashes per `blueprint/context/coding-standards.md`.
- `loadCandidates` and `loadBuyCandidates` run inside the caller's
  transaction; keep the `updateOsSetup` synchronous re-run path intact.
- No code comments unless asked; follow `blueprint/context/coding-standards.md`.

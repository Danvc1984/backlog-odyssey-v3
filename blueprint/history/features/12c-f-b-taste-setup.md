# Feature: Taste setup

**From build-plan:** feature 12c-f-b (second half of 12c-f; completes 12c)
**Status:** not started

## Goal

Add the optional post-import taste setup: a guided panel on Today that picks
five or six swappable owned games, records one answer per game ("Played it",
"I like this", or Skip) as `TASTE_SETUP_ANSWER` events, seeds one personal
Game experience and one preferred environment onto the answered games, and
rebuilds the profile so the recommender starts with a real basis instead of
cold-start guessing. Field writes are seed actions on the entries themselves
and deliberately bypass the play-state event flow so no duplicate
`COMPLETION` signal rides along with `TASTE_SETUP_ANSWER`.

## In scope

- `saveTasteSetup` server action: per-game answers, personal field writes
  with guards, events, profile rebuild, all in one transaction.
- Picker selection rule and panel visibility rule.
- `TasteSetupPanel` on Today: collapsible, swappable picks, per-game seed
  actions, the two personal selects, save with summary.
- Panel hides once setup exists; re-running is via `Restart recommendations`
  (which clears the events and returns the panel).

## Out of scope

- Any change to the profile rebuild, event retention, or weights: the 12c-c
  contract (`LIKED` +2, `PLAYED` +1, `SKIPPED` 0, payload `{ answer }`) is
  consumed as-is.
- Per-game experience/environment customization: the setup writes one shared
  personal experience and environment, exactly what the plan's "one personal
  field" means.
- Tuning or preset changes (12c-f-a, shipped), calibration (12d), progressive
  one-tap prompts after viewing/starting/dismissing (project-plan 11 general
  prompts, later feature).
- Wishlist-side setup: taste setup seeds owned games only.

## Data / contracts (load-bearing)

### Answers and events

| Answer   | Seed action on the entry                            | Event payload        | Profile weight |
| -------- | ---------------------------------------------------- | -------------------- | -------------- |
| `PLAYED` | `playState = PLAYED_BEFORE` (only from `NOT_STARTED`) | `{ answer: "PLAYED" }`  | +1             |
| `LIKED`  | `interest = 5` (only when currently null)             | `{ answer: "LIKED" }`   | +2             |
| `SKIPPED`| none                                                  | `{ answer: "SKIPPED" }` | 0              |

- One `TASTE_SETUP_ANSWER` event per answered pick, targeting the game,
  written inside the save transaction. `SKIPPED` is recorded so the evidence
  shows the full setup and the panel's zero-events visibility rule stays
  honest.
- Personal field writes bypass `updatePlayState` entirely: no
  `COMPLETION`/`START` transition events are emitted by the setup. The
  `TASTE_SETUP_ANSWER` event is the sole signal from a pick.
- `gameExperience` and `preferredEnvironment` are written to every answered
  pick when the user chose them (independent optional selects); skipped games
  get no field writes.

### Picker and visibility

- Owned pickable games: `type BASE_GAME`, has a `LibraryEntry`, not hidden,
  not the main game.
- Initial picks: up to 6 most recently added owned games (`addedAt` desc).
  Swappable before save: any pick can be replaced by any other owned game.
- Save requires at least one answered pick; the two personal selects are
  optional.
- Panel visibility: show when zero `TASTE_SETUP_ANSWER` events exist and at
  least one pickable game exists; hide otherwise. Because `Restart
  recommendations` deletes the events, restarting brings the panel back.

### Profile rebuild

The save transaction ends by calling the existing
`rebuildRecommendationProfile` so `EXPERIENCE`, `ENVIRONMENT`, and the
answered games' metadata dimensions land immediately; the next run and the
Settings profile view reflect the setup without a manual rebuild.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Save action** - `saveTasteSetup({ picks, experience,
  environment })` with Zod validation (owned base games, answer enum,
  canonical enum selects), the guarded field writes, the per-pick events, and
  the rebuild, all in one transaction; returns a per-pick summary.
  *Done when:* tests cover the three answer paths (field writes applied and
  guarded: no `PLAYED_BEFORE` over `IN_PROGRESS`, no interest overwrite when
  set), skipped picks writing events but no fields, pick validation
  rejections (unowned game, DLC, duplicate picks, no answered pick), one
  event per answered pick, the profile singleton refreshing, and atomic
  rollback on failure; `pnpm test` green.
- [x] **Step 2 - Picker and visibility helpers** - the pickable-games query
  shape and the initial-picks rule, plus the visibility rule (zero
  `TASTE_SETUP_ANSWER` events and at least one pickable game).
  *Done when:* tests cover the filters (DLC, hidden, main excluded), the
  recent-first six-cap with fewer games passing through, and the visibility
  rule before/after setup; `pnpm test` green.
- [x] **Step 3 - Panel UI** - collapsible `TasteSetupPanel` on Today: pick
  cards with the three seed actions and selected-state styling, a swap select
  per pick fed by the owned list, the two personal selects, save with toasts
  and `router.refresh()`; the panel collapses after save and is dismissible
  for the session.
  *Done when:* a manual walkthrough completes a setup (played one, liked one,
  skipped one), sees the toast, verifies events and field writes in
  `pnpm prisma studio`, and the panel is gone; build green.
- [x] **Step 4 - Verification** - manual pass: complete a setup, run
  `Update recommendations`, confirm the Settings profile evidence counts
  `TASTE_SETUP_ANSWER` events and the `EXPERIENCE`/`ENVIRONMENT` dimensions
  show the seeded values, then restart recommendations and confirm the panel
  returns. `pnpm build` and `pnpm test` green.

## Files / areas

- `src/actions/recommendations.ts` (+ test): `saveTasteSetup`
- `src/lib/recommendations/taste-setup.ts` (new) + test: pickable query
  shape, initial-picks rule, visibility rule
- `src/components/recommendations/TasteSetupPanel.tsx` (new, client)
- `src/app/(app)/today/page.tsx`: mount the panel with visibility props

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `recommendations.ts`: answer paths, guards, validation, transaction
  atomicity, rebuild call.
- `taste-setup.ts`: pickable filters, initial picks, visibility rule.
- UI step (3) and the walkthrough (4) ride on the running app plus the build.

## Notes for the AI

- Single-user app: `requireUser()` at the action entry; Zod-validate the
  input; follow `{ success, data, error }`.
- Do not route seed writes through `updatePlayState`: the setup's field
  writes are deliberate personal-field seeding, and the play-state action's
  transition events would double-count the profile signal.
- The event payload is exactly `{ answer }`: the 12c-c rebuild reads that key.
- `SKIPPED` events matter: they keep the visibility rule honest after a
  partial setup.
- Do not touch tune state, presets, rotation, or roles; the setup only feeds
  events, entries, and the rebuild.
- The panel is Today-only; no Settings surface and no wishlist variant.
- Branch: `feature/taste-setup`.

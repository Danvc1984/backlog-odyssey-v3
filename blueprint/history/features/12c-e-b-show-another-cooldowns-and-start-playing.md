# Feature: Show another, cooldowns, and Start-playing

**From build-plan:** feature 12c-e-b (second half of 12c-e)
**Status:** not started

## Goal

Make the role-shaped runs interactive: a `Show another` action per role that
rotates within the role by consuming the batches 12c-e-a retained in run
context, without starting a new run; exposure cooldowns that keep recently
shown candidates from coming back too soon; and an explicit Start-playing
action on play recommendations that sets `IN_PROGRESS` and handles the
main-game rule (auto when nothing else is in progress, asked otherwise).
Rotation finally emits the `ROTATION` events 12c-b reserved. No schema
migration.

## In scope

- Batch contract upgrade: `context.roles.batches` entries become scored
  candidate snapshots (not bare ids) so rotation needs no recompute.
- `rotateRecommendationRole` server action: cooldown exclusion, optimistic
  in-place item swap, batch updates, best-effort `ROTATION` and `EXPOSURE`
  events.
- `Show another` button per role on Today.
- `startPlayingFromRecommendation` server action with the main-game decision
  flow, reusing `updatePlayState` (which already emits `START` events).
- `Start playing` button on play recommendation cards with the ask dialog.
- `EXPOSURE_COOLDOWN_DAYS = 7` constant.

## Out of scope

- Rotation or Start-playing on the wishlist detail buy card: `Show another`
  is a Today interaction per the overview; the wishlist card stays read-only.
- Any change to role assignment, batch composition rules, saturation, run
  creation, re-ranking, or eligibility.
- Cooldown effects on scoring: a cooldown only excludes a candidate from the
  next rotation pick; it is never a negative signal and never adjusts points.
- Tune-this-run and presets (12c-f), calibration (12d), Today dashboard
  composition (13).

## Data / contracts (load-bearing)

### Batch snapshots

`context.roles.batches` entries change from `string[]` to snapshot objects;
this is the one 12c-e-a contract this feature deliberately upgrades:

```ts
interface RotatableCandidate {
  id: string; // gameId (play runs) or wishlistEntryId (buy runs)
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}
```

- Built at run creation by mapping the adjusted pool's items by id; display
  names resolve at render time from the item row's `game`/`wishlistEntry`
  relations, so snapshots stay lean.
- `assignPlayRoles`/`assignBuyRoles` keep returning id batches; the action
  maps ids to snapshots from `rerank.pool` when writing context.

### Cooldown

- `EXPOSURE_COOLDOWN_DAYS = 7`: a candidate with an `EXPOSURE` event within
  the last 7 days is skipped when picking the next candidate for a role. The
  cooldown excludes only; it never adjusts scores and never touches the
  profile.
- The just-replaced item is covered by its run-mount `EXPOSURE` event, so it
  cannot immediately return.

### Rotation action

`rotateRecommendationRole({ runId, role, itemId })`:

1. Loads the run, resolves the target kind from the run kind, and finds the
   displayed item (`itemId`, same run, same `role`).
2. Picks the first candidate in `batches[role]` that is neither displayed in
   any role of this run nor cooldown-excluded. When none remains it returns
   `rotated: false` and mutates nothing.
3. Swaps the item row in place with an optimistic guard: `updateMany` on
   `id + runId + role`; zero rows updated means another rotation won the race
   and the action reports an error instead of double-swapping.
4. Removes the swapped-in candidate from every batch array (it is displayed
   now).
5. Best-effort events, never blocking the swap: `ROTATION` for the replaced
   target (payload `{ role }`) and `EXPOSURE` for the replacement (payload
   `{ role }`), completing the 12c-b payload contract.
6. Returns the updated item so the client can swap it in place.

### Start-playing action

`startPlayingFromRecommendation({ gameId, makeMain? })`:

- If the entry is already `IN_PROGRESS`: success no-op, no mutation, no event.
- If another game is `IN_PROGRESS` and `makeMain` is undefined: return
  `needsMainDecision: true` with the in-progress game's name; nothing
  mutates.
- Otherwise: delegate to `updatePlayState(gameId, { playState: "IN_PROGRESS",
  ...(makeMain && { isMainGame: true }) })`. When nothing else is in progress
  the game becomes main (replacing any stale main, exactly like the detail
  page's existing transaction); `START` event emission stays inside
  `updatePlayState` (12c-b).
- A missing library entry fails with a clear error. Hidden, replay, or
  recently-changed states are not re-validated: the user clicked explicitly.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Batch snapshots** - add `RotatableCandidate` and
  `EXPOSURE_COOLDOWN_DAYS` to the recommendation types; the action maps the
  adjusted pools by id and writes snapshot batches into both run contexts.
  *Done when:* action tests show `context.roles.batches` entries carrying
  score and factors for both engines, unchanged role assignment results, and
  `pnpm test` green.
- [x] **Step 2 - Rotation action** - `rotateRecommendationRole` per the
  contract above, in `src/actions/recommendations.ts`.
  *Done when:* tests cover picking in batch order, cooldown exclusion at the
  7-day boundary (fake timers), no-candidate returning `rotated: false`
  without mutation, optimistic-race error on zero rows, batch removal across
  all roles, and best-effort events (a failing event write still rotates);
  `pnpm test` green.
- [x] **Step 3 - Show another button** - client button per role group on
  Today: calls the action, swaps the card content in place from the returned
  item, hides itself when `rotated: false`, disables while pending, toasts
  errors. Pre-12c-e-a runs (items with no role, no batches) render no button
  at all.
  *Done when:* a manual walkthrough rotates a role through several
  candidates until the button disappears, the swapped card keeps its role
  label, an old run shows no button, and the build is green.
- [x] **Step 4 - Start-playing action** -
  `startPlayingFromRecommendation` per the contract above.
  *Done when:* tests cover the already-in-progress no-op, the
  `needsMainDecision` path leaving the entry untouched, `makeMain: true`
  clearing the previous main through `updatePlayState`, `makeMain: false`
  starting without main, and a missing entry failing; `pnpm test` green.
- [x] **Step 5 - Start playing button** - on play cards only: click starts;
  when the action answers `needsMainDecision`, an inline confirm offers
  "Start playing" (keep current main) and "Make main game"; toasts and
  `router.refresh()` after success.
  *Done when:* a manual walkthrough covers the no-conflict start (game shows
  `IN_PROGRESS` on its detail page), the conflict ask (decline keeps the
  current main, accept swaps it), and the build is green.
- [x] **Step 6 - Verification** - manual pass: run `Update recommendations`,
  rotate each play role and a buy role while watching `ROTATION`/`EXPOSURE`
  rows and shrinking batches in Prisma Studio, confirm a recently shown
  candidate does not return within 7 days, then start two recommendations in
  sequence to exercise the main-game ask. `pnpm build` and `pnpm test` green.

## Files / areas

- `src/lib/recommendations/types.ts`: `RotatableCandidate`,
  `EXPOSURE_COOLDOWN_DAYS`
- `src/actions/recommendations.ts` (+ test): snapshot mapping,
  `rotateRecommendationRole`, `startPlayingFromRecommendation`
- `src/components/recommendations/ShowAnotherButton.tsx` (new, client)
- `src/components/recommendations/StartPlayingButton.tsx` (new, client)
- `src/components/recommendations/RecommendationItemCard.tsx`: button slots
- `src/app/(app)/today/page.tsx`: wire the buttons into role groups

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `recommendations.ts`: snapshot context shape, rotation contract (order,
  cooldown boundary, race, drained role, events), start-playing decision
  matrix.
- UI steps (3 and 5) and the walkthrough (6) ride on the running app plus the
  build.

## Notes for the AI

- Single-user app: `requireUser()` at action entries; Zod-validate both new
  action inputs (`role` validated against the `RecommendationRole` enum);
  follow `{ success, data, error }`.
- Rotation is one small swap, never a run: do not create runs, do not touch
  `updateRecommendations`, do not rescore. If a rotation seems to need
  factors that are not in the snapshot, the snapshot mapping in Step 1 is
  what to fix.
- Event writes are best-effort and outside the swap's transaction, matching
  the 12c-b pattern; a lost event is acceptable, a blocked swap is not.
- The cooldown lookup is a single indexed query (`kind`, `createdAt`) with an
  id filter; no new tables, no dedup machinery beyond the optimistic
  `updateMany` guard.
- `startPlayingFromRecommendation` delegates to `updatePlayState` rather than
  duplicating the main-clearing transaction or the `START` event.
- Keep the wishlist detail buy card untouched; rotation is Today-only.
- Branch: `feature/show-another-start-playing`.

## Implementation notes

- Legacy-batch repair: pre-12c-e-b runs store role batches as bare `string[]`
  ids; `rotateRecommendationRole` normalizes both shapes (`BatchEntry =
  string | RotatableCandidate`), so an old run rotates without crashing
  (bare-id cards show score 0 with no factors until the next run update).
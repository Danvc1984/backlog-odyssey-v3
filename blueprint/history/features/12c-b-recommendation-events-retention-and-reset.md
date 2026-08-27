# Feature: Recommendation events, retention, and reset

**From build-plan:** feature 12c-b
**Status:** not started

## Goal

Give the recommender a private, append-only event log with time-bounded
retention and a full `Restart recommendations` reset. This is the data substrate
for the remaining 12c sub-features (derived profile, re-ranking, rotation and
cooldowns, taste setup) and for 12d calibration: they read and write this log
instead of inventing their own storage. Catalog, ownership, and provider data
stay untouched.

## In scope

- `RecommendationEvent` model, `RecommendationEventKind` enum, migration.
- Event contract: kind, exactly-one target (game or wishlist entry), optional
  `runId`, optional `reason`, optional kind-specific `payload`.
- Emission for every event kind that has a UI today:
  - `DISMISSAL` from the existing `dismissRecommendation` action, with an
    optional reason and the run the dismissal happened in.
  - `START` / `COMPLETION` / `ABANDONMENT` from `updatePlayState` transitions.
  - `EXPOSURE` from the Today page, one event per displayed run item.
- Retention pruning by kind bucket (90 days / 12 months / 24 months), run
  inside `updateRecommendations` next to the existing run pruning.
- `restartRecommendations` server action plus a Settings section with a
  two-step confirm.
- Optional dismissal reason input on the recommendation card.

## Out of scope

- `ROTATION` and `TASTE_SETUP_ANSWER` emission: contract only this feature;
  emission lands with 12c-e (Show another) and 12c-f (taste setup).
- Derived profile and preference overrides (12c-c), adaptive re-ranking
  (12c-d), roles/batches/rotation/Start-playing (12c-e), tune-this-run and
  presets (12c-f), calibration (12d).
- Extending the reset to `RecommendationProfile` / `RecommendationPreference` /
  `RecommendationPreset`: those tables do not exist yet; 12c-c and 12c-f extend
  the reset when they add them (load-bearing note, see below).
- Any change to scoring, eligibility, or run creation logic.

## Data / contracts (load-bearing)

### Event kind and retention

| Kind                | Retention | Emitted in        | Trigger                                                        |
| ------------------- | --------- | ----------------- | -------------------------------------------------------------- |
| `EXPOSURE`          | 90 days   | 12c-b             | Today page displays a run item                                 |
| `ROTATION`          | 90 days   | 12c-e             | `Show another` rotates an item (not built yet)                 |
| `START`             | 12 months | 12c-b             | play state changes to `IN_PROGRESS`                            |
| `DISMISSAL`         | 12 months | 12c-b             | in-run dismissal, optional `reason`                            |
| `COMPLETION`        | 24 months | 12c-b             | play state changes to `PLAYED_BEFORE`                          |
| `ABANDONMENT`       | 24 months | 12c-b             | play state changes to `ABANDONED`                              |
| `TASTE_SETUP_ANSWER`| 24 months | 12c-f             | taste-setup answer (not built yet)                             |

The plan's "played" retention bucket maps to `COMPLETION`: the app has one
`PLAYED_BEFORE` state, no separate played/completed states. Runs keep their
existing 12-month retention (`RUN_RETENTION_DAYS = 365`).

### Model

```prisma
enum RecommendationEventKind {
  EXPOSURE
  ROTATION
  TASTE_SETUP_ANSWER
  START
  COMPLETION
  ABANDONMENT
  DISMISSAL
}

model RecommendationEvent {
  id              String                  @id @default(cuid())
  kind            RecommendationEventKind
  gameId          String?
  wishlistEntryId String?
  runId           String?
  reason          String?
  payload         Json?
  createdAt       DateTime                @default(now())

  game          Game?                @relation(fields: [gameId], references: [id], onDelete: Cascade)
  wishlistEntry WishlistEntry?       @relation(fields: [wishlistEntryId], references: [id], onDelete: Cascade)
  run           RecommendationRun?   @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([kind, createdAt])
  @@index([gameId, kind])
  @@index([wishlistEntryId, kind])
  @@index([runId])
}
```

- Exactly one of `gameId` / `wishlistEntryId`, enforced in code, same rule as
  `RecommendationItem`.
- `reason`: dismissal free text, trimmed, max 500 chars.
- `payload`: kind-specific JSON. Documented shapes (consumers arrive later):
  - `TASTE_SETUP_ANSWER`: `{ answer: "PLAYED" | "LIKED" | "SKIPPED", swappedInGameId?: string }`
  - `ROTATION` / `EXPOSURE`: `{ role?: string }` (roles land in 12c-e; absent until then)
- Cascade from `Game`, `WishlistEntry`, `RecommendationRun`: deleting a game,
  a wish, or pruning a run removes its events, matching `RecommendationItem`.
- Event writes are best-effort: they never fail the primary write (play-state
  update, dismissal). A lost event is acceptable; a blocked personal-field
  change is not.

### Consumers this contract must serve

- 12c-c rebuilds the derived profile from retained events with recency decay.
- 12c-e reads `EXPOSURE` / `ROTATION` for short per-item cooldowns.
- 12d derives per-target dismissal counters. Open question in the overview
  (counters from retained events vs a separate durable aggregate) is decided
  in 12d, not here; `DISMISSAL` events are retained 12 months either way.

### Reset contract (load-bearing)

`restartRecommendations` deletes every recommendation-owned record:
`RecommendationRun` (cascades to `RecommendationItem`), `RecommendationFeedback`,
`RecommendationEvent`. It preserves catalog, `LibraryEntry`, wishlist entries,
offers, provider snapshots, Steam connection, and settings. When 12c-c/12c-f
add `RecommendationProfile`, `RecommendationPreference`, `RecommendationPreset`,
the reset action must be extended to delete those rows too. If 12d lands a
separate durable counter table, the reset deletes it as well.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Schema and migration** - add `RecommendationEventKind` and
  `RecommendationEvent` (fields, relations, indexes above) to
  `prisma/schema.prisma`; run `pnpm prisma:migrate`; regenerate the client.
  *Done when:* `pnpm prisma migrate status` reports up to date, `pnpm typecheck`
  green, new model visible in the generated client.
- [x] **Step 2 - Event log lib** - `src/lib/recommendations/events.ts` with
  `EVENT_RETENTION_DAYS` (kind to days map per the table),
  `playStateTransitionKind(prev, next)` (returns `START` / `COMPLETION` /
  `ABANDONMENT` / `null`), `logRecommendationEvent` (validates exactly one
  target, appends one row), and `pruneRecommendationEvents(client, now)`
  (one `deleteMany` per kind with `createdAt < now - retention`).
  *Done when:* unit tests cover the transition matrix (including no-op and
  `-> NOT_STARTED` = no event), per-kind cutoffs with fake timers, and
  exactly-one-target validation; `pnpm test` green.
- [x] **Step 3 - Dismissal events** - extend `dismissRecommendation` input with
  optional `reason` (trimmed, max 500) and optional `runId`; after the
  `RecommendationFeedback` row is written, best-effort write a `DISMISSAL`
  event (same target, `runId`, `reason`); an event failure never fails the
  dismissal. *Done when:* tests show the event row with reason and runId, the
  feedback row shape unchanged, and a failing event write still returns
  success for the dismissal.
- [x] **Step 4 - Dismiss reason UI and runId wiring** - `RecommendationItemCard`
  gains an optional reason input (Dismiss click expands an inline input with
  confirm/cancel; empty reason behaves exactly like today); Today page and
  wishlist detail pass their run id into the card and the card forwards it to
  the action. *Done when:* in the running app, dismissing with a reason stores
  it on the event row and dismissing without one is unchanged; build green.
- [x] **Step 5 - Play-state events** - `updatePlayState` reads the current
  `LibraryEntry` first; when `playState` is provided and actually changes,
  best-effort log the mapped event (`START` / `COMPLETION` / `ABANDONMENT`)
  for that game. Missing entry keeps today's failure behavior.
  *Done when:* tests cover the transition matrix, no event when playState is
  unchanged or not provided, no event for `-> NOT_STARTED`, and an event-write
  failure does not fail the update; `pnpm test` green.
- [x] **Step 6 - Exposure recording** - `recordRunExposure` server action
  (`runId`, `items[]` each with exactly one target; the recommendation kind is
  derivable from the target, so it is not stored or passed) writing one
  `EXPOSURE` event per item in a single `createMany`; a small client component
  on the Today page fires it once per displayed run on mount, silently
  (errors swallowed, no toast, no visible UI). *Done when:* action contract
  tests pass (validates input, one row per item, empty items = no-op) and a
  manual visit to `/today` with an existing run creates `EXPOSURE` rows.
  Viewing a buy card on the wishlist detail page is intentionally NOT
  exposure: it is deliberate navigation, not a passive display. If 12c-e's
  cooldowns need it, that is 12c-e's call.
- [x] **Step 7 - Retention pruning in updateRecommendations** - call
  `pruneRecommendationEvents` inside the existing `updateRecommendations`
  transaction before creating the new runs; add `prunedEvents` to the run
  context and the returned result. *Done when:* tests show old events pruned
  per bucket while fresh events of the same kind survive; `pnpm test` green.
- [x] **Step 8 - Reset action and Settings UI** - `restartRecommendations`
  server action deleting `RecommendationRun`, `RecommendationFeedback`, and
  `RecommendationEvent` (returning per-table counts); new "Recommendations"
  section on `/settings` with a description and a two-step confirm button
  (first click reveals confirm/cancel, confirm calls the action, success toast
  with counts). *Done when:* action tests show the three tables emptied and
  catalog/wishlist/provider rows untouched, and a restart with no
  recommendation data succeeds with zero counts; manual walkthrough: restart
  from Settings empties Today's recommendation sections back to their empty
  states.

## Files / areas

- `prisma/schema.prisma` + new migration
- `src/lib/recommendations/events.ts` (new, holds `EVENT_RETENTION_DAYS`) +
  `events.test.ts` (new)
- `src/actions/recommendations.ts` (+ test): dismiss extension,
  `recordRunExposure`, `restartRecommendations`, pruning hook
- `src/actions/game-detail.ts` (+ test): transition detection in
  `updatePlayState`
- `src/components/recommendations/RecommendationItemCard.tsx`: reason input,
  `runId` prop
- `src/app/(app)/today/page.tsx`: run id into cards, exposure tracker
- `src/app/(app)/wishlist/[id]/page.tsx`: run id into the buy card
- `src/components/recommendations/RunExposureTracker.tsx` (new, client)
- `src/app/(app)/settings/page.tsx` + a small settings component for the
  restart control

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `events.ts`: transition matrix, retention cutoffs (fake timers),
  exactly-one-target validation, pruning per kind.
- `recommendations.ts`: dismissal writes event with reason/runId and survives
  a failing event write; `recordRunExposure` input validation and one-row-per
  item; `restartRecommendations` deletes the three tables and preserves
  catalog rows; `updateRecommendations` prunes events per bucket.
- `game-detail.ts`: play-state transition events, no-op cases, event failure
  isolation.
- UI steps (4 and the Settings part of 8) ride on the running app plus build:
  dismiss-with-reason flow, Today exposure rows, restart walkthrough.

## Notes for the AI

- Single-user app: no per-user scoping; `requireUser()` at every action entry.
- Follow the existing `{ success, data, error }` action pattern and Zod
  validation for all new inputs.
- Event writes are best-effort by design: wrap them so a failure logs nothing
  user-visible and never rolls back the primary write. Do not put the event
  write inside the primary write's transaction.
- `runId` on events is a real relation with cascade, so a fire-and-forget
  exposure call that races run pruning can hit an FK error; that is expected
  and must be swallowed silently (the exposure is for a run that no longer
  exists).
- Dev StrictMode may double-fire the exposure effect; that is acceptable
  (single user, 90-day retention). Do not add dedup machinery.
- Keep the dismissal feedback row exactly as it is (12d depends on its shape);
  the event is additive.
- No new routes, no new providers, no cron: pruning piggybacks on
  `updateRecommendations`, matching the existing run-pruning pattern.
- Branch: `feature/recommendation-events-retention-reset`.

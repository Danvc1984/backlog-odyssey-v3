# Feature: Play states and main game

**From build-plan:** feature 4
**Status:** complete

## Goal

Let the owner set a game's play state, designate one game as the current main game, and toggle candidate flags (play soon, replay, hidden) from the game detail page. Show these signals in the library list so the owner can see at a glance what's active, queued, or tucked away.

## In scope

- Play state selector on game detail (NOT_STARTED, IN_PROGRESS, PLAYED_BEFORE, ABANDONED)
- "Main game" toggle with single-game constraint (setting one clears any other)
- Play soon, replay candidate, and hidden toggles on game detail
- Server action with validation and the main-game transaction
- Library page badges for main game, play soon, replay candidate, hidden
- Unit tests for the server action logic

## Out of scope

- Play-state rules engine (automatic state transitions based on activity) - deferred to recommendation engine (feature 12)
- Abandoned signal heuristics (auto-detect abandonment from inactivity) - manual toggle only for now
- Candidate flags affecting recommendation scoring - that's feature 12
- Bulk play-state changes from the library page
- Any changes to the Today dashboard (feature 13 will consume these fields)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server action: updatePlayState** - Add `updatePlayState` to `src/actions/game-detail.ts`. Accept `gameId` and an input object with optional `playState`, `isMainGame`, `playSoon`, `replayCandidate`, `hidden`. Use zod for validation. When `isMainGame` is set to `true`, clear `isMainGame` on any other LibraryEntry in a transaction (prisma.$transaction). Return the standard `{ success, data, error }` pattern. *Done when:* calling the action with `{ isMainGame: true }` on game A sets A.main=true and clears any prior main game; calling with `{ playState: "IN_PROGRESS" }` updates the play state; invalid input returns a validation error.

- [x] **Step 2 - PlayStateSection client component** - Create `src/components/games/PlayStateSection.tsx` as a `"use client"` component. Follow the `PersonalFieldsForm` pattern: local state for each field, calls `updatePlayState` on change (not a single save button - each toggle/dropdown triggers its own save for immediacy). Show: play state dropdown (4 options), main game toggle (switch or checkbox), play soon toggle, replay candidate toggle, hidden toggle. Display a saving indicator and error state. Disable controls while a save is in flight. *Done when:* changing any field triggers the server action, shows a toast on success, and shows an inline error on failure.

- [x] **Step 3 - Integrate into game detail page** - Replace the placeholder Play state section in `src/app/(app)/games/[id]/page.tsx` with `<PlayStateSection>`. Pass the libraryEntry's play state, isMainGame, playSoon, replayCandidate, and hidden as props (plain serializable object, same pattern as PersonalFieldsForm). Remove the "Play state (managed by play states feature)" placeholder text. *Done when:* visiting `/games/[id]` for a library entry shows the interactive play state section; changing play state or toggling main game persists and reflects on page reload.

- [x] **Step 4 - Library page indicators** - Add visual indicators to the library table in `src/app/(app)/library/page.tsx`. Show a "Main" badge next to the game name when `isMainGame` is true. Show small indicators for play soon, replay candidate, and hidden flags (icons or compact text badges). Add the `isMainGame`, `playSoon`, `replayCandidate`, and `hidden` fields to the Prisma query's `select`/`include`. *Done when:* the library table shows a "Main" badge on the main game and small flag indicators; hidden games still appear (filtering by hidden is a future enhancement).

- [x] **Step 5 - Tests for updatePlayState** - Add tests to `src/actions/game-detail.test.ts` covering: (a) setting play state, (b) setting isMainGame clears previous main, (c) toggling flags, (d) validation rejects invalid play state, (e) validation rejects invalid gameId format. Follow the existing test patterns (vi.mock for prisma and auth-guard). *Done when:* `pnpm test` passes with the new test cases.

## Files / areas

- `src/actions/game-detail.ts` - add `updatePlayState` action
- `src/actions/game-detail.test.ts` - add tests
- `src/components/games/PlayStateSection.tsx` - new client component
- `src/app/(app)/games/[id]/page.tsx` - replace placeholder with PlayStateSection
- `src/app/(app)/library/page.tsx` - add flag indicators to table

## Data / contracts

- `LibraryEntry` fields (already in schema, no migration needed):
  - `playState` - `PlayState` enum (NOT_STARTED, IN_PROGRESS, PLAYED_BEFORE, ABANDONED)
  - `isMainGame` - `Boolean`, default false; unique constraint enforced in app logic (one main at a time via transaction)
  - `playSoon` - `Boolean`, default false
  - `replayCandidate` - `Boolean`, default false
  - `hidden` - `Boolean`, default false
- Server action input shape:
  ```ts
  {
    playState?: "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED";
    isMainGame?: boolean;
    playSoon?: boolean;
    replayCandidate?: boolean;
    hidden?: boolean;
  }
  ```
- Load-bearing for features 5 (Collections may filter by flags), 12 (Recommendation engine reads play state and flags), 13 (Today dashboard shows main game and play-next candidates)

## Testing

- Server action (`updatePlayState`) is in-scope logic: main-game constraint transaction, flag toggles, zod validation. Ship tests in step 5.
- UI components (PlayStateSection, library badges) are integration-level: verified by the owner's live testing (Playwright was removed from project scope).
- `pnpm test` (29 tests) and `pnpm build` passed before the work commit.

## Notes for the AI

- Follow the existing `updatePersonalFields` pattern in `game-detail.ts` for the server action structure.
- Follow the `PersonalFieldsForm` pattern for the client component (local state, direct action calls, toast feedback).
- The main-game constraint must use `prisma.$transaction` to clear the previous main game and set the new one atomically. Query for the current main game first, then update both in the transaction.
- The PlayStateSection should save on change (not on form submit) for a snappier UX. Each toggle/dropdown calls the action independently.
- The library page currently queries `libraryEntry` with `include: { game: { include: { availability: true } } }`. Add the flag fields to the existing include (they're already on the model, just not selected).
- Icons from `lucide-react` for flag indicators (e.g., `Star` for main game, `Clock` for play soon, `RotateCcw` for replay, `EyeOff` for hidden).
- No schema migration needed - all fields already exist in `prisma/schema.prisma`.

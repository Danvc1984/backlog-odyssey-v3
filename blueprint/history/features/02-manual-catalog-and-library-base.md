# Feature: Manual catalog and library base

**From build-plan:** feature 2
**Status:** complete

## Goal

Let the owner manually add games (base game, other-platform, or ROM) to the
catalog and browse them in a searchable, filterable library list. This is the
foundational data entry path - every later feature (play states, collections,
compatibility, recommendations) depends on having games in the library.

## Design reference

None - no visual mockup exists. The library page uses the existing shell layout
from feature 1 (desktop sidebar nav, mobile bottom nav) with standard
shadcn/ui components.

## In scope

- Server action to create a `Game` (origin=MANUAL) with one `GameAvailability`
  row and one `LibraryEntry`
- Zod schema validating the create-game form input
- Create-game dialog (shadcn Dialog) accessible from the library page
- Game type selection: BASE_GAME or DLC (with optional base-game reference for
  DLC - deferred to feature 9, so only BASE_GAME for now)
- Availability source selection: STEAM, OTHER_PLATFORM, or ROM
- `/library` page listing all library entries with game name, type, availability
  source, and play state
- Search by game name (client-side filter or server-side query)
- Filter by availability source and play state
- Sorting by name, date added
- Empty state when no games exist
- Link from library list to `/games/[id]` (stub page for now, full detail in
  feature 3)

## Out of scope

- Game detail page content (feature 3)
- Play state management and main-game constraint (feature 4)
- Collections (feature 5)
- Steam import (feature 6)
- DLC as children of base games (feature 9)
- Bulk actions on the library list
- Grid vs table view toggle
- Edit or delete game (comes later)

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

- [x] **Step 1 - Create-game server action** - Add `src/actions/games.ts` with a `createGame` server action that: validates input with Zod (name required, game type defaults to BASE_GAME, availability source required, optional display name), calls `requireUser()` for auth, creates a `Game` row (origin=MANUAL), a `GameAvailability` row, and a `LibraryEntry` row in a single Prisma transaction, returns `{ success, data, error }`. Add a unit test in `src/actions/games.test.ts` covering valid creation, missing name rejection, and the transactional shape. *Done when:* `pnpm test` passes with the new test file, and `pnpm typecheck` succeeds.

- [x] **Step 2 - Create-game dialog component** - Add `src/components/games/CreateGameDialog.tsx` as a client component using shadcn Dialog. Form fields: name (text input, required), availability source (select: Steam / Other platform / ROM), display name (text input, optional). On submit, calls the `createGame` server action. Shows toast on success (from feature 1's toast setup or inline success message) and closes the dialog. Shows validation errors inline. *Done when:* the dialog opens from a button, submits, and closes on success with no console errors.

- [x] **Step 3 - Library list page with data** - Replace the stub `/library` page with a server component that queries all `LibraryEntry` rows (with joined `Game` and `GameAvailability`) sorted by `createdAt` desc, renders a table or list showing game name, type badge, availability source, and play state. Add an "Add game" button that opens the `CreateGameDialog`. Show an empty state with a prompt to add the first game when the list is empty. *Done when:* navigating to `/library` shows the list (or empty state), and adding a game via the dialog appears in the list on refresh.

- [x] **Step 4 - Search and filters** - Add search-by-name (text input that filters the list) and filter controls for availability source (all / Steam / Other platform / ROM) and play state (all / Not started / In progress / Played before / Abandoned). Implement as URL search params so filters are shareable and back-button friendly. Add a sort control (name A-Z / Z-A, date added newest / oldest). *Done when:* typing a name filters the list, selecting a source/play-state filter narrows results, and sort order changes the list. All controls work together (search + filter + sort compose).

- [x] **Step 5 - Link to game detail stub** - Make each game name in the library list a link to `/games/[id]`. Create a minimal stub page at `src/app/(app)/games/[id]/page.tsx` that queries the game by id, shows the game name as a heading, and redirects to `/library` if not found. *Done when:* clicking a game name navigates to the detail stub, which shows the correct game name.

## Files / areas

| File | Action |
|------|--------|
| `src/actions/games.ts` | Create - server action for game creation |
| `src/actions/games.test.ts` | Create - unit tests for the server action |
| `src/components/games/CreateGameDialog.tsx` | Create - dialog form component |
| `src/app/(app)/library/page.tsx` | Replace - full library list page |
| `src/app/(app)/games/[id]/page.tsx` | Create - game detail stub |

## Data / contracts

- **Game** (existing schema) - `id`, `type` (BASE_GAME only for now), `origin` (MANUAL), `name`, `createdAt`
- **GameAvailability** (existing schema) - `gameId`, `source` (STEAM / OTHER_PLATFORM / ROM), `displayName`, `addedAt`
- **LibraryEntry** (existing schema) - `gameId`, `playState` (default NOT_STARTED), `createdAt`
- The `createGame` action's Zod input shape is the form contract:

```ts
{
  name: string (min 1)
  availabilitySource: "STEAM" | "OTHER_PLATFORM" | "ROM"
  displayName?: string
}
```

This shape is load-bearing: features 3 (game detail), 4 (play states), and 6
(Steam import) will extend or reuse it.

## Testing

- **Step 1:** Unit test for `createGame` server action - valid input creates
  three rows (Game, GameAvailability, LibraryEntry), empty name returns
  validation error. Mock Prisma with `vi.mock()`.
- **Steps 2-5:** UI and integration steps verified via browser evidence
  (screenshot, build, manual walkthrough). No unit tests for components or pages.

Vitest is configured (`pnpm test`). The test gate is on.

## Notes for the AI

- Server components by default. Only `CreateGameDialog` and filter controls
  need `"use client"`.
- Call `requireUser()` at the top of the `createGame` server action to enforce
  the single-user auth gate.
- Use Prisma transactions (`prisma.$transaction`) for the create-game action to
  ensure Game + GameAvailability + LibraryEntry are created atomically.
- The library page query should include `game` and `game.availability` relations
  to avoid N+1.
- Search param-based filters (`?q=&source=&state=&sort=`) on the library page
  keep filters in the URL for back-button support.
- Use shadcn/ui Dialog, Select, Input, Button, and Table components. Import
  from `@/components/ui/` per existing pattern.
- The `AvailabilitySource` enum values in Prisma are `STEAM`, `OTHER_PLATFORM`,
  `ROM`. The form labels should be user-friendly ("Steam", "Other platform",
  "ROM") but store the enum values.
- DLC creation with base-game reference is explicitly out of scope for this
  feature. The form should only offer BASE_GAME for now.

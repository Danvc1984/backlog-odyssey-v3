# Feature: Collections

**From build-plan:** feature 5
**Status:** complete

## Goal

Give the owner a way to group games into persistent manual Collections (e.g.
"Cozy games", "Local co-op") and browse calculated system Collections (play soon,
favorites, etc.) - all from a dedicated page and from the game detail and library
views.

## In scope

- Server actions: CRUD for manual collections, add/remove game membership
- System collections: read-only calculated queries (no stored rows)
- `/collections` page listing manual and system collections with member counts
- `/collections/[id]` detail page showing member games
- Game detail page: "Add to collection" action
- Library page: filter by collection
- Navigation: add "Collections" to AppNav

## Out of scope

- Collection reordering or drag-and-drop
- Collection cover images or artwork
- Bulk add/remove from library table
- Collection sharing or export
- System collection definitions configurable by the user

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

- [x] **Step 1 - Collection server actions** - create `src/actions/collections.ts` with `createCollection`, `updateCollection`, `deleteCollection`, `addGameToCollection`, `removeGameFromCollection`. Each action uses `requireUser()`, Zod validation, and returns `{ success, data, error }`. Collection names are trimmed, non-empty, and unique (case-insensitive via Prisma `mode: "insensitive"`). `updateCollection` allows changing name, color, icon. Delete cascades memberships. Add/remove are idempotent (add skips if already member, remove skips if not). *Done when:* `pnpm test` passes with unit tests covering create (happy + duplicate name including case-insensitive variant "My Games" vs "my games" + empty name), update, delete, add-member (happy + idempotent), and remove-member (happy + idempotent).

- [x] **Step 2 - System collections module** - create `src/lib/system-collections.ts` exporting a `getSystemCollections()` function and a `getSystemCollectionGames(collectionId: string)` function. Define five system collections with stable IDs (`play-soon`, `replay-candidates`, `favorites`, `hidden`, `abandoned`). Each queries `LibraryEntry` with the matching filter (e.g. `playSoon: true` for play-soon, `rating: { gte: 8 }` for favorites). Return `{ id, name, icon, color, count }` for the list and full game data for the detail view. *Done when:* `pnpm test` passes with unit tests for each system collection query returning the expected shape.

- [x] **Step 3 - Collections list page** - create `src/app/(app)/collections/page.tsx`. Server component that fetches manual collections (with member counts via `_count`) and calls `getSystemCollections()`. Renders two sections: "System collections" and "My collections". Each collection card shows name, member count, and color/icon if set. "My collections" section has a "New collection" button opening a dialog (reuse `src/components/ui/dialog.tsx`). Manual collection cards link to `/collections/[id]`; system collection cards link to `/collections/[id]`. Empty state: "No collections yet - create one to start organizing your games." *Done when:* navigating to `/collections` shows system collections with correct counts and manual collections (empty initially), and creating a new collection via the dialog adds it to the list after reload.

- [x] **Step 4a - Collection detail page (read-only)** - create `src/app/(app)/collections/[id]/page.tsx`. Server component that resolves the ID: if it matches a system collection ID, query via `getSystemCollectionGames()`; otherwise fetch from `Collection` with memberships including game data (availability, libraryEntry). Render a game table similar to the library page (name, type, availability, play state). System collections show a badge indicating they are calculated. Manual collections show the collection name, color, and icon. Empty state for manual: "No games in this collection." Empty state for system: "No games match this collection." *Done when:* clicking a system collection shows its filtered games (or empty state), clicking a manual collection shows its members (or empty state).

- [x] **Step 4b - Collection detail: edit and delete** - add edit and delete actions to the manual collection detail page. Edit opens a dialog (same form as create, pre-filled) calling `updateCollection`. Delete shows a confirmation dialog then calls `deleteCollection` and redirects to `/collections`. Only shown for manual collections, never system. *Done when:* editing a collection's name/color/icon updates immediately, and deleting redirects to the list page with the collection gone.

- [x] **Step 5 - Game detail: add to collection** - create `src/components/games/CollectionsSection.tsx` as a client component. Shows the collections the current game belongs to (as removable chips) and a "Add to collection" button that opens a popover listing manual collections not yet containing this game. Selecting one calls `addGameToCollection`. Removing calls `removeGameFromCollection`. Add the section to the game detail page after the Tags section. Update the game detail page query to include `collections: { include: { collection: true } }` on the Game fetch. *Done when:* from `/games/[id]`, adding the game to a collection updates the section, removing it updates immediately, and the collection detail page reflects the change.

- [x] **Step 6 - Library filter by collection** - add a collection filter to `LibraryFilters.tsx` and the library page query. The filter dropdown lists manual collections and system collections. Selecting a collection switches the library query to filter by collection membership (manual) or the system collection's query predicate (system). The filter is applied alongside existing source/state/search filters. *Done when:* selecting a collection in the library filter shows only games in that collection, and clearing the filter restores the full list.

- [x] **Step 7 - Navigation update** - add a "Collections" nav item to `AppNav.tsx` with `href="/collections"` and the `FolderOpen` icon from lucide-react. Place it between "Library" and "Wishlist". *Done when:* the nav item highlights when active on `/collections` or `/collections/[id]`, and is visible on both desktop sidebar and mobile bottom nav.

## Files / areas

- `src/actions/collections.ts` - server actions (step 1)
- `src/actions/collections.test.ts` - unit tests (step 1)
- `src/lib/system-collections.ts` - system collection queries (step 2)
- `src/lib/system-collections.test.ts` - unit tests (step 2)
- `src/app/(app)/collections/page.tsx` - collections list page (step 3)
- `src/components/games/CreateCollectionDialog.tsx` - create collection dialog (step 3)
- `src/components/games/CollectionColorPicker.tsx` - shared color picker (steps 3, 4b)
- `src/components/games/CollectionDetailActions.tsx` - edit/delete actions (step 4b)
- `src/app/(app)/collections/[id]/page.tsx` - collection detail page (steps 4a, 4b)
- `src/components/games/CollectionsSection.tsx` - game detail collections widget (step 5)
- `src/components/games/LibraryFilters.tsx` - add collection filter (step 6)
- `src/app/(app)/library/page.tsx` - add collection filter logic (step 6)
- `src/app/(app)/games/[id]/page.tsx` - add CollectionsSection + collection memberships in query (step 5)
- `src/app/(app)/_components/AppNav.tsx` - add Collections nav item (step 7)

## Data / contracts

- `Collection` model (already in schema): `id`, `name` (unique), `color?`, `icon?`, `isSystem`, `createdAt`
- `CollectionMembership` model (already in schema): composite PK `(collectionId, gameId)`, `addedAt`
- System collection IDs are string constants: `play-soon`, `replay-candidates`, `favorites`, `hidden`, `abandoned`
- Server actions return `{ success: boolean, data: T | null, error: string | null }` (matches existing pattern)

## Testing

- **Unit tests (Vitest):** each server action gets tests for happy path, validation failure, and edge cases (duplicate name, idempotent add/remove). System collection queries get tests for correct filtering logic. Test files live next to source files.
- **Browser verification:** navigate to `/collections`, create a collection, add games from game detail, filter library by collection, verify system collections show correct games. Screenshot evidence for UI steps.

## Notes for the AI

- Follow existing action pattern from `src/actions/games.ts`: `requireUser()`, Zod parse, Prisma transaction, `{ success, data, error }`.
- System collections use the same query patterns as the library page; reuse the filter logic.
- Collection name uniqueness is case-insensitive; normalize to lowercase for the unique check or use Prisma's `mode: "insensitive"` on the where clause.
- The `Collection.isSystem` field exists in the schema but system collections are never stored in the DB - they are purely computed. Only manual collections have DB rows.
- When adding the collection filter to the library, preserve the existing filter/sort/search logic; the collection filter is additive.
- Use shadcn/ui `Dialog` for the create/edit collection dialog (already available in `src/components/ui/dialog.tsx`).
- Use `Popover` or `Command` from shadcn/ui for the add-to-collection dropdown on game detail.

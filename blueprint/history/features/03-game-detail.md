# Feature: Game detail

**From build-plan:** feature 3
**Status:** not started

## Goal

Turn the `/games/[id]` stub into a real game detail page showing metadata,
availability, record origin, and editable personal fields (priority, interest,
rating, notes, preferred environment). This is where the owner enriches a game
after adding it - every downstream signal (play state, recommendations, compat,
collections) will read from these fields.

## Design reference

None - no visual mockup exists. Uses existing shadcn/ui components from feature 2
(Button, Input, Select, Label, Dialog) and the app shell.

## In scope

- Game detail page at `/games/[id]` (replaces the stub):
  - Game name (heading), type, origin, created date
  - Availability section showing all `GameAvailability` rows (source, display name)
  - Personal fields form (all editable, save via server action):
    - Priority (NONE / LOW / MEDIUM / HIGH)
    - Interest (1-5, optional)
    - Rating (1-10, optional)
    - Preferred environment (BAZZITE / STEAM_DECK / WINDOWS, optional)
    - Notes (free text, optional)
  - Play state shown read-only (managed by feature 4)
  - Tags section: display existing tags + add new tags (inline input + add button)
- Server action `updatePersonalFields` (updates `LibraryEntry` fields)
- Server action `addTagToGame` (creates or reuses a `PersonalTag`, links via `GameTag`)
- Unit tests for both server actions (Zod validation, edge cases)

## Out of scope

- Metadata snapshots from external providers (RAWG, Steam API) - feature 11+
- Play state management and main-game constraint (feature 4)
- Collections (feature 5)
- Compatibility display (feature 11)
- Recommendation explanation (feature 12)
- Edit or delete the game record itself
- Remove tags from a game (the remove path belongs with a later tag management feature)
- `ExternalGameId` display (no external IDs on manual games)

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

- [x] **Step 1 - Server actions** - Add `src/actions/game-detail.ts` with two server actions:

  **`updatePersonalFields(gameId, input)`** - Validates with Zod (priority enum optional, interest 1-5 optional, rating 1-10 optional, preferredEnvironment enum optional, notes optional string), calls `requireUser()`, finds the `LibraryEntry` by `gameId`, updates only the provided fields via `prisma.libraryEntry.update`. Returns `{ success, data, error }`.

  **`addTagToGame(gameId, tagName)`** - Validates `tagName` (string, min 1), calls `requireUser()`, upsert the `PersonalTag` by unique name (create if absent), then create the `GameTag` join row (skip if already exists via upsert or catch unique constraint). Returns `{ success, data, error }`.

  Add `src/actions/game-detail.test.ts` with unit tests: valid update writes correct fields, interest out of range rejected, rating out of range rejected, valid tag creates PersonalTag + GameTag, empty tag name rejected. Mock Prisma with `vi.mock()`.

  *Done when:* `pnpm test` passes with the new test file and `pnpm typecheck` succeeds.

- [x] **Step 2 - Game detail page** - Replace the stub at `src/app/(app)/games/[id]/page.tsx` with a server component that queries the game (with `libraryEntry`, `availability`, and `tags.tag` relations), renders:
  - Heading: game name
  - Metadata section: type badge, origin label, created date
  - Availability section: table or list of `GameAvailability` rows (source label, display name)
  - Read-only play state from `libraryEntry.playState` (labeled "Play state (managed by play states feature)"). Guard `libraryEntry` being null (show "Not in library" for the personal fields section if missing, though the current create path always creates one).
  - Not-found games still redirect to `/library` (existing behavior)

  *Done when:* navigating to `/games/<id>` shows the game name, type, origin, availability list, and play state. `pnpm build` succeeds.

- [x] **Step 3 - Personal fields form** - Add `src/components/games/PersonalFieldsForm.tsx` as a client component. Displays current values from the `LibraryEntry` and lets the owner edit: priority select (NONE/LOW/MEDIUM/HIGH), interest number input (1-5, blank for unset), rating number input (1-10, blank for unset), preferred environment select (none/BAZZITE/STEAM_DECK/WINDOWS), notes textarea. On submit calls `updatePersonalFields` server action. Shows a success toast on save, inline validation errors on failure. Mount it in the game detail page. *Done when:* changing a field and saving shows a toast, the page reflects the new value on refresh, and out-of-range values show an error. `pnpm build` succeeds.

- [x] **Step 4 - Tags section** - Add `src/components/games/TagsSection.tsx` as a client component. Displays existing tags as badge chips (read from the game's `tags` relation). Below the tags, a text input + "Add" button that calls `addTagToGame`. On success, the new tag appears as a chip (refresh the page or optimistically update). On empty input, show inline validation. Mount it in the game detail page below the personal fields form. *Done when:* typing a tag name and clicking Add creates the tag (visible on refresh), and adding the same tag again is idempotent. `pnpm build` succeeds.

## Files / areas

| File | Action |
|------|--------|
| `src/actions/game-detail.ts` | Create - `updatePersonalFields` + `addTagToGame` server actions |
| `src/actions/game-detail.test.ts` | Create - unit tests for both actions |
| `src/app/(app)/games/[id]/page.tsx` | Replace - full game detail page (server component) |
| `src/components/games/PersonalFieldsForm.tsx` | Create - client form for personal fields |
| `src/components/games/TagsSection.tsx` | Create - client component for tag display + add |

## Data / contracts

- **Game** (existing) - `id`, `type`, `origin`, `name`, `createdAt`
- **LibraryEntry** (existing) - `id`, `gameId` (unique), `playState`, `priority`, `interest` (1-5), `rating` (1-10), `preferredEnvironment`, `notes`, `createdAt`, `updatedAt`
- **GameAvailability** (existing) - `id`, `gameId`, `source`, `displayName`
- **PersonalTag** (existing) - `id`, `name` (unique, case-insensitive)
- **GameTag** (existing) - `gameId` + `tagId` (composite PK)

`updatePersonalFields` input shape (load-bearing for features 4, 12):

```ts
{
  priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH"
  interest?: number | null   // 1-5, null = unset
  rating?: number | null     // 1-10, null = unset
  preferredEnvironment?: "BAZZITE" | "STEAM_DECK" | "WINDOWS" | null
  notes?: string | null
}
```

`addTagToGame` input shape:

```ts
{
  tagName: string  // min 1, trimmed
}
```

## Testing

- **Step 1:** Unit tests for both server actions:
  - `updatePersonalFields` - valid update, interest out of range (0, 6), rating out of range (0, 11), partial update (only some fields)
  - `addTagToGame` - valid tag, empty name rejected, idempotent re-add (same tag + game)
  - Mock Prisma transactions and creates with `vi.mock()`.
- **Steps 2-4:** UI and integration steps verified via build evidence. No unit tests for components.

Vitest is configured (`pnpm test`). The test gate is on.

## Notes for the AI

- Server components by default. `PersonalFieldsForm` and `TagsSection` need `"use client"`.
- Call `requireUser()` at the top of both server actions.
- `updatePersonalFields` only updates `LibraryEntry` rows, never the `Game` itself. Use `prisma.libraryEntry.update({ where: { gameId }, data: { ... } })`.
- `addTagToGame` should upsert the `PersonalTag` (create if the name doesn't exist) then create the `GameTag` join row. Catch `P2002` (unique constraint) on the `GameTag` to handle idempotent re-adds gracefully.
- The `PersonalTag.name` unique constraint is case-sensitive in Prisma but the product model says case-insensitive. For now use Prisma's default; a later normalization pass can add `lower()` on the name.
- `interest` is 1-5 and `rating` is 1-10 per the product model in `project-overview.md`. Use Zod `.int().min().max()` with `.optional().nullable()`.
- The game detail page should include `libraryEntry`, `availability`, and `tags.tag` in the Prisma `include` to avoid N+1.
- For the personal fields form: number inputs send empty string when cleared; transform to `null` before sending to the server action. Use `z.preprocess` or manual transform in the action.
- For `preferredEnvironment` select: use a "Not set" option with value `""` to represent unset, transform to `null`.
- Import shadcn/ui components from `@/components/ui/` (Button, Input, Select, Label, Textarea if available - or use a plain `<textarea>` with Tailwind classes).
- The `notes` field is optional free text. Use a `<textarea>` element. Either add the shadcn Textarea via `pnpm dlx shadcn add textarea` during the build step, or use a plain `<textarea>` styled with Tailwind's `border-input bg-transparent rounded-lg` classes to match the existing inputs.

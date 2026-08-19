# Feature: Edit game and availability details

**From build-plan:** feature 7c
**Status:** not started

## Goal

Allow the owner to correct a game's name and the editable fields shown in its
Availability section directly from `/games/[id]`, while preserving immutable
game origin, Steam identity, and synchronized provider statistics.

## In scope

- Add a game-name edit control on the game detail page.
- Edit `GameAvailability.displayName` for every availability row.
- Edit `GameAvailability.source` for every availability row using `STEAM`,
  `OTHER_PLATFORM`, or `ROM`.
- Keep `Game.origin` read-only, and keep Steam technical statistics protected
  even when the availability source is edited.
- Save changes through authenticated Server Actions with Zod validation.
- Show success and failure feedback without losing unsaved form values.
- Add unit coverage for validation, authorization entry, partial updates, and
  protection of Steam-backed fields.

## Out of scope

- Adding or deleting availability rows.
- Editing `steamAppId`, `steamPlaytimeTotal`, or `steamLastPlayed`.
- Editing `ExternalGameId`, `Game.origin`, game type, DLC relationships, tags,
  collections, or personal library fields.
- Provider enrichment, automatic conflict resolution, or audit history for
  metadata edits.
- Multi-user permissions; the existing single-user `requireUser()` boundary
  remains the authorization model.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); the user reads and understands it.
4. The user approves before the next step or an optional checkpoint commit.
   `/complete` makes the feature-level commit later.

Never accept a step that has not been read. If a diff is too big to review, split
the step.

## Build steps

- [x] **Step 1 - Mutation contracts and server actions** - Add typed, Zod-
  validated actions for updating the game name and one availability row. The
  availability action must update `source` and `displayName` without accepting
  technical fields. Add focused
  Vitest coverage for valid updates, blank names, malformed IDs, invalid
  sources, and protected Steam fields. *Done when:* `pnpm test` and
  `pnpm typecheck` pass, and the tests prove the protected-field behavior.*

- [x] **Step 2 - Detail-page editing UI** - Add focused client components for
  the game name and availability-row forms, mount them in the existing detail
  page, and preserve the current read-only presentation for technical Steam
  statistics. The UI must keep game origin read-only and send only the fields
  supported by the server action. *Done when:* the detail page renders edit
  controls, all three availability source options are available, and origin
  and technical Steam values cannot be edited;
  `pnpm build` succeeds.*

- [x] **Step 3 - Save feedback and manual verification** - Add pending,
  success, validation, and server-error states consistent with existing detail
  forms; refresh or reconcile the displayed values after a successful save.
  Verify a manual row and a Steam-imported row through the running app. *Done
  when:* changing the game name and an availability row survives a page
  refresh, an invalid submission shows a useful error, all three source values
  can be selected, and Steam technical values (App ID, playtime, and
  last-played) remain protected.*

## Files / areas

| File / area | Expected change |
|---|---|
| `src/actions/game-detail.ts` or a focused catalog-detail action module | Add name and availability update actions, schemas, and result types |
| `src/actions/game-detail.test.ts` or focused action tests | Add unit tests for validation and protected Steam fields |
| `src/app/(app)/games/[id]/page.tsx` | Pass game name and availability data into edit components |
| `src/components/games/` | Add focused client forms or row editor components |
| `prisma/schema.prisma` / migrations | No schema change expected; verify existing fields are sufficient |

## Data / contracts

Existing load-bearing models:

- `Game`: update only `name`; preserve `id`, `type`, `origin`, `baseGameId`, and
  all external IDs.
- `GameAvailability`: update `displayName` and `source` for all rows using
  `STEAM | OTHER_PLATFORM | ROM`; preserve `steamAppId`,
  `steamPlaytimeTotal`, `steamLastPlayed`, `gameId`, and `addedAt`.

Proposed action inputs:

```ts
updateGameName(gameId: string, input: { name: string })

updateGameAvailability(
  availabilityId: string,
  input: {
    source?: "STEAM" | "OTHER_PLATFORM" | "ROM"
    displayName?: string | null
  },
)
```

The action must load the target row server-side before updating it. It must not
accept technical-field updates through an unfiltered object. `Game.origin` is
not part of either update contract.

## Testing

- **Step 1:** Vitest unit tests for valid name/display-name updates, trimming,
  blank-name rejection, unknown IDs, invalid enum values, manual source
  changes to all three source values, and rejection/ignoring of attempted
  technical-field mutation.
- **Step 2:** `pnpm typecheck` and `pnpm build`; no component-only unit tests are
  required.
- **Step 3:** Manual browser verification at `/games/[id]` with one manual row
  and one Steam-imported row, including refresh persistence and error states.
- Run `pnpm lint` and `git diff --check` before completion, reporting lint
  separately from typecheck and tests.

## Notes for the AI

- Keep the page as a Server Component by default; only interactive editors
  should use `"use client"`.
- Call `requireUser()` before database access in each Server Action, following
  the existing single-user auth convention.
- Use Prisma for mutations and return the established
  `{ success, data, error }` shape.
- Validate and trim the game name and display name with Zod. An empty optional
  display name should be stored as `null`.
- Do not expose or update Steam provider statistics from the client. Steam sync
  owns those values, and a future sync must remain able to refresh them. The
  availability source itself is still editable; `Game.origin` is not.
- Reuse the existing shadcn `Select` styling used by the other detail-page
  dropdowns; do not introduce a native selector for this field.
- This feature does not need a design reference: it extends the existing game
  detail UI and has no replication target or new visual system.

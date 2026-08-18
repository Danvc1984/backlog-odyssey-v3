# Feature: Merge and delete

**From build-plan:** feature 7b
**Status:** not started

## Goal

Give the owner a safe, explicit way to consolidate an open base-game duplicate or
remove a catalog game, while preserving compatible catalog relationships and
providing a reload-safe 15-second Undo window for every destructive operation.

## Design reference

None (no visual target).

## In scope

- Merge only the two base games named by an `OPEN` `PossibleDuplicate`.
- Two-phase merge flow: editable proposal, then complete explicit confirmation.
- Suggested survivor selection that prefers `STEAM_IMPORT`, with manual survivor
  selection available.
- Editable final name and field-by-field personal-value conflict resolution.
- Conservative relation union and deduplication for current catalog relations.
- Explicit blocking and resolution for same-namespace external-ID conflicts and
  other non-unionable one-to-one relations.
- Reassignment of all DLC from the discarded base to the survivor without
  automatically deleting equivalent DLC.
- Delete for a base game or an individual DLC, with a base-game confirmation that
  lists the DLC that will cascade.
- Transactional merge and delete through a persistent `CatalogOperation` record.
- Temporary exact snapshots sufficient to undo the operation, with operation
  overlap protection, expiry, cleanup, and reload-safe Undo.
- Duplicate-pair cleanup/remapping caused by merge or delete.
- Catalog action controls on duplicate review and game detail.

## Out of scope

- Direct DLC-to-DLC merge. DLC merge remains deferred to feature 9.
- Automatic duplicate detection, automatic merge, or automatic delete during
  Steam sync.
- Fuzzy duplicate matching or changes to the 7a detection algorithm.
- Permanent audit history, soft-delete tombstones, or off-site backups.
- Provider refreshes, RAWG enrichment, pricing, compatibility fetching, wishlist
  screens, or recommendation generation. Existing rows for those relations are
  preserved or moved only as needed for catalog integrity.
- New catalog types, bulk selection, bulk merge, or bulk delete.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); the owner reads and understands it.
4. The owner approves, then chooses whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` makes the real feature-level commit.

Never accept a step that has not been read. If a diff is too big to review, split
the step before implementation.

## Build steps

- [x] **Step 1 - Catalog operation persistence and snapshot primitives** - Add
  `CatalogOperation` schema support, migration, operation enums, authenticated
  operation-user lookup, typed snapshot envelopes, affected-game overlap checks,
  and expiry helpers. Keep snapshots nullable after terminal cleanup. *Done
  when:* the migration is present and inspectable, `prisma migrate status` is
  synchronized in a configured database, and unit tests cover operation states,
  expiry calculation, user lookup boundaries, and overlap detection without
  allowing an unauthenticated database access path.

- [x] **Step 2 - Merge proposal contract and server action** - Add a read-only
  proposal action for an open duplicate. It loads both base games and their
  current relations, suggests the Steam-import survivor (then deterministic ID
  order), calculates the editable final name and personal-field values, lists
  unionable relations, and returns explicit conflicts/blockers. The proposal must
  reject dismissed, missing, non-base, or already-mutated pairs. *Done when:*
  unit tests cover valid proposals, survivor preference, missing/null values,
  personal-field conflicts, same-namespace external-ID conflicts, one-to-one
  relation conflicts, DLC counts, and invalid duplicate states.

- [x] **Step 3 - Transactional merge and exact undo snapshot** - Add the validated
  merge execution action. Recheck authentication, the open duplicate, current
  game versions, all conflict resolutions, and operation overlap inside the
  transaction. Apply the chosen survivor/name and personal values, union and
  deduplicate compatible relations, reassign DLC, remap or remove duplicate
  pairs, snapshot every changed/deleted row, delete the discarded base, and create
  one `PENDING` `CatalogOperation` with a 15-second expiry. *Done when:* unit
  tests prove atomic success, invalid or stale proposals make no writes, same
  namespace conflicts remain blocked, collections/tags/availability are not
  lost, one-to-one conflicts use the selected side, DLC is reassigned rather than
  silently deleted, and the operation contains enough exact data to restore the
  pre-merge graph.

- [x] **Step 4 - Merge editor and confirmation UI** - Add a client merge dialog
  reachable from each open duplicate. Show both records, suggested and chosen
  survivor, editable final name, field-by-field personal conflicts, external-ID
  and one-to-one relation conflicts, DLC/relation preview, blockers, and a final
  confirmation summary. Submit only a complete valid proposal, show a loading
  state and error toast, refresh the page after success, and expose the pending
  Undo affordance returned by the operation. *Done when:* browser verification
  can open a duplicate, change the survivor/name and conflict choices, refuses
  confirmation while blockers remain, confirms once, and shows the survivor with
  the discarded record gone.

- [x] **Step 5 - Transactional delete and cascade preview** - Add delete preview
  and execution actions for any game. A base-game preview includes its direct DLC
  and all affected catalog relations; a DLC preview is limited to that DLC. The
  confirmed delete stores an exact restoration snapshot, deletes in one
  transaction using the existing cascade rules, and creates a `PENDING`
  `CatalogOperation`. *Done when:* unit tests cover base-game cascade, individual
  DLC deletion, missing IDs, stale/overlapping operations, atomic rollback, and
  complete snapshot coverage for the rows that disappear.

- [x] **Step 6 - Delete confirmation UI and catalog entry points** - Add delete
  controls to game detail and the DLC section where applicable. Show the affected
  names and consequences, require one explicit confirmation without a second
  confirmation step, redirect safely when the current game is deleted, and use
  the shared operation feedback. *Done when:* browser verification can delete a
  DLC without deleting its base, delete a base while seeing every directly owned
  DLC listed, and reach the library after deletion with a success message.

- [x] **Step 7 - Reload-safe Undo and operation lifecycle** - Add a persistent
  operation status/read action and Undo action usable after a page reload. Undo
  must validate that the operation is still `PENDING`, unexpired, and has no
  overlapping pending operation before restoring rows in dependency order and
  marking it `UNDONE`. Expired or terminal operations must reject Undo and clear
  their snapshot. Operations on disjoint games may coexist; overlapping pending
  operations are blocked. *Done
  when:* unit tests and browser verification prove merge Undo, delete Undo,
  reload before Undo, expiry rejection, terminal-state rejection, disjoint
  concurrent operations, overlap blocking, and no partial restoration after a
  failed restore.

## Files / areas

- `prisma/schema.prisma` and `prisma/migrations/<timestamp>_catalog_operations/`
  - operation state/type and persistent reversible snapshot storage.
- `src/lib/catalog-operations.ts` - operation identity, expiry, overlap, typed
  snapshot envelopes, relation planning, and restoration helpers.
- `src/actions/catalog-operations.ts` - merge proposal/execute, delete
  preview/execute, operation status, and Undo server actions.
- `src/actions/catalog-operations.test.ts` - unit tests for validation, merge,
  delete, overlap, expiry, and restoration behavior.
- `src/components/games/MergeGamesDialog.tsx` - editable two-phase merge flow.
- `src/components/games/DeleteGameDialog.tsx` - delete preview and confirmation.
- `src/components/games/DlcSection.tsx` or equivalent game-detail relation view -
  list DLC and expose individual DLC deletion without hiding the base-game
  relationship.
- `src/components/games/CatalogOperationToast.tsx` or equivalent shared client
  feedback - pending Undo and terminal/error states.
- `src/components/games/DuplicatesList.tsx` and
  `src/components/games/DuplicateActions.tsx` - merge entry point and refresh.
- `src/app/(app)/games/[id]/page.tsx` and related game/DLC presentation - merge
  context, delete action, and safe redirect.
- `src/app/(app)/library/page.tsx` or the duplicate review route - operation
  feedback and post-operation refresh.

## Data / contracts

### `CatalogOperation`

Add a persistent model linked to the authenticated `User`:

- `id`: independent operation ID.
- `userId`: operation owner, resolved from the authenticated session email, never
  supplied by the client.
- `type`: `MERGE` or `DELETE`.
- `state`: `PENDING`, `UNDONE`, `EXPIRED`, or `COMPLETED`.
- `affectedGameIds`: scalar list of every game directly deleted or mutated,
  including directly reassigned/deleted DLC.
- `snapshot`: nullable versioned JSON envelope containing exact pre-operation
  rows and restoration order. It is cleared for terminal operations.
- `createdAt`, `updatedAt`, and `expiresAt`.

`PENDING` means the operation completed and remains undoable until `expiresAt`.
Successful Undo becomes `UNDONE`. A normal expiry becomes `COMPLETED` after the
snapshot is cleared. A late or invalid Undo attempt may mark the stale operation
`EXPIRED` while clearing its snapshot. No terminal state is undoable.

### Merge proposal and execution

- Proposal input identifies one `PossibleDuplicate` ID only.
- The proposal contains both base-game summaries, the suggested survivor, the
  editable final name, current `LibraryEntry` values, DLC summaries, and relation
  counts/conflicts.
- Execution input repeats the duplicate ID, survivor ID, final name, every
  field-level personal choice, and explicit choices for each reported
  one-to-one or same-namespace conflict. The server recomputes and validates the
  proposal rather than trusting a client snapshot.
- `LibraryEntry` conflicts cover play state, main-game flag, priority, interest,
  rating, preferred environment, compatibility override status/reason, play-soon,
  replay-candidate, hidden, and notes. A value present on only one side is the
  default; differing non-null values require a side/value choice.
- `ExternalGameId` rows union when their namespace is unique to one side. Two
  different IDs in the same namespace block the merge until the user selects one
  exact row. The selected row is retained and the other is not silently chosen.
- Availability, collections, tags, recommendation references, and duplicate
  relationships use conservative union/remap behavior with primary-key
  deduplication. Steam availability keeps the most informative playtime/latest
  played values when the same logical Steam row is duplicated.
- DLC children from the discarded base are reassigned to the survivor. Similar or
  equivalent DLC records remain separate and are never auto-deleted by merge.
- At most one wishlist entry, compatibility snapshot per provider, and
  environment-compatibility row per environment can survive. If both sides have
  one, the proposal reports a conflict and execution requires an explicit side
  selection. The selected row is moved to the survivor and the other row is
  removed only as part of the confirmed merge, with both rows in the Undo
  snapshot.
- Metadata snapshots are rebuildable provider data. The newest row per provider
  is retained for the survivor; all changed/deleted rows are included in the
  snapshot. This avoids inventing a personal conflict for provider cache data.
- Duplicate pairs involving the discarded game are remapped to the survivor when
  possible and deduplicated by ordered pair. Existing review state is preserved;
  the confirmed pair disappears through the discarded-game cascade.

### Delete and restoration

- Delete accepts a validated game ID and returns a preview with the target and,
  for a base game, every direct DLC that will cascade.
- Base-game delete relies on the schema's `Game.baseGameId onDelete: Cascade`.
  The snapshot captures the base, direct DLC, and every dependent row needed to
  restore the visible catalog graph exactly.
- DLC delete captures and restores only that DLC and its dependent rows; its base
  and sibling DLC remain untouched.
- Snapshot restoration recreates rows in dependency order, preserves original
  IDs/timestamps, and fails atomically if any expected conflicting row exists.

## Testing

- Vitest is configured and remains a gate for all logic-bearing steps.
- Unit tests cover pure operation helpers, proposal validation, merge planning,
  merge execution, delete planning/execution, ordered duplicate remapping,
  snapshot completeness, expiry, overlap protection, and exact restoration.
- Tests must include empty/missing/malformed IDs, dismissed or missing duplicate
  records, missing relations, null personal values, conflicting external IDs,
  duplicate join rows, stale proposals, expired operations, and transaction
  failures.
- UI components and database integration rendering are not unit-tested. Verify
  them with the running app, screenshots or visible state, and the build.
- Before a step is approved, run its focused tests plus `pnpm typecheck` and
  `pnpm lint`. The final feature gate also runs `pnpm test`, `pnpm typecheck`,
  `pnpm lint`, `git diff --check`, and the documented build command.
- Browser verification covers duplicate review, editable merge confirmation,
  merge result, base/DLC delete behavior, redirect, toast, page reload, and
  Undo within and after the 15-second window.

## Notes for the AI

- This is a single-user app, but every server action must call `requireUser()`
  before any database access. Resolve the `User` for `CatalogOperation` from the
  authenticated email after that guard; never accept a client user ID.
- Keep proposal reads separate from destructive execution. Recompute the current
  proposal inside the execution transaction to prevent stale or tampered choices.
- Use Prisma transactions for every merge, delete, and Undo. Do not rely on a
  client timer for safety; `expiresAt` is authoritative on the server.
- Preserve the existing `{ success, data, error }` action return pattern and Zod
  validation. Return stable, user-readable blocker/error codes or messages.
- Do not alter 7a normalized-name detection or make a dismissed duplicate mergeable
  without a new explicit review.
- Keep client components limited to dialogs, form state, router refresh, toast,
  and Undo presentation. Database reads, proposal calculation, authorization,
  and mutations stay server-side.
- Use current shadcn/ui and Tailwind conventions. Preserve accessible labels,
  keyboard confirmation, disabled/loading states, and mobile-friendly 44px
  action targets.
- The migration must be reviewed for PostgreSQL array/JSON support and Prisma
  generated types before implementation continues. Run `prisma migrate status`
  before any checkpoint or completion.
- Do not add RAWG, DLC queue, wishlist UI, pricing, compatibility fetching, or
  recommendation behavior while implementing this feature.

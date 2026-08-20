# Feature: DLC model and unresolved Steam queue

**From build-plan:** feature 9
**Status:** complete

## Goal

Provide full support for DLC catalog entries attached to an existing base game,
enforce strict base-game ownership and deletion cascade semantics, and maintain
a persistent review queue for owned Steam DLC whose base games are absent so the
owner can link, create base-plus-DLC together in one confirmation, or temporarily
discard them.

## In scope

- Strict DLC data model integrity: a catalog DLC (`type: DLC`) requires a valid
  parent base game (`baseGameId`), inherits origin/availability context, and
  cannot exist as an orphan in the catalog.
- Authenticated Server Action and dialog on the game detail page (`/games/[id]`)
  to manually add a DLC to any existing base game.
- Enhanced game detail UI:
  - Base-game view: dedicated DLC list with navigation to child DLC detail pages
    and an "Add DLC" action.
  - DLC view: prominent parent base-game link banner, "DLC" type badge, and
    suppressed child DLC section (preventing nested DLCs).
- Explicit deletion lifecycle: individual DLC deletion deletes only that DLC,
  while deleting a base game explicitly cascades to all attached DLCs with
  preview and undo safety.
- Persistent `UnresolvedSteamDlc` Prisma model with `PENDING` and `DISCARDED`
  states for Steam DLC whose base games are not in the catalog.
- Server-side resolution actions for unresolved Steam DLC:
  - Link DLC to an existing catalog base game.
  - Create base game and DLC together in one atomic confirmation.
  - Temporarily discard an item, keeping it stored while allowing next Steam
    sync to return it to pending if still unresolved.
  - Restore a discarded item back to pending review.
- Steam import and sync integration: detects owned Steam DLCs lacking a base
  game, populates the unresolved queue, and resets discarded status on sync.
- Dedicated Unresolved Steam DLC review UI accessible from Settings (and linked
  from Library when pending items exist), featuring searchable base-game linking,
  one-confirmation base creation, discard controls, and count badges.

## Out of scope

- Wishlist DLC entries, independent wishlist items, or wishlist-to-catalog
  acquisition (owned by Feature 10a).
- Price tracking, Mexican deal offers, or ITAD enrichment for DLC (owned by
  Feature 10b).
- Recommendation engine scoring or play-next inclusion for DLC (owned by
  Feature 12; DLCs remain excluded from play-next runs).
- Automatic fuzzy matching or silent auto-creation of base games without owner
  confirmation.
- Standalone or orphan DLCs without a base game in the catalog.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, `pnpm lint`, and the documented build check
   must pass before a step is accepted. UI controls also need live browser
   evidence.

Never accept a step that has not been read. If a diff is too large to review,
split the step before continuing.

## Build steps

- [x] **Step 1 - Data model constraints and catalog DLC creation action** -
  Add the `UnresolvedSteamDlc` model and `UnresolvedDlcStatus` enum to
  `prisma/schema.prisma` with a reviewed migration; create validated Server
  Actions to create a DLC attached to a base game and validate parent base-game
  existence, rejecting orphan DLC creation or adding DLC to another DLC.
  *Done when:* Vitest tests prove DLC creation succeeds for valid base games,
  fails with typed errors when `baseGameId` is missing, missing from database,
  or belongs to a DLC game, and database migration applies cleanly.

- [x] **Step 2 - Game detail UI for base games and DLCs** - Update
  `/games/[id]` and related components to support DLC workflows: add
  `CreateDlcDialog` on base-game detail pages, display child DLC list with direct
  links, render a parent base-game link banner and badge on DLC detail pages,
  suppress "Add DLC" on DLC detail pages, and verify individual DLC deletion
  and base-game cascade delete preview.
  *Done when:* live browser inspection on `/games/[id]` shows the "Add DLC"
  button and dialog on base games, child DLCs listed with working links, DLC
  detail pages displaying the parent base-game link, and delete preview
  correctly identifying single vs cascaded DLC deletion.

- [x] **Step 3 - Unresolved Steam DLC queue engine and resolution actions** -
  Implement server-side logic and actions for `UnresolvedSteamDlc`:
  `getUnresolvedSteamDlcs`, `linkUnresolvedDlc`, `resolveUnresolvedDlcWithNewBase`,
  `discardUnresolvedDlc`, and `restoreUnresolvedDlc`. Update Steam import and
  sync helpers to ingest unresolved Steam DLCs into the queue and re-activate
  discarded entries upon sync.
  *Done when:* Vitest unit tests prove linking creates a DLC and removes the
  queue item, creating base-plus-DLC atomically creates both records and removes
  the queue item, discarding marks status `DISCARDED`, and Steam sync re-activates
  discarded items when the base game is still absent.

- [x] **Step 4 - Unresolved Steam DLC review UI and queue workflows** -
  Build the review panel and resolution dialogs for unresolved Steam DLC in
  `/settings` (and provide a status badge / link in `/library` when pending
  items exist): searchable game picker for linking, one-step base creation form
  with pre-filled name, discard/restore toggles, and empty/completed states.
  *Done when:* browser inspection demonstrates reviewing an unresolved DLC,
  linking it to an existing game, creating a base-plus-DLC pair in one step,
  discarding and restoring items, and confirming immediate catalog and queue
  updates.

## Files / areas

- `prisma/schema.prisma` and a migration - add `UnresolvedDlcStatus` enum and
  `UnresolvedSteamDlc` model with indexes on `status` and unique `steamAppId`.
- `src/actions/dlc.ts` and `src/actions/dlc.test.ts` - validated Server Actions
  for catalog DLC creation and parent validation.
- `src/actions/unresolved-dlc.ts` and `src/actions/unresolved-dlc.test.ts` -
  validated Server Actions for unresolved Steam DLC listing, linking, atomic
  base-plus-DLC creation, discard, and restore.
- `src/actions/steam-import.ts`, `src/actions/steam-sync.ts`, `src/lib/steam-api.ts`
  and their test files - handle Steam DLC classification and unresolved queue
  ingestion / re-activation.
- `src/components/games/CreateDlcDialog.tsx` - client dialog for adding manual DLC
  from a base-game detail page.
- `src/components/games/DlcSection.tsx` - enhanced DLC section for base-game
  detail pages with "Add DLC" trigger and list.
- `src/components/games/ParentBaseGameBanner.tsx` - link banner shown on DLC
  detail pages.
- `src/components/steam/UnresolvedDlcReviewCard.tsx` and resolution dialogs -
  client review interface for unresolved Steam DLC in Settings.
- `src/app/(app)/games/[id]/page.tsx` - server-load parent base game when
  `game.type === 'DLC'` and render appropriate DLC UI.
- `src/app/(app)/settings/page.tsx` - render the unresolved Steam DLC review card.
- `src/app/(app)/library/page.tsx` - show badge / link to unresolved queue when
  pending items exist.

## Data / contracts

- `UnresolvedSteamDlc` model:
  - `id`: String @id @default(cuid())
  - `steamAppId`: String @unique
  - `name`: String
  - `steamBaseAppId`: String?
  - `status`: UnresolvedDlcStatus @default(PENDING) (`PENDING`, `DISCARDED`)
  - `discardedAt`: DateTime?
  - `createdAt`: DateTime @default(now())
  - `updatedAt`: DateTime @updatedAt
  - `@@index([status])`
- Catalog DLC rules:
  - A catalog DLC `Game` must have `type: "DLC"` and a non-null `baseGameId`
    referencing an existing `Game` with `type: "BASE_GAME"`.
  - A DLC cannot be a parent to another DLC (no nested DLC hierarchy).
  - Deleting a base game cascades to all attached DLCs via Prisma relation and
    is fully recorded in `CatalogOperation` snapshots for reload-safe Undo.
  - Deleting an individual DLC deletes only that DLC and leaves the parent base
    game intact.
- Unresolved Steam DLC queue contracts:
  - Input actions require `requireUser()`.
  - `linkUnresolvedDlc`: `{ unresolvedId: string, targetBaseGameId: string }`
    creates `Game` (`type: DLC`, `baseGameId: targetBaseGameId`, `origin: STEAM_IMPORT`),
    creates `ExternalGameId` (`STEAM_APP`, `steamAppId`), creates `GameAvailability`
    (`STEAM`, `steamAppId`), and deletes the queue record.
  - `resolveUnresolvedDlcWithNewBase`: `{ unresolvedId: string, baseGameName: string }`
    creates base `Game` (`type: BASE_GAME`, `origin: STEAM_IMPORT`, `libraryEntry: {}`,
    `availability: { source: STEAM, steamAppId: steamBaseAppId }`), creates DLC `Game`
    (`type: DLC`, `baseGameId: baseGame.id`, `origin: STEAM_IMPORT`, `availability: { source: STEAM, steamAppId: steamAppId }`,
    `externalIds: { STEAM_APP: steamAppId }`), and deletes the queue record.
  - `discardUnresolvedDlc`: `{ unresolvedId: string }` sets `status: "DISCARDED"`,
    `discardedAt: new Date()`.
  - `restoreUnresolvedDlc`: `{ unresolvedId: string }` sets `status: "PENDING"`,
    `discardedAt: null`.
  - Steam Sync / Import: when an owned Steam app is identified as DLC whose
    `steamBaseAppId` or matching base game is absent, it is upserted into
    `UnresolvedSteamDlc`. If previously `DISCARDED`, status is reset to `PENDING`.

## Testing

- Unit tests in Vitest for:
  - `src/actions/dlc.test.ts`: base-game validation, orphan rejection, nested
    DLC rejection, `{ success, data, error }` contract.
  - `src/actions/unresolved-dlc.test.ts`: link action, atomic base-plus-DLC
    action, discard, restore, invalid input, and non-existent record handling.
  - `src/actions/steam-import.test.ts` & `src/actions/steam-sync.test.ts`: queue
    ingestion on import/sync and re-activation of discarded items.
  - `src/lib/catalog-operations.test.ts`: verify individual DLC deletion vs
    base-game cascade deletion and undo snapshot restoration.
- Integration / browser verification:
  - Add manual DLC on a base game detail page and verify list updates.
  - Navigate to DLC detail page and verify parent link and "DLC" badge.
  - Delete individual DLC and verify base game remains.
  - Delete base game and verify deletion preview lists child DLCs.
  - Open Unresolved Steam DLC queue in Settings, link an item to an existing game,
    and create a base-plus-DLC pair in one step.
  - Discard an unresolved DLC, view discarded list, and restore it to pending.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` (or
  `pnpm exec next build --webpack` if Turbopack sandbox requires fallback).

## Notes for the AI

- Do not modify wishlist models or pricing; Feature 10a/10b explicitly owns
  wishlist DLC and Mexican price tracking.
- Do not modify recommendation scoring; Feature 12 owns recommendation
  engine rules (where DLCs are excluded from play-next).
- Preserve existing `CatalogOperation` merge and delete mechanics. Deleting a
  base game already cascades to its DLCs, which are captured in the snapshot.
- Keep server components as default. Modals and queue review actions use client
  components with standard shadcn/ui patterns and Sonner toasts.
- Follow project conventions: no em dashes, `{ success, data, error }` Server
  Action responses, Zod validation, and single-user authentication via `requireUser()`.
- Do not commit, merge, check off the build-plan item, or start implementation.
  `/complete` owns archive, checklist, and merge work after review.

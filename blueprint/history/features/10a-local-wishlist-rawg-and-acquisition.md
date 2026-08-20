# Feature: Local wishlist, RAWG, and acquisition

**From build-plan:** feature 10a
**Status:** complete

## Goal

Provide an independent, non-provisional local wishlist for base games and DLCs
attached to owned catalog games. Enable local interest ratings and notes,
independent RAWG metadata search and snapshots for base-game wishes, and manual
acquisition into the catalog that transfers metadata, creates availability,
removes the wishlist entry, and supports optional parent play-state transitions
for acquired DLCs.

## In scope

- Independent Wishlist data model:
  - `WishlistEntry` model representing unowned base games (standalone) or
    unowned DLCs (strictly linked to an existing catalog base game).
  - Fields: `name`, `type` (`BASE_GAME` or `DLC`), `baseGameId` (optional for
    base games, required for DLCs), `interest` (integer rating 1-5), `notes`,
    optional `steamAppId` / external identifier, `createdAt`, and `updatedAt`.
  - `WishlistMetadataSnapshot` model storing independent RAWG metadata snapshots
    for wishlist entries without corrupting or requiring catalog `Game` records.
  - Cascade and catalog integrity: deleting a catalog base game cascades to
    attached wishlist DLCs; merging catalog base games reassigns wishlist DLCs
    from the discarded game to the survivor.
- Wishlist CRUD server actions:
  - `createWishlistEntry`: validates base game (no parent allowed) vs DLC
    (requires valid catalog `BASE_GAME` parent), validates 1-5 interest range and
    non-empty name.
  - `updateWishlistEntry`: updates name, interest, notes, or external IDs.
  - `deleteWishlistEntry`: deletes a wishlist entry and its metadata snapshot.
  - `getWishlistEntries`: fetches wishlist entries with optional filtering by
    type (`ALL`, `BASE_GAME`, `DLC`) and interest level, including attached
    metadata and parent base-game names for DLCs.
- Wishlist RAWG metadata enrichment:
  - `searchWishlistRawg`: searches RAWG candidates for wishlist creation/editing.
  - `enrichWishlistEntryWithRawg`: fetches and stores `WishlistMetadataSnapshot`
    for a wishlist base-game entry with attribution and error handling.
  - `removeWishlistMetadata`: clears existing RAWG metadata snapshot from a
    wishlist entry.
- Manual acquisition workflow:
  - `acquireWishlistBaseGame`: atomically creates a catalog `Game`
    (`type: BASE_GAME`, `origin: MANUAL`), creates `GameAvailability` with the
    selected source (`STEAM`, `OTHER_PLATFORM`, `ROM`) preserving any Steam App
    ID, creates `LibraryEntry` (`playState: NOT_STARTED`), transfers any
    `WishlistMetadataSnapshot` to a catalog `MetadataSnapshot` plus
    `ExternalGameId` for RAWG, and removes the wishlist entry.
  - `acquireWishlistDlc`: atomically creates a catalog `Game` (`type: DLC`,
    `origin: MANUAL`, `baseGameId: parentId`), creates `GameAvailability`,
    creates `LibraryEntry`, removes the wishlist entry, and optionally applies
    a play-state transition or replay flag to the parent base game.
- Dedicated Wishlist UI (`/wishlist`):
  - Filter bar for type (`All`, `Base Games`, `DLC`) and interest rating.
  - "Add to Wishlist" dialog supporting base game entry (with optional RAWG
    search) or DLC entry (with searchable catalog base-game selector).
  - Wishlist item cards with title, type badge, parent base-game link for DLC,
    star/numeric interest rating, personal notes, RAWG banner image, genre tags,
    summary, attribution, and action menu.
  - Edit wishlist item dialog.
  - Acquisition modal:
    - Base games: choose acquisition source (`Steam`, `Other Platform`, `ROM`).
    - DLCs: confirmation with optional parent play-state transition options
      (`NOT_STARTED`, `IN_PROGRESS`, `PLAN_TO_PLAY`, `replayCandidate`).
- Game detail page integration (`/games/[id]`):
  - Display wishlist DLCs attached to the base game in a dedicated section with
    quick "Add wishlist DLC" and "Acquire" shortcuts.

## Out of scope

- Price tracking, Mexican Steam/ITAD price refresh, target prices
  (`targetPriceMxn`), deals, discount calculations, or background price
  schedulers (owned by Feature 10b).
- Recommendation engine scoring, buy recommendation ranking, or recommendation
  runs (owned by Feature 12).
- Automatic Steam wishlist import or OAuth sync (Steam sync remains manual and
  separate; automatic wishlist sync is outside MVP).
- Standalone or orphan wishlist DLCs without an owned catalog base game.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at
   the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Wishlist database schema and catalog integrity integration** -
  Update `prisma/schema.prisma` to decouple `WishlistEntry` from 1:1 catalog
  `Game`, adding `name`, `type`, `baseGameId` (foreign key to catalog `Game`),
  `interest`, `notes`, `steamAppId`, and `WishlistMetadataSnapshot` model; update
  `src/lib/catalog-operations.ts` and merge/delete helpers to handle wishlist
  DLC relations on base game merge and cascade delete; generate Prisma client
  and run migration.
  *Done when:* `pnpm prisma:migrate` applies cleanly, and existing catalog
  operations unit tests pass with updated wishlist relation semantics.

- [x] **Step 2 - Wishlist CRUD server actions and validation** - Implement
  validated Server Actions in `src/actions/wishlist.ts`: `createWishlistEntry`,
  `updateWishlistEntry`, `deleteWishlistEntry`, and `getWishlistEntries`. Enforce
  single-user authorization, Zod schema validation, 1-5 interest bounds, and
  strict DLC parent constraints (DLC must link to an existing catalog base game;
  base game cannot link to a parent).
  *Done when:* Vitest tests in `src/actions/wishlist.test.ts` pass, proving CRUD
  mutations, validation rejections for invalid inputs/orphan DLCs, and filtering.

- [x] **Step 3 - Wishlist RAWG search and snapshot enrichment** - Implement
  RAWG integration for wishlist entries in `src/actions/wishlist-rawg.ts` (or
  integrated with `wishlist.ts`): search RAWG suggestions by title, fetch
  normalized RAWG payload, persist `WishlistMetadataSnapshot`, clear snapshot,
  and handle attribution and provider errors gracefully without corrupting
  wishlist state.
  *Done when:* Vitest tests in `src/actions/wishlist-rawg.test.ts` pass,
  verifying search formatting, snapshot persistence, error tolerance, and
  attribution data.

- [x] **Step 4 - Manual wishlist acquisition server actions** - Implement
  `acquireWishlistBaseGame` and `acquireWishlistDlc` in `src/actions/wishlist.ts`.
  Base-game acquisition creates a catalog `Game` (`origin: MANUAL`), creates
  `GameAvailability` with the selected source and retained `steamAppId`, creates
  `LibraryEntry`, transfers `WishlistMetadataSnapshot` to catalog
  `MetadataSnapshot` and `ExternalGameId`, and deletes the wishlist item. DLC
  acquisition creates a catalog DLC under the parent base game, creates
  availability, deletes the wishlist item, and optionally transitions the parent
  base game's play state.
  *Done when:* Vitest tests in `src/actions/wishlist-acquisition.test.ts` pass,
  proving atomic catalog creation, metadata transfer, wishlist deletion, and
  parent play-state updates.

- [x] **Step 5a - Wishlist page, filters, and cards** - Build the server-rendered
  `/wishlist` page with type and interest filters, wishlist cards, parent
  base-game names, and existing RAWG snapshot presentation.
  *Done when:* `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass,
  and `/wishlist` renders filtered base-game and DLC wishlist entries.

- [x] **Step 5b - Wishlist create/edit/delete dialogs** - Add the wishlist
  creation and edit dialogs, including base-game/DLC switching, catalog parent
  selection, editable RAWG candidate search with pagination and visible selected
  match, and delete actions. Keep Steam App ID and notes out of both forms;
  allow DLC parent reassignment while editing.
  *Done when:* the add, edit, and delete flows call the validated actions and
  refresh the visible wishlist state.

- [x] **Step 5c - Wishlist acquisition dialog** - Add source selection for base
  games, DLC acquisition confirmation, and parent play-state/replay options.
  *Done when:* both acquisition actions are reachable from cards and their
  successful results refresh the wishlist and library views.

- [x] **Step 5d - Base-game detail wishlist DLC section** - Update
  `/games/[id]` with attached wishlist DLCs and quick add/acquire shortcuts.
  *Done when:* a base-game detail page lists its wishlist DLCs and exposes the
  scoped actions without affecting unrelated game details.

## Files / areas

- `prisma/schema.prisma` - update `WishlistEntry` and add `WishlistMetadataSnapshot`.
- `prisma/migrations/*` - migration for updated wishlist models.
- `src/lib/catalog-operations.ts` & `src/actions/catalog-operations.ts` - update
  wishlist relation handling for merge and delete.
- `src/actions/wishlist.ts` - wishlist CRUD and acquisition server actions.
- `src/actions/wishlist.test.ts` - unit tests for wishlist CRUD.
- `src/actions/wishlist-rawg.ts` - wishlist RAWG search and snapshot actions.
- `src/actions/wishlist-rawg.test.ts` - unit tests for wishlist RAWG integration.
- `src/actions/wishlist-acquisition.test.ts` - unit tests for acquisition actions.
- `src/app/(app)/wishlist/page.tsx` - wishlist dashboard and catalog view.
- `src/components/wishlist/*` - UI components: `WishlistCard`, `WishlistList`,
  `WishlistFilterBar`, `AddWishlistDialog`, `EditWishlistDialog`,
  `AcquireWishlistDialog`, `WishlistRawgMatchDialog`.
- `src/components/games/DlcSection.tsx` or `/games/[id]/page.tsx` - show
  attached wishlist DLCs on base game detail pages.

## Data / contracts

### Schema updates (`prisma/schema.prisma`)

```prisma
model WishlistEntry {
  id             String                    @id @default(cuid())
  name           String
  type           GameType                  @default(BASE_GAME)
  baseGameId     String?
  interest       Int?                      // 1 to 5 rating
  notes          String?
  targetPriceMxn Decimal?                  @db.Decimal(10, 2) // Reserved for 10b
  steamAppId     String?
  sourcePreference String?                 // Reserved for 10b
  createdAt      DateTime                  @default(now())
  updatedAt      DateTime                  @updatedAt

  baseGame          Game?                  @relation("WishlistDlcToBase", fields: [baseGameId], references: [id], onDelete: Cascade)
  metadataSnapshot  WishlistMetadataSnapshot?
  offers            DealOffer[]
  refreshes         PriceRefresh[]

  @@index([baseGameId])
  @@index([type])
}

model WishlistMetadataSnapshot {
  id              String        @id @default(cuid())
  wishlistEntryId String        @unique
  provider        Provider      @default(RAWG)
  payload         Json
  sourceUrl       String?
  fetchedAt       DateTime      @default(now())
  expiresAt       DateTime?

  wishlistEntry   WishlistEntry @relation(fields: [wishlistEntryId], references: [id], onDelete: Cascade)

  @@index([wishlistEntryId, provider])
}
```

### Action contracts

- `CreateWishlistEntryInput`: `{ name: string; type: "BASE_GAME" | "DLC"; baseGameId?: string; interest?: number; notes?: string; steamAppId?: string; rawgId?: number }`
- `UpdateWishlistEntryInput`: `{ id: string; name?: string; interest?: number | null; notes?: string | null; steamAppId?: string | null }`
- `AcquireWishlistBaseGameInput`: `{ wishlistEntryId: string; source: "STEAM" | "OTHER_PLATFORM" | "ROM"; displayName?: string }`
- `AcquireWishlistDlcInput`: `{ wishlistEntryId: string; source?: "STEAM" | "OTHER_PLATFORM" | "ROM"; updateParentPlayState?: "NOT_STARTED" | "IN_PROGRESS" | "PLAN_TO_PLAY"; setParentReplay?: boolean }`

## Testing

- Unit tests (Vitest):
  - Wishlist CRUD: create base game, create DLC with valid parent, reject DLC with
    missing/invalid/DLC parent, update fields, delete entry, filter queries.
  - Wishlist RAWG: search candidate parser, metadata snapshot persistence,
    attribution creation, error resilience.
  - Acquisition: base game creation into catalog with availability, RAWG metadata
    transfer to catalog `MetadataSnapshot` + `ExternalGameId`, wishlist entry
    cleanup; DLC creation attached to base game, wishlist cleanup, parent
    play-state update.
- Manual browser verification:
  - Add base game wish with RAWG search and verify card with banner on `/wishlist`.
  - Add DLC wish linked to an existing catalog base game and verify parent link.
  - Filter wishlist by type and interest rating.
  - Acquire base game with "Other Platform", verify it appears in `/library` with
    transferred RAWG metadata, and verify it disappears from `/wishlist`.
  - Acquire DLC wish, verify prompt to update base game play state, verify DLC
    appears under base game on `/games/[id]`.
  - Delete catalog base game, verify attached wishlist DLC cascades safely.

## Notes for the AI

- Single-user Google auth: protect all Server Actions with `requireUserSession`
  from `src/lib/auth-guard.ts` (or `src/lib/auth.ts`).
- Server components fetch data directly with Prisma; client interactions use
  validated Server Actions.
- Return standard `{ success: true, data }` or `{ success: false, error }` from
  all actions.
- Map the DLC acquisition option `PLAN_TO_PLAY` to the existing
  `LibraryEntry.playSoon` flag; the current `PlayState` enum has no
  `PLAN_TO_PLAY` value.
- Use shadcn/ui components (`Dialog`, `Button`, `Input`, `Select`, `Badge`,
  `Card`) and Tailwind CSS v4 tokens.
- No em dashes in code comments, strings, or documentation.

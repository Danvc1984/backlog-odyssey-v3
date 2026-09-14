# Feature: Interest defaults across ingestion paths

**From build-plan:** feature 25
**Build attempt:** 1
**Branch:** feature/interest-defaults-across-ingestion-paths
**Status:** verified

## Goal

Give newly created base-game library entries and manual wishlist entries predictable interest values without changing the existing Steam wishlist, unresolved-DLC, or taste-setup behavior.

## In scope

- Set a newly imported Steam base game's `LibraryEntry.interest` to 2.
- Set a manually created catalog base game's `LibraryEntry.interest` to 3.
- Set manual wishlist creation's default interest to 3 in the server action and add-wishlist dialog.
- Make the wishlist edit dialog show 3 when an entry's stored interest is null.
- Copy a base-game wish's interest into its newly created catalog library entry on acquisition, using 3 when the wish has no interest.
- Keep acquired DLCs without a library entry or interest.
- Preserve Steam wishlist import, unresolved-DLC wish, and taste-setup interest values.

## Out of scope

- Adding an interest picker to the catalog Add Game dialog. Feature 26 owns that UI and IGDB suggestion flow.
- Changing existing users' persisted interest values, recommendation scoring, interest validation range, or database schema.
- Changing DLC acquisition's existing parent play-state options.

## Build loop

- Implement and review one checked step at a time; keep the application working after each step.
- Run focused Vitest coverage for each logic-bearing step, then `pnpm test` before review. Run `pnpm typecheck` and `pnpm build` before the final review because no configured `Verify` command exists.
- Checkpoint commits are not configured. `/complete` creates the final feature commit.

## Build steps

- [x] 1. Set creation-time library interest defaults in the server actions.
  - In `src/actions/steam-import.ts`, create newly imported base-game `LibraryEntry` records with interest 2, while preserving existing entries during later syncs.
  - In `src/actions/games.ts`, create manually added catalog base-game `LibraryEntry` records with interest 3.
  - In `src/actions/wishlist.ts`, create the catalog entry for an acquired base-game wish with that wish's 1-5 interest or 3 when it is null; retain the transaction that transfers metadata and deletes the wish.
  - Do not create a library entry or interest for acquired DLCs.
  - Add focused action tests for the Steam import, manual catalog create, base-game acquisition transfer and null fallback, and DLC non-creation behavior.
  - Done when each newly created base-game entry has its documented source-specific interest, an existing Steam library entry is not overwritten by sync, DLC acquisition still creates no library entry, and the focused Vitest tests pass.

- [x] 2. Apply manual wishlist defaults without changing import or setup flows.
  - In `src/actions/wishlist.ts`, default omitted manual wishlist interest to 3 while keeping explicit valid 1-5 input unchanged.
  - In `src/components/wishlist/AddWishlistDialog.tsx`, initialize and reset the manual-interest selection to 3, retaining its label, accessible select trigger, invalid/error feedback, and submit behavior.
  - In `src/components/wishlist/EditWishlistDialog.tsx`, initialize the editable selection to 3 only when the persisted interest is null; retain the actual stored value for non-null entries and all existing update behavior.
  - Add or update focused server-action tests for omitted and explicit manual wishlist interest. Do not alter Steam wishlist-import, unresolved-DLC, or taste-setup code paths or their existing expected values.
  - Done when new manual wishes save as interest 3 by default, the add and null-edit controls visibly select 3, explicit values persist unchanged, and focused Vitest tests pass.

- [x] 3. Verify regressions and the final user-visible paths.
  - Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
  - Manually verify the catalog Add Game flow, Add Wishlist flow, a null-interest wishlist edit flow, and base-game and DLC wishlist acquisition in the running app. Confirm saved values after reload and that errors remain associated with the dialogs.
  - Done when all three automated commands pass and manual review confirms the documented defaults, transfer, DLC exception, and normal error feedback.

## Files / areas

- `src/actions/steam-import.ts` and `src/actions/steam-import.test.ts` - new Steam base-game library-entry default and sync-preservation coverage.
- `src/actions/games.ts` and a colocated or existing action test area - manual catalog default.
- `src/actions/wishlist.ts`, `src/actions/wishlist.test.ts`, and `src/actions/wishlist-acquisition.test.ts` - manual wishlist default and acquisition transfer/fallback.
- `src/components/wishlist/AddWishlistDialog.tsx` - displayed manual wishlist default.
- `src/components/wishlist/EditWishlistDialog.tsx` - displayed null-interest edit default.

## Data / contracts

- `LibraryEntry.interest` and `WishlistEntry.interest` remain nullable integers validated as 1 through 5 when supplied. No migration or backfill is required.
- Creation defaults are source-specific: new Steam library base games receive 2; manual catalog base games and manual wishlist entries receive 3; acquired base-game catalog entries receive the wish's stored interest or 3 if null.
- An explicit valid manual wishlist interest overrides the default. Existing persisted interest and later Steam syncs are not rewritten by this feature.
- Only base-game acquisition creates a `LibraryEntry`; acquired DLCs remain catalog DLC records with no interest.
- Server actions remain authenticated through `requireUser`, validate input with Zod, and return the established `{ success, data, error }` shape. Client dialogs render action failures in their existing labeled dialog context.

## Testing

- Vitest unit tests for action payloads and non-overwrite behavior, mocking Prisma and authentication following adjacent action tests.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` before final review. No `verify` script or declared Verify command exists today.
- Manual browser review confirmed the catalog Add Game default, Add Wishlist default, null-interest wishlist edit default, base-game acquisition transfer, and DLC acquisition exception with persisted results after reload. The running app responded at `http://localhost:3500` with HTTP 200.

## Notes for the AI

- The critique separated the catalog interest picker from this work because feature 26 explicitly owns asking for catalog interest. This feature sets its creation default only.
- Preserve the existing atomic wishlist acquisition transaction: catalog creation, metadata transfer, and wishlist deletion stay together.
- Do not change the existing `interest: 2` Steam wishlist-import and unresolved-DLC paths or taste-setup behavior.
- Follow the project standards: strict TypeScript, focused functional components, Zod validation in server actions, and user-friendly action errors. Do not use em dashes in generated content.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7041,"specSha256":"88006ec7ae5165f9745123037e6128517dd20722636947f68a696b542c70c236","branch":"refs/heads/feature/interest-defaults-across-ingestion-paths","head":"2e86248c78efb6177d9da0d74071bca316e58426","baseRef":"refs/heads/main","baseCommit":"2e86248c78efb6177d9da0d74071bca316e58426","sourceTree":"8a3d4b18e710b7f4d29d164c666916a16b2ce885"} -->

## Manual try guide

### Start

Run `pnpm dev` from the project root and sign in with the allowed Google account.

### Open

Open the catalog and wishlist screens at `http://localhost:3500/library` and `http://localhost:3500/wishlist`.

### Do

1. Add a catalog game and inspect its personal interest value.
2. Add a wishlist base game without changing Interest.
3. Edit a wishlist entry whose stored interest is null.
4. Acquire a base-game wish with a stored interest and inspect the new catalog entry.
5. Acquire a DLC wish and inspect the resulting catalog DLC.
6. Run a Steam library import with a new base game and inspect its interest.

### Expect

Manual catalog and wishlist creation show 3/5. A null-interest wishlist edit selects 3/5. Base-game acquisition carries the wish value or uses 3/5 when null. New Steam library base games show 2/5. Acquired DLCs have no library entry or interest. Values remain correct after reload.

### Watch For

Existing Steam syncs must not overwrite personal interest. Steam wishlist import, unresolved-DLC wishes, and taste setup must retain their existing values. Watch for dialog errors that are not shown in the dialog or failed requests in the browser console.

### Confidence and gaps

Best signal: import a new Steam library base game and confirm it starts at 2/5 without changing an existing entry. Optional deeper checks cover all ingestion paths above. The provider-backed Steam import requires a connected Steam account and live credentials.

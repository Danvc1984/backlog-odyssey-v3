# Steam wishlist DLC resolution and search

**Type:** Fix

## The problem

When importing a Steam wishlist, the response can contain both a base game and
one of its DLCs. The wishlist import currently treats the DLC as unresolved when
its base is not in the main catalog, even if that base game is also in the
wishlist. It can therefore appear in **Unresolved Steam DLC**, whose wording and
actions are for DLC owned through the main catalog flow.

The DLC is also redundant when its base game is already a wishlist entry: the
base game's wishlist entry is sufficient and a second wishlist DLC entry should
not be created. The base game may be an existing wishlist entry or may be
created earlier in the same Steam wishlist import.

## The fix

- In the Steam wishlist import flow, match a DLC's base Steam App ID against
  both catalog base games and wishlist base games.
- Make the result independent of Steam's item order by making bases from the
  same import visible before resolving their DLCs, or by otherwise performing
  an equivalent two-phase resolution.
- If the base exists in the wishlist, skip the DLC entirely: do not create a
  redundant `WishlistEntry` and do not enqueue it in `UnresolvedSteamDlc`.
- If the base exists in the main catalog, preserve the existing behavior of
  creating the DLC as a wishlist entry linked to that catalog base.
- Preserve the queue source when resolving a pending item: `OWNED_SYNC`
  resolution creates an acquired catalog DLC, while `WISHLIST_IMPORT`
  resolution creates a wishlist DLC and never a catalog game.
- When a base game is imported into the catalog, automatically reconcile
  pending `WISHLIST_IMPORT` DLCs whose Steam base App ID matches it into linked
  wishlist DLC entries and remove those queue records.
- Preserve local wishlist data and the existing handling for a DLC whose base
  exists in neither place, except that the covered wishlist-base case must no
  longer appear in the unresolved owned-DLC review list.
- Add a URL-backed Wishlist search that matches game/DLC titles and DLC base
  game names while preserving the type and interest filters.

## Verification

- `pnpm test`: 50 test files, 477 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `git diff --check`: passed.
- `pnpm prisma migrate status`: database schema up to date.
- Manual Wishlist verification confirmed partial-title search updates `q`,
  returns the matching DLC, preserves type and interest query parameters, and
  supports the no-query filtered route.

## Findings

No findings were resolved by this fix. The existing unverified P3 performance
finding remains in `blueprint/context/findings.md` for later measurement.

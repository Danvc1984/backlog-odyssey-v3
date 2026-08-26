# Feature: Wishlist detail compatibility and enrichment controls (11c-c)

**From build-plan:** 11c-c (under 11. Compatibility synthesis > 11c. Wishlist detail)
**Status:** complete

## Goal

Finish the wishlist detail page as the single place to judge a wish: a read-only
compatibility block (ProtonDB tier, AWAY anti-cheat, derived Windows fallback)
for base-game wishes with a confirmed Steam identity, a quiet per-entry
compatibility refresh, and fill-only RAWG enrichment that appears only while no
snapshot exists and never overwrites one.

## Design reference

None. Composition feature on the page built by 11c-b; visual language mirrors
the game-detail `CompatibilitySection` badges (same status/tier labels and
color classes), current dark-first tokens. No mockups exist; feature 14 owns
the global pass.

## In scope

- Read-only compatibility section on `/wishlist/[id]` rendering stored
  evidence: ProtonDB tier badge, AWAY anti-cheat status with anticheat names,
  Bazzite and Windows environment rows from `WishlistEnvironmentCompatibility`,
  provider links (ProtonDB app page, AWAY game page), attribution, and a
  freshness line using the single 180-day window (stale keeps values, shows
  age).
- Eligibility states driven by the existing
  `getWishlistCompatibilityEligibility`: DLC wishes get a short "carried by the
  owned base game" note; base games without confirmed identity (App ID or
  provenance missing) get an identity-required hint pointing at the identity
  control above; eligible entries with no stored evidence show a simple
  "Compatibility details not found." note.
- Quiet inline per-entry refresh: one button in the block, visible only for
  eligible entries, calling the existing `refreshWishlistCompatibility`
  server action, with a completion or failure toast. Failures keep the
  previously stored evidence on screen.
- Fill-only RAWG enrichment: a guarded server action plus a "Load RAWG
  metadata" control on the detail page, shown only when the entry has no own
  wishlist snapshot; it refuses to run when a snapshot exists, so nothing is
  ever overwritten.
- Small shared-parser extraction so two pages do not duplicate AWAY evidence
  parsing.

## Out of scope

- Auto-trigger on confirmed identity, manual sweep, `WishlistCompatSweep` run
  record, overlap protection, completion-toast sweep summary (all 11d).
- Personal overrides: wishlist compatibility has none, by decision.
- Any change to the Edit dialog's existing RAWG search-and-enrich flow,
  including its upsert semantics; fill-only applies to the new detail control.
- Catalog compatibility surfaces (`CompatibilitySection`, overrides, ROM-only
  exemption) beyond importing the shared parser.
- Batch progress and provider error details in the wishlist UI.

## Build steps

- [x] **Step 1 - Shared AWAY and ProtonDB evidence parser** - Extract the
  game-detail page's local AWAY snapshot parser into `src/lib/compat-evidence.ts`
  exporting `parseAntiCheatEvidence(value: unknown)` returning
  `{ status, anticheats } | null`; refactor `src/app/(app)/games/[id]/page.tsx`
  to import it; add `src/lib/compat-evidence.test.ts` covering valid evidence,
  non-objects, unknown status strings, and malformed anticheat arrays.
- [x] **Step 2 - Read-only compatibility block** - Extend the
  `/wishlist/[id]` query with `compatSnapshots` and `envCompat`. Resolve
  eligibility with `getWishlistCompatibilityEligibility`. Create
  `src/components/wishlist/WishlistCompatibilityBlock.tsx` (server-renderable
  presentational component) showing, for eligible entries, the ProtonDB tier
  badge and link, AWAY status badge with anticheat names and link, Bazzite and
  Windows rows from `envCompat` using the game-section label/class tables, the
  freshness line, and a "Compatibility details not found." note when empty.
  DLC wishes see one muted line; unconfirmed-identity base games see an
  identity-required hint.
- [x] **Step 3 - Quiet inline refresh** - Make the block a client component
  wrapping the presentational content with a refresh icon-button shown only
  for eligible entries; clicking calls `refreshWishlistCompatibility({
  wishlistEntryId })`, toasts success ("Compatibility updated") or the action's
  error quietly, then `router.refresh()`.
- [x] **Step 4 - Fill-only RAWG enrichment** - Add
  `fillWishlistRawgMetadata({ wishlistEntryId })` to
  `src/actions/wishlist-rawg.ts`: reject when the entry already has a
  `WishlistMetadataSnapshot` ("already has RAWG metadata"), restrict to
  BASE_GAME like the existing enrich action, auto-match by exact title via
  `matchRawgGame`, persist through the same payload/store-link pipeline, and
  surface AMBIGUOUS/NOT_FOUND as guidance toward the Edit dialog rather than
  a hard error, and provider-unavailable outcomes as a quiet failure that
  writes nothing. Add a "Load RAWG metadata" ghost button on the detail page,
  rendered only when no own snapshot exists; on success show a toast and
  `router.refresh()`. Ships tests per `wishlist-rawg.test.ts` conventions.

## Files

- New: `src/lib/compat-evidence.ts` + test
- New: `src/components/wishlist/WishlistCompatibilityBlock.tsx`
- New: `src/components/wishlist/WishlistCompatRefreshButton.tsx`
- New: `src/components/wishlist/WishlistRawgFillButton.tsx`
- Edited: `src/app/(app)/wishlist/[id]/page.tsx` (query + block + fill control)
- Edited: `src/app/(app)/games/[id]/page.tsx` (import shared parser only)
- Edited: `src/actions/wishlist-rawg.ts` (+ tests) for the fill-only action
- Untouched: schema, compatibility runner/synthesis, Edit dialog, catalog
  components

## Data / contracts

- No schema changes. Evidence comes from the 11c-a tables
  (`WishlistCompatibilitySnapshot` unique `[wishlistEntryId, provider]`,
  `WishlistEnvironmentCompatibility` unique `[wishlistEntryId, environment]`).
- Load-bearing action contract:
  `fillWishlistRawgMetadata(input) -> { success, data: { rawgId } | null, error }`,
  fill-only guaranteed server-side by refusing when a snapshot exists.
- Freshness uses the single 180-day window.

## Verification

- `pnpm test` (Vitest, 565 tests), `pnpm typecheck`, and `pnpm build` pass.
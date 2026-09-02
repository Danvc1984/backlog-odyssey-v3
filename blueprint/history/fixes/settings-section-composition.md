# Fix: Settings section composition

**Type:** Fix

## The problem

Settings uses inconsistent section headings and dividers. Recommendation actions
do not share a clear horizontal action row, the profile and restart controls are
split across overlapping recommendation sections, and the Steam wishlist import
is grouped with library and wishlist operations instead of the Steam connection.

## The fix

Keep all existing actions and server behavior intact while aligning Settings to
the established card treatment.

1. **Compose the sections and relocate the wishlist import.** Move the existing
   `ImportSteamWishlistButton` from library and wishlist operations to the Steam
   connection card. Give each top-level Settings card the same uppercase heading
   and heading separator treatment, without changing action handlers, data
   loading, or provider behavior.
   - Done when the wishlist import is available only from Steam connection and
     the remaining Settings sections use the shared visual hierarchy.

2. **Unify enrichment and compatibility by domain.** Replace the generic
   library and wishlist operations card with one Enrichment and compatibility
   card. It groups RAWG enrichment and compatibility sweep actions under
   catalog games, and keeps wishlist compatibility in a second row because its
   queue and data remain independent.
   - Done when there is one operations section split into catalog and wishlist
     rows, and existing queues, results, and polling remain intact.

3. **Unify recommendation controls.** Combine the profile and restart content
   into one Recommendations card. Lay the preference controls, profile rebuild,
   and restart action out horizontally when space allows, wrapping accessibly on
   narrow screens; retain the existing confirmation state and copy for restart.
   - Done when Settings renders one recommendations section, each action appears
     once, and all actions retain their current behavior.

4. **Match all Settings visuals to Steam connection.** Normalize section
   headings, separators, body text, compact button sizing, and neutral button
   variants across Appearance, enrichment/compatibility, recommendations, DLC,
   and alternative sources. Preserve semantic warning, destructive, and status
   colors where they communicate state.
   - Done when Settings cards share the Steam connection rhythm and actions are
     consistently aligned without changing behavior.

5. **Exclude hidden catalog games from provider work.** Prevent hidden library
   games from being selected, counted, surfaced as pending, or automatically
   queued for RAWG enrichment and compatibility refreshes. Preserve wishlist
   behavior and recommendation-history semantics, since those records have no
   library hidden flag and hidden history remains valid evidence.
   - Done when batch counts, pending follow-ups, automatic queueing, and direct
     compatibility refresh eligibility ignore hidden catalog games, with focused
     tests covering visible and hidden cases.

## Verify

- `git diff --check` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed: 96 test files, 996 tests.
- `pnpm build` passed.
- Manual Settings review remains the suggested follow-up for dark, light, and
  narrow layouts; the user confirmed the fix is ready to close.

## Findings

No findings were resolved by this fix. The existing unverified P3 performance
finding remains in `blueprint/context/findings.md` for later measurement.

# Fix: Wishlist renewal polish

**Type:** Fix
**Status:** verified
**Branch:** `fix/wishlist-renewal-polish`

## The problem

The wishlist cannot quickly clear its filters, its search also changes the health-strip items, and ProtonDB badges on wishlist cards do not provide the expected in-page route to compatibility evidence. Wishlist game details also lag behind library game details: enrichment is not consistently identified as IGDB enrichment and the page omits equivalent detail presentation and navigation.

## The fix

Bring wishlist browsing and detail behavior into parity with the established library patterns without changing catalog and wishlist data boundaries or compatibility eligibility:

- Add a reset-filters action that restores the wishlist's default filter state.
- Keep health-strip items derived from the unsearched wishlist dataset while search filters only the visible result list.
- Make each eligible wishlist-card ProtonDB badge link to that game's compatibility section on its wishlist detail page.
- Label provider-derived metadata as `IGDB enrichment` on wishlist and library details, and apply the same wording to equivalent metadata surfaces.
- Align the wishlist detail page's sections, section links, and detail presentation with the library game-detail page where the wishlist data model supports them.

## Build steps

1. **Wishlist browsing controls and health isolation**
   - Add the reset-filters control using the existing wishlist filter conventions, and ensure search does not alter health-strip counts or items.
   - **Done when:** a user can clear active wishlist filters in one action, and typing a search query changes only the visible wishlist results while the health strip remains based on all wishlist entries.
   - [x] Implemented reset-filters control, pagination reset, and unsearched health-strip counts.

2. **Wishlist compatibility deep link**
   - Make the ProtonDB badge on an eligible wishlist card navigate to the corresponding compatibility section on that entry's detail page.
   - **Done when:** selecting a wishlist card's ProtonDB badge opens the game detail route at its compatibility evidence rather than triggering card navigation or an unrelated destination.
   - [x] Linked both wishlist card layouts to the compatibility section and added the matching detail anchor.

3. **Wishlist and library enrichment-detail parity**
   - Identify IGDB-derived sections as `IGDB enrichment` across library, wishlist, and equivalent detail surfaces, then align the wishlist detail sections and section navigation with supported library-detail behavior.
   - **Done when:** the two detail pages use the IGDB enrichment label consistently and the wishlist detail page exposes the same applicable organized sections, section links, and metadata presentation as the library detail page without showing unsupported personal or catalog-only controls.
   - [x] Aligned IGDB labels, wishlist section anchors, and supported detail-section navigation.

## Verify

- Start `pnpm dev`, then on `/wishlist` apply filters and search: use reset, and confirm the health strip does not change when only the search text changes.
- From an eligible wishlist card, select its ProtonDB badge and confirm the wishlist detail route opens directly at compatibility evidence.
- Compare an IGDB-enriched library game and a comparable wishlist game: confirm the wording, section links, and applicable metadata sections match.
- Run `pnpm test` and `pnpm build`.

<!-- blueprint:completion {"schemaVersion":1,"specBytes":3496,"specSha256":"42f7702461c546b68896e3b435007ec1f19c24a3a7f3e5d7d8873c7b44fe9305","branch":"refs/heads/fix/wishlist-renewal-polish","head":"2c1f97c48d00b75b0be42681ed4e53f7a2c12618","baseRef":"refs/heads/main","baseCommit":"2c1f97c48d00b75b0be42681ed4e53f7a2c12618","sourceTree":"960085a01bb954f0a59f02ac842af4bfb438efca","absentOptional":[]} -->

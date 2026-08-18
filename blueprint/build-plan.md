# Build Plan

## Completed foundation

- [x] 1. **App shell and auth gate** - Next.js shell and single-user Google access
- [x] 2. **Manual catalog and library base** - manual games and library filters
- [x] 3. **Game detail** - metadata, availability, and personal fields
- [x] 4. **Play states and main game** - state rules, flags, and main-game constraint
- [x] 5. **Collections** - manual and calculated collections
- [x] 6. **Steam connection and sync**
  - [x] 6a. Steam account linking
  - [x] 6b. Owned game import
  - [x] 6c. Playtime and recent sync
- [x] 7a. **Duplicate detection and review** - normalized name detection, review UI,
  dismiss action, and duplicate warning

## Catalog integrity

- [ ] 7b. **Merge and delete** - two-phase editable merge, conservative relation
  union, DLC reassignment, cascade-safe delete, temporary CatalogOperation,
  overlap protection, and 15-second reload-safe Undo

## Metadata and ownership context

- [ ] 8. **RAWG metadata enrichment** - on-demand catalog and wishlist metadata,
  RAWG matching suggestions, global and individual load buttons, post-import
  enrichment for missing metadata, independent wishlist snapshots, overwrite
  warnings, RAWG attribution, and graceful partial failure

## DLC and wishlist

- [ ] 9. **DLC model and unresolved Steam queue** - DLC created only from a base-game
  detail page or reviewed Steam flow, required base-game relation, individual
  deletion, explicit base-game cascade behavior, persistent unresolved-DLC queue,
  manual link/create/discard actions, and one-confirmation base-plus-DLC creation

- [ ] 10a. **Local wishlist and acquisition** - independent base-game and DLC
  entries, optional provider and external ID, local notes and interest, manual
  acquisition into the catalog, RAWG metadata transfer, acquired-base removal,
  and explicit handling of associated DLC

- [ ] 10b. **Price enrichment and purchase opportunities** - Steam/ITAD source
  preference, optional MXN target price, Mexican offers, valid-offer selection,
  stale-data handling, provider failure, and wishlist opportunity signals

## Compatibility and recommendations

- [ ] 11. **Compatibility synthesis** - ProtonDB, anti-cheat, Steam Deck evidence,
  per-environment practical status, provenance, freshness, unknown-state handling,
  and personal override

- [ ] 12. **Recommendation engine** - separate catalog play-next and wishlist buy
  recommendations, deterministic explanations, target-price signals, stale-data
  penalties, DLC eligibility, manual RecommendationRun execution, temporary
  dismissal, persistent per-type dismissal counters, and gradual interest
  calibration after repeated rejection

- [ ] 13. **Today dashboard** - main game, in-progress games, latest play-next and
  buy results, five most recently played Steam games, recent playtime data,
  three best current wishlist offers, provider freshness, and links to details
  and external offers

## Personalization and operations

- [ ] 14. **Global visual foundation** - light/dark/system modes, accessible
  contrast, reduced-data behavior, reduced-motion considerations, and fallback
  visuals

- [ ] 15. **Wallhaven global background** - SFW cached candidates, desktop-oriented
  display, reduced-data behavior, fallback, and attribution

- [ ] 16. **Game-detail dynamic themes** - RAWG imagery and derived colors applied
  only to game detail pages, contrast overlays, accessibility safeguards, and
  deterministic fallback

- [ ] 17. **Settings and manual export** - global Steam/ITAD preference, sessions,
  theme, accessibility, Wallhaven controls, reduced-data settings, provider
  refresh controls, and JSON export

- [ ] 18. **Deployment and CI readiness** - Vercel/Supabase environment review,
  production build, smoke test, one reproducible Verify command, and automatic
  checks when configured; final planned step but not an inflexible feature gate


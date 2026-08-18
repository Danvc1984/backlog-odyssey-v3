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

- [x] 7b. **Merge and delete** - two-phase editable merge, conservative relation
  union, DLC reassignment, cascade-safe delete, temporary CatalogOperation,
  overlap protection, and 15-second reload-safe Undo

## Metadata and ownership context

- [ ] 8. **Catalog RAWG enrichment** - on-demand catalog matching and metadata,
  global and individual load actions, post-import enrichment for every imported
  game, overwrite warnings, attribution, async progress, retries, and graceful
  partial failure

## DLC and wishlist

- [ ] 9. **DLC model and unresolved Steam queue** - DLC created only from a base-game
  detail page or reviewed Steam flow, required base-game relation, individual
  deletion, explicit base-game cascade behavior, persistent unresolved-DLC queue,
  manual link/create/discard actions, and one-confirmation base-plus-DLC creation

- [ ] 10a. **Local wishlist, RAWG, and acquisition** - independent base-game and
  DLC entries, optional provider and external ID, local notes and interest,
  wishlist RAWG matching and snapshots, manual acquisition into the catalog,
  metadata transfer, acquired-base removal, and explicit DLC handling

- [ ] 10b. **Price enrichment and purchase opportunities** - manual and daily
  Steam/ITAD Mexican price refreshes through the persistent queue, source
  preference, optional MXN target price, valid-offer selection, stale-data
  handling, provider failure, and opportunity signals without automatic runs

## Compatibility and recommendations

- [ ] 11. **Compatibility synthesis** - asynchronous post-RAWG ProtonDB evidence
  for Bazzite and Steam Deck, Steam Deck Verified fallback, anti-cheat evidence,
  implicit Windows fallback, mixed-evidence handling, personal overrides,
  retry states, and batch progress

- [ ] 12. **Recommendation engine** - explicit combined runs with three catalog
  play-next and three wishlist buy results, deterministic explanations led by
  manual signals, optional target-price signals, visible unknown/stale warnings
  without score penalties, DLC eligibility, dismissal, and calibration

- [ ] 13. **Today dashboard** - main game, in-progress games, the latest three
  play-next and three buy results, recent Steam games/playtime, three best
  offers, provider freshness, background-operation progress, and external links

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
  refresh/retry controls, queue progress, and personal-data-only JSON export

- [ ] 18. **Deployment and CI readiness** - Vercel/Supabase environment review,
  persistent queue and daily price-scheduler configuration, production build,
  smoke test, one reproducible Verify command, and automatic checks when
  configured; final planned step but not an inflexible feature gate

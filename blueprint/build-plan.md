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
- [x] 7c. **Edit game and availability details** - edit a game's name and the
  visible availability fields from its detail page while preserving immutable
  game origin, Steam identity, and synchronized provider statistics

## Metadata and ownership context

- [x] 8. **Catalog RAWG enrichment** - on-demand catalog matching and metadata,
  global and individual load actions, post-import enrichment for every imported
  game, overwrite warnings, attribution, async progress, retries, and graceful
  partial failure
  - [x] 8a. **RAWG matching and metadata snapshot contract** - server-side RAWG
    matching, normalized metadata persistence, attribution, and safe no-match or
    provider-failure behavior
  - [x] 8b. **Single-game asynchronous enrichment** - detail-page load action,
    overwrite warning, persistent job state, retries, and per-game progress
  - [x] 8c. **Catalog-wide enrichment with progress and partial failure** -
    library action to enqueue eligible games and report batch outcomes
  - [x] 8d. **Post-import enrichment** - enqueue every newly imported Steam game
    without rolling back or duplicating the import

## DLC and wishlist

- [x] 9. **DLC model and unresolved Steam queue** - DLC created only from a base-game
  detail page or reviewed Steam flow, required base-game relation, individual
  deletion, explicit base-game cascade behavior, persistent unresolved-DLC queue,
  manual link/create/discard actions, and one-confirmation base-plus-DLC creation

- [x] 10a. **Local wishlist, RAWG, and acquisition** - independent base-game entries,
  wishlist DLC linked to owned catalog games, optional provider and external ID, local
  notes and interest, wishlist RAWG matching and snapshots, manual acquisition into the
  catalog with metadata transfer, acquired wishlist removal, and optional base-game
  play state transition on DLC acquisition

- [ ] 10b. **Price enrichment and purchase opportunities** - one global manual
  Steam/ITAD Mexican-price refresh through a persistent, idempotent queue; cheapest
  valid-offer selection with visible alternatives and MX activation warnings; optional
  MXN targets; 48-hour freshness; bounded retries; clear partial failures; and
  opportunity signals without automatic recommendation runs. Vercel Cron activation is
  deferred to feature 18.

- [ ] 10c. **Steam wishlist import and enrichment** - explicit Wishlist import;
  idempotent Steam-App-ID creation of new base-game wishes with neutral interest and
  RAWG follow-up; conservative local-match review; persistent ignored and unresolved-DLC
  queues; silent owned-game omission; and non-authoritative Steam sync status.

## Compatibility and recommendations

- [ ] 11. **Compatibility synthesis** - asynchronous post-RAWG ProtonDB evidence
  for Bazzite and Steam Deck, Steam Deck Verified fallback, anti-cheat evidence,
  implicit Windows fallback, mixed-evidence handling, personal overrides,
  retry states, and batch progress

- [ ] 12. **Recommendation engine** - explicit combined runs with three catalog
  play-next and three wishlist buy results, deterministic explanations led by
  manual signals, base-game affinity boost for wishlist DLC, optional target-price
  signals, visible unknown/stale warnings without score penalties, dismissal, and
  calibration

- [ ] 13. **Today dashboard** - main game, in-progress games, the latest three
  play-next and three buy results, recent Steam games/playtime, three best
  offers, provider freshness, background-operation progress, and external links

## Personalization and operations

- [ ] 14. **Global visual foundation and full-app UI review** - light/dark/system
  modes, accessible contrast, design token consistency, responsive desktop/mobile
  navigation, comprehensive UI tidy-up across all completed pages and components,
  reduced-data behavior, reduced-motion safeguards, and fallback visuals

- [ ] 15. **Wallhaven global background** - SFW cached candidates, desktop-oriented
  display, reduced-data behavior, fallback, and attribution

- [ ] 16. **Game-detail dynamic themes** - RAWG imagery and derived colors applied
  only to game detail pages, contrast overlays, accessibility safeguards, and
  deterministic fallback

- [ ] 17. **Settings and manual export** - global Steam/ITAD preference, sessions,
  theme, accessibility, Wallhaven controls, reduced-data settings, provider
  refresh/retry controls, queue progress, and personal-data-only JSON export

- [ ] 18. **Deployment and CI readiness** - Vercel/Supabase environment review,
  persistent queue and Vercel Cron daily price-refresh configuration, `CRON_SECRET`,
  queue-overlap protection, production build,
  smoke test, one reproducible Verify command, and automatic checks when
  configured; final planned step but not an inflexible feature gate

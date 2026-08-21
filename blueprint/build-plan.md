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

- [ ] 10b. **Price enrichment and purchase opportunities** - provenance-tracked
  identity (Steam import auto-confirm, manual URL/AppID paste, RAWG-derived
  suggest-and-confirm extending only the wishlist snapshot), ITAD via cached
  AppID lookup and batched `country=MX` calls behind one global manual refresh
  on a persistent idempotent queue; cheapest valid-offer selection persisting
  the cheapest 8-10 offers with visible alternatives and MX activation
  warnings; display-only historical lows; inline MXN targets; 48-hour
  freshness; bounded retries; clear partial failures; opportunity badges
  without automatic recommendation runs. Vercel Cron activation deferred to 18.

- [ ] 10c. **Steam wishlist import and enrichment** - explicit Wishlist import;
  idempotent Steam-App-ID creation of new base-game wishes with neutral
  interest and RAWG follow-up; conservative local-match review using the 7a
  matcher where linking is never automatic and stores identity with
  provenance; one unresolved-DLC queue shared with library sync and
  discriminated by source; persistent ignored queue; silent owned-game
  omission; header sync chip and persistent result summary; non-authoritative
  Steam sync status.

## Compatibility and recommendations

- [ ] 11. **Compatibility synthesis** - asynchronous post-RAWG ProtonDB
  evidence for Bazzite and Steam Deck with Deck Verified fallback; AWAY
  dataset for anti-cheat; manual Steam AppID entry into ExternalGameId with
  ROM-only games exempt as not applicable; implicit Windows fallback;
  mixed-evidence handling with attribution; personal overrides; single
  180-day freshness window; post-RAWG auto-queue and per-game manual refresh;
  retry states; batch progress

- [ ] 12. **Recommendation engine** - explicit combined runs with three
  play-next and three buy results; deterministic explanations led by manual
  signals; eligibility rules (no hidden/main/in-progress/DLC in play-next);
  compatibility as warning-only context that never moves rank in any state;
  fresh-discount offer quality with historical-low tiebreaks and stale
  contributing nothing; boost-only DLC affinity; optional target-price
  signals; dismissal; calibration with exempt counters; rolling 12-month run
  retention

- [ ] 13. **Today dashboard** - post-login landing composing main game,
  in-progress games, latest three play-next and buy results, recent Steam
  activity/playtime, three best offers sorted by discount, provider
  freshness, background-operation progress, and external links

## Personalization and operations

- [ ] 14. **Global visual foundation and full-app UI review** -
  prototype-validated dark-first theme derived from blueprint/reference/
  using dual-accent semantic tokens (cyan interactive, magenta opportunity,
  amber warning), accessible contrast, token consistency, responsive
  desktop/mobile navigation, full-app tidy-up, reduced-data and reduced-motion
  safeguards, fallback visuals

- [ ] 15. **Wallhaven global background** - SFW keyword-pool caching (~10
  candidates), deterministic daily rotation with shuffle, desktop-oriented
  display, reduced-data hard-off, staleness-triggered queued refresh,
  fallback, and attribution

- [ ] 16. **Game-detail dynamic themes** - server-side dominant-color
  derivation during RAWG enrichment stored in the replaceable snapshot,
  applied read-only to detail pages with contrast overlays, accessibility
  safeguards, and deterministic fallback

- [ ] 17. **Settings and manual export** - sessions, theme and accessibility
  preferences, Wallhaven controls, reduced-data settings, manual provider
  refresh/retry controls including the global compatibility sweep, queue
  progress, wishlist-import diagnostics, and personal-data-only JSON export

- [ ] 18. **Deployment and CI readiness** - Vercel/Supabase environment
  review, Vercel Cron daily price-refresh at 06:00 UTC-6 with `CRON_SECRET`,
  queue overlap protection, production build,
  smoke test, one reproducible Verify command, and automatic checks when
  configured; final planned step but not an inflexible feature gate

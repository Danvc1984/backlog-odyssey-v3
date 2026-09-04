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
  - [x] 8e. **RAWG payload maturity and series evidence** - capture ESRB
    rating from the existing details call into a version 2 metadata payload
    with backward-compatible parsing and unchanged attribution; capture the
    RAWG game-series list as series evidence for later sequel derivation;
    backfill via the existing catalog-wide enrichment action; ESRB rating and
    series names shown in the shared RAWG metadata section on game and
    wishlist detail

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

- [x] 10b. **Price enrichment and purchase opportunities** - provenance-tracked
  identity (Steam import auto-confirm, manual URL/AppID paste, RAWG-derived
  suggest-and-confirm extending only the wishlist snapshot), ITAD via cached
  AppID lookup and batched `country=MX` calls behind one global manual refresh
  on a persistent idempotent queue; cheapest valid-offer selection persisting
  the cheapest 8-10 offers with visible alternatives and MX activation
  warnings; display-only historical lows; inline MXN targets; 48-hour
  freshness; bounded retries; clear partial failures; opportunity badges
   without automatic recommendation runs. Vercel Cron activation deferred to 19.
  - [x] 10b-a. **Price identity and provenance** - three provenance-tracked
    identity paths (Steam import auto-confirm, manual Steam URL/AppID paste,
    RAWG store-link suggest-and-confirm extending only the wishlist snapshot),
    identity display and edit on wishlist entries, and identity-required state
    for entries without confirmed store identity. RAWG store URLs proved empty
    in live data, so the App ID resolves via Steam's keyless `storesearch`
    exact-name match behind the steam-slug trigger.
  - [x] 10b-b. **ITAD prices and refresh queue** - cached Steam-App-ID to
    ITAD-ID lookup, batched `country=MX` price calls (no deals filter, so
    full-price games are included per user decision), global manual
    `Update prices` action on a persistent idempotent queue with overlap
    protection, bounded retries honoring `Retry-After`, 48-hour freshness
    anchors, partial-failure reporting with six outcome buckets, and per-entry
    PriceRefresh diagnostics
  - [x] 10b-c. **Offer display and opportunity badges** - cheapest valid-offer
    selection persisting the cheapest 8-10 offers with expandable visible
    alternatives, MX keyshop activation warnings, display-only historical
    lows, inline MXN targets, stale-offer rules, and opportunity badges
    without starting recommendation runs

- [x] 10c. **Steam wishlist import and enrichment** - explicit Wishlist import;
  idempotent Steam-App-ID creation of new base-game wishes with neutral
  interest and RAWG follow-up; conservative local-match review using the 7a
  matcher where linking is never automatic and stores identity with
  provenance; one unresolved-DLC queue shared with library sync and
  discriminated by source; persistent ignored queue; silent owned-game
  omission; header sync chip and persistent result summary; non-authoritative
  Steam sync status.

## Compatibility and recommendations

- [x] 11. **Compatibility synthesis** - asynchronous post-RAWG ProtonDB
  evidence for Bazzite; AWAY dataset for anti-cheat; manual Steam AppID entry
  into ExternalGameId with ROM-only games exempt as not applicable; Windows
  fallback; mixed-evidence handling with attribution; Bazzite-only personal
  overrides; single
  180-day freshness window; post-RAWG auto-queue and per-game manual refresh;
  retry states; batch progress
  - [x] 11a. **Compatibility evidence and display** - ProtonDB and AWAY API
    clients; Bazzite evidence plus Windows fallback; manual Steam AppID entry
    on game detail; ROM-only exemption; Bazzite-only personal overrides;
    compatibility section with provider evidence, tiers, and per-game refresh;
    180-day freshness; retry states
  - [x] 11b. **Compatibility batch queue and auto-queue** - post-RAWG
    auto-queue for compatibility jobs; global compatibility sweep from
    settings; batch progress; overlap protection
  - [x] 11c. **Wishlist detail** - dedicated `/wishlist/[id]` page reached from
    the wishlist card title, composing all available wish data: full RAWG
    metadata, Steam identity with provenance, offers and target price, notes,
    interest, and the edit/acquire/delete actions; a read-only compatibility
    block (ProtonDB tier, AWAY anti-cheat, derived Windows fallback) for
    base-game wishes with a confirmed Steam App ID and no personal override;
    per-entry compatibility refresh and fill-only RAWG enrichment that never
    overwrites an existing snapshot
    - [x] 11c-a. **Wishlist compatibility foundation** - parallel
      `WishlistCompatibilitySnapshot` and `WishlistEnvironmentCompatibility`
      storage, provider/synthesis reuse, and a quiet per-entry refresh for
      eligible base-game wishes; no catalog-state reuse, override, auto-queue,
      or sweep
    - [x] 11c-b. **Wishlist detail page** - `/wishlist/[id]` navigation and
      composition of existing wish data, RAWG metadata, identity, offers,
      notes, interest, and existing edit/acquire/delete controls
    - [x] 11c-c. **Wishlist detail compatibility and enrichment controls** -
      read-only compatibility block, eligibility states, detail refresh, and
      fill-only RAWG enrichment without overwriting a snapshot
  - [x] 11d. **Wishlist compatibility sweep** - parallel wishlist evidence
    storage keyed by `wishlistEntryId` (`WishlistCompatibilitySnapshot`,
    `WishlistEnvironmentCompatibility`), separate from the catalog pipeline;
    auto-trigger on any confirmed Steam identity and a quiet async manual
    sweep for existing confirmed-identity wishes backed by a
    PriceRefresh-style run record with overlap protection and a completion
    toast; base-game wishes only, DLC wishes skipped; inline fail-silent
    refreshes and a simple "compatibility details not found" note on the
    detail page; single 180-day freshness window

- [x] 12. **Recommendation engine** - explicit explainable play and buy runs;
  deterministic baseline eligibility and scoring, then privacy-preserving
  adaptive diversification from personal history, editable preferences, and
  provider metadata; fresh offers, calibration, dismissal, candidate batches,
  cold-start personalization, and rolling retention
  - [x] 12a. **Recommendation runs and play-next engine** - dual-reference
    item storage (catalog game or wishlist entry) and dismissal-log contract,
    deterministic play-next eligibility, scoring, and explanations,
    `Update recommendations` action creating both runs with rolling 12-month
    pruning, Today display with in-run dismissal, and header actions on
    Library and Wishlist
  - [x] 12b. **Buy recommendations** - explainable wishlist purchase picks
    from fresh offers and personal intent
    - [x] 12b-a. **Buy recommendation engine** - wishlist eligibility
      (base games and owned-base DLC wishes, ROM exclusion), fresh-discount
      offer quality with historical-low tiebreaks, target-price signal,
      boost-only DLC affinity, no-pricing and stale/keyshop caveats, and
      persisted BUY runs
    - [x] 12b-b. **Buy recommendation surfaces** - Buy display on Today and
      wishlist detail, explanation/caveat presentation, and in-run dismissal
  - [x] 12c. **Adaptive recommendation orchestration** - optional post-import
    taste setup from five or six swappable owned games; `PLAYED_BEFORE` and
    Interest seed actions; one personal Game experience / intention field and
    contextual field help across detail, quick-create, and bulk edit; opt-in
    Tune-this-run soft preferences and reusable presets; explainable private
    event history, derived profile, Prefer/Neutral/Avoid overrides, retention,
    and full recommender reset; metadata-, Steam-activity-, environment-,
    compatibility-, quality-, publisher-, release-era-, duration-, genre/tag-,
    and series-informed re-ranking with uncertainty safeguards; four play roles
    (two best fit, out-of-the-box, change-of-pace), three buy roles, retained
    candidate batches, Show another exposure cooldowns, and fresh-deal
    saturation mode (20% plus three 80%+ eligible offers) without letting
    discounts alone decide
    - [x] 12c-a. **Game experience field and field help** - `GameExperience`
      enum (`PC_GAMING`/`MULTIPLAYER_COOP`/`COUCH_GAMING`/`ON_THE_GO`) as a
      nullable personal field on `LibraryEntry` and `WishlistEntry`, editable
      on game detail and wishlist edit, read-only on wishlist detail, and
      concise visible field help on the personal-field surfaces
    - [x] 12c-b. **Recommendation events, retention, and reset** - append-only
      `RecommendationEvent` log (exposure, rotation, taste-setup answers,
      starts, completions, abandonment, dismissals, optional reasons),
      time-bounded retention by event kind (90 days / 12 months / 24 months),
      and `Restart recommendations` removing all recommendation-owned records
      while preserving catalog and provider data
    - [x] 12c-c. **Derived profile and preference overrides** - rebuildable
      `RecommendationProfile` aggregate with recency decay, `PREFER`/
      `NEUTRAL`/`AVOID` `RecommendationPreference` overrides, and a Settings
      section showing the learned profile, its evidence, and the controls
    - [x] 12c-d. **Adaptive re-ranking engine** - re-ranking over the
      deterministic baseline from profile, preference overrides, metadata,
      Steam activity, environment, compatibility, quality, publisher, era,
      duration, genre/tag, and series with uncertainty safeguards, plus
      cold-start diversification labeled by its limited basis
    - [x] 12c-e. **Roles, batches, rotation, and deal saturation** - four play
      roles (two best fit, out-of-the-box, change-of-pace) and three buy roles
      (two best fit plus one deal; one best fit plus two deals under fresh-deal
      saturation), qualified candidate batches retained in run context,
      `Show another` rotation with exposure cooldowns, and the explicit
      Start-playing action with main-game handling
      - [x] 12c-e-a. **Roles, batches, and deal saturation** - a
        `RecommendationRole` on run items (migration), play role assignment
        (two best fit, qualified out-of-the-box, change of pace) with fallback
        caveats, buy fit/quality floors and the fresh-deal saturation switch,
        per-role candidate batches retained in run context, role labels on
        Today and wishlist detail, and role in the exposure payload
      - [x] 12c-e-b. **Show another, cooldowns, and Start-playing** - rotation
        within a role consuming the retained batches with ROTATION events and
        item replacement, exposure cooldowns excluding recently shown
        candidates, and the explicit Start-playing action with main-game
        handling
    - [x] 12c-f. **Tune-this-run, presets, and taste setup** - opt-in
      Tune-this-run soft preferences (experience, length, genres/tags, sequel
      posture, era, casual/mature) with named `RecommendationPreset` reuse,
      and optional post-import taste setup from five or six swappable owned
      games with `PLAYED_BEFORE` and Interest seed actions
      - [x] 12c-f-a. **Tune-this-run and presets** - a persisted per-engine
        tune context (experience, length, genres/tags, sequel posture, era,
        casual/mature) weighting the candidate pool before the baseline with
        thin-pool explanations, named `RecommendationPreset` save/load/delete,
        tune panels on Today, and reset coverage
      - [x] 12c-f-b. **Taste setup** - optional post-import flow picking five
        or six swappable owned games with `PLAYED_BEFORE` and Interest seed
        actions, one personal Game experience field and preferred environment
        on seed-picked games, and `TASTE_SETUP_ANSWER` events feeding the
        profile
  - [x] 12d. **Calibration from dismissal counters and true refresh on
    update recommendations** - adjusted interest from per-target
    dismissal counters applied in both engines (floor 0, counters derived
    from durable feedback rows and never pruned), calibration explanations
    on game and wishlist detail, and new runs rotating in fresh games by
    excluding recently exposed candidates with a thin-pool fallback
  - [x] 12e. **Source-aware availability and recommendation semantics** -
    reusable alternative store sources for owned games, icon-aware availability
    presentation and filtering, soft play-next source tuning, and the clarified
    separation between hidden candidate eligibility and retained play history
    - [x] 12e-a. **Reusable alternative-source model and migration** -
      normalized user-owned alternative-source records; code-owned known-source
      suggestions, aliases, and icon metadata; multi-source availability
      integrity; conservative migration of existing `OTHER_PLATFORM` rows to
      `Unspecified other source`; rename/archive without destructive deletion
    - [x] 12e-b. **Source selection, details, and Library browsing** -
      checkbox-based Steam/ROM/alternative-source selection with type-ahead
      create-or-reuse; icon-decorated game-detail source values; individually
      filterable saved alternative sources in Library; accessible fallback-icon
      treatment for custom sources
    - [x] 12e-c. **Source-tuned play-next and retained hidden history** -
      extend the existing Tune-this-run context and presets with inclusive,
      modest source boosts and visible source explanations; leave buy/pricing
      behavior unchanged; retain completion and abandonment events from hidden
      games as profile evidence while excluding them as candidates; allow
      unhidden abandoned replay candidates as explained, low-priority
      Out-of-the-Box second chances

- [x] 13. **Today dashboard** - post-login functional dashboard without a
  feature-13 visual redesign. It composes main/in-progress games, latest three
  explicit play-next and buy results, three best discount-sorted wishlist
  offers, provider freshness, operation status, active-backlog progress, and
  actionable catalog coverage.
  - [x] 13a. **Dashboard data health and recent Steam activity** - active
    backlog progress excluding abandoned games; separate RAWG-metadata and
    recommendation-profile completeness counts; a persisted 24-hour recent
    Steam activity cache populated by a narrow query when Today loads;
    imported and unimported recent titles, explicit manual-sync suggestion for
    the latter, fresh-empty and stale-on-error states; no full sync or
    automatic catalog mutation.
  - [x] 13b. **Today composition and coverage dialogs** - functional Today
    composition of existing main/in-progress, recommendation, offer, provider,
    and operation data; accessible click-open coverage dialogs with ten linked
    game titles, expandable pagination, and clear local/provider freshness
    states. Visual hierarchy and redesign remain feature 14.

## Personalization and operations

- [x] 14. **Global visual foundation and full-app UI review** - Apply the
  approved prototype direction across the existing app without changing product
  rules, provider boundaries, schemas, jobs, recommendation ranking, or price
  behavior. The outcome is full dark/light/system parity, token consistency,
  responsive navigation, accessible states, and a visual review of every
  existing route.
  - [x] 14a. **Theme tokens, modes, preferences, and app shell** - Port the
    prototype-validated semantic token system into the application; deliver
    dark, light, and system modes with the same hierarchy rather than a simple
    inversion; update typography, surfaces, buttons, cards, desktop sidebar,
    and mobile bottom navigation; add non-migrating visual-preference controls
    only for theme, reduced motion, and reduced data, leaving the broader
    Settings and export scope to 18.
  - [x] 14b. **Today decision dashboard** - Redesign Today around its existing
    data and business logic: a split first viewport with `Currently playing`
    and `Featured offers` carousels, a larger Play Next section with a dominant
    primary Best Fit and a compact rail for the remaining stored roles,
    including the second Best Fit, Change of Pace, and Out of the Box, then the
    existing Buy, activity, coverage, freshness, and operation surfaces.
    Carousels have manual controls, a slow pause-on-hover/focus auto-advance,
    and no auto-advance under reduced motion. Empty states retain contextual
    guidance and actions without triggering hidden provider work.
  - [x] 14c. **Library browsing surfaces** - toolbar, filter chips, and
    health strip over unchanged queries; approved grid/list alternatives
    with deterministic cover gradients; restyled duplicates review,
    enrichment panel, and empty states
  - [x] 14d. **Wishlist browsing surfaces** - signal grid, focus/list
    alternatives, and entry-card composition for offers, identity,
    staleness, target, and interest over unchanged queries and actions
  - [x] 14e. **Header action rework for Library and Wishlist**  - style and update the header actions for each of the targeted pages so that these actions and their statuses and followup sections all follow a similar design philosophy to what we have before them; additionally add protondb compatibility tags to the game cards in both views.
  - [x] 14f. **Cross-app states, accessibility, and visual acceptance** -
    Finish visual Settings controls, loading/empty/error/stale/operation
    states, keyboard/focus/target/contrast treatment, reduced-motion and
    reduced-data behavior, mobile review, and token-consistency cleanup.
    Prove the main flows on every route in desktop and mobile across dark,
    light, and system modes, then run the existing automated checks. Wallhaven,
    new providers, migrations, queues, and background work remain out of scope.

- [x] 15. **Detail, collection, and supporting route composition** - Apply
  the shared design system to the remaining surfaces, leading with Today so it
  matches the Library/Wishlist visual state, then Game Detail, Wishlist Detail,
  Collections, settings and their dialogs/forms. Review order and operability
  of actions available in the settings; Reuse existing RAWG artwork with
  contrast overlays when available, use abstract local fallbacks otherwise or
  in reduced-data mode, and preserve current detail actions, read-only
  evidence boundaries, and destructive confirmations. Dynamic per-game palettes
  remain feature 17.

- [x] 16. **Wallhaven global background** - SFW keyword-pool caching (~10
  candidates), deterministic daily rotation with shuffle, desktop-oriented
  display, reduced-data hard-off, staleness-triggered queued refresh,
  fallback, and attribution

- [x] 17. **Game-detail dynamic themes and RAWG screenshots** - server-side
  palette derivation and screenshot capture during RAWG enrichment stored
  in a version 3 replaceable snapshot, hero-band themes with decorative
  accent tints applied read-only on game detail and wishlist detail, a
  dedicated screenshots carousel section, contrast overlays, accessibility
  safeguards, and deterministic fallbacks
  - [x] 17a. **Version 3 snapshot: palettes and screenshots** - derived
    primary/dark/muted palette extraction from stored artwork plus a
    single `page_size=6` screenshots call with hidden entries filtered,
    persisted in the replaceable RAWG snapshot with tolerant v1/v2
    parsing and backfill through the existing re-enrichment route
  - [x] 17b. **Game-detail theme application** - hero band plus decorative
    accent tints (headers, borders, chips, dividers) on the game detail
    page, semantic tokens untouched, contrast overlays, deterministic
    fallback without artwork or under reduced data, re-derivation on
    re-enrichment
  - [x] 17c. **Screenshots section** - dedicated bottom carousel-style
    section on game detail showing up to six screenshots with manual
    navigation, reduced-motion manual mode, reduced-data token fallback,
    and existing RAWG attribution
  - [x] 17d. **Wishlist detail surfaces** - the same themed hero and
    decorative accents plus the screenshots section for base-game wishes
    with a snapshot, respecting fill-only enrichment and the absence of
    personal overrides

- [ ] 18. **Settings, manual export, and restore** - sessions, the
  visual/accessibility preference area introduced by 14, Wallhaven controls,
  manual provider refresh/retry controls including the global compatibility
  sweep, queue progress, wishlist-import diagnostics, personal-data-only
  JSON export, and empty-schema-only import of that export
  - [ ] 18a. **Settings surfaces** - Google session area, fixed environment
    display, wishlist-import status and review access, Wallhaven controls,
    manual provider refresh/retry including the global compatibility
    sweep, and queue progress with retry
  - [ ] 18b. **Personal-data JSON export** - versioned export of catalog
    and wishlist records, availability, external IDs, play states,
    personal fields, tags, collections, settings, manual overrides, and
    recommendation-owned decisions, excluding rebuildable provider
    snapshots
  - [ ] 18c. **Empty-schema import and restore** - Zod-validated import
    that refuses while the catalog or wishlist holds data, restores
    personal data including recommendation events, profile, preferences,
    presets, and dismissal counters in one all-or-nothing transaction, and
    leaves provider snapshots to rebuild through manual enrichment actions
    only

- [ ] 19. **Odyssey theme expansion** - two palette families (Dawn and
  Sunset, light and dark each) with family-owned semantic hue mapping, a
  Cinzel/Inter typography pairing, official brand icons, and a whole-app
  Odyssey voice sweep on expressive surfaces, locked through a prototype
  first
  - [ ] 19a. **Prototype lock** - throwaway mockups validating the four
    palettes and the Cinzel + Inter pairing against real Today, Library,
    Wishlist, and detail surfaces before any application change; final
    palette mapping and font call happen here
  - [ ] 19b. **Family tokens and selector** - Dawn (cyan/purple) and
    Sunset (orange/yellow) families in light and dark over the existing
    token architecture, each family owning its interactive/deal/warning/
    danger hue mapping with contrast validation, plus a Settings family
    selector beside the light/dark/system control
  - [ ] 19c. **Typography** - Cinzel display for headers and hero moments,
    Inter body, unchanged technical monospace for evidence and freshness
    labels
  - [ ] 19d. **Brand icons** - official source icons in the code-owned
    known-source catalog with the neutral fallback untouched for custom
    sources
  - [ ] 19e. **Odyssey voice sweep** - adventurous copy mixing subtle
    allusion and named mythology across headers, empty states, buttons,
    dashboard moments, and dialogs; statuses, errors, evidence labels,
    field help, and caveats stay factual; navigation names unchanged
  - [ ] 19f. **UI icon set swap (gated)** - replace general UI icons with
    the owner-selected premium/custom set once provided; current icons
    remain the fallback until then
  - [ ] 19g. **Cross-app acceptance** - all four palettes across desktop
    and mobile in light, dark, and system modes with keyboard, focus,
    contrast, reduced-motion, and reduced-data review of every primary
    route

- [ ] 20. **Deployment and CI readiness** - Vercel/Supabase environment
  review, Vercel Cron daily run at 06:00 UTC-6 with `CRON_SECRET` enqueueing
  the price refresh plus a compatibility freshness sweep for catalog and
  wishlist evidence older than the 180-day window, queue overlap protection,
  production build,
  smoke test, one reproducible Verify command, and automatic checks when
  configured; final planned step but not an inflexible feature gate

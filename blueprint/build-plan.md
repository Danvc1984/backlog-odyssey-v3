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
   without automatic recommendation runs. Vercel Cron activation deferred to 24.
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

- [x] 18. **Settings, manual export, and restore** - sessions, the
  visual/accessibility preference area introduced by 14, Wallhaven controls,
  manual provider refresh/retry controls including the global compatibility
  sweep, queue progress, wishlist-import diagnostics, personal-data-only
  JSON export, and empty-schema-only import of that export
  - [x] 18a. **Settings surfaces** - Google session area, fixed environment
    display, wishlist-import status and review access, Wallhaven controls,
    manual provider refresh/retry including the global compatibility
    sweep, and queue progress with retry
  - [x] 18b. **Personal-data JSON export** - versioned export of catalog
    and wishlist records, availability, external IDs, play states,
    personal fields, tags, collections, settings, manual overrides, and
    recommendation-owned decisions, excluding rebuildable provider
    snapshots
  - [x] 18c. **Empty-schema import and restore** - Zod-validated import
    that refuses while the catalog or wishlist holds data, restores
    personal data including recommendation events, profile, preferences,
    presets, and dismissal counters in one all-or-nothing transaction, and
    leaves provider snapshots to rebuild through manual enrichment actions
    only

- [x] 19. **OS setup, onboarding, and environment-aware behavior** - first-login onboarding
  capturing the primary OS (Linux or Windows) and an optional handheld
  (Linux or Windows); Windows as the only fallback OS, offered only when the
  primary is Linux and the owner has a Windows machine, and never when the
  primary is Windows; compatibility flows active only when a configured
  device runs Linux; OS-aware play and buy recommendations and wishlist
  discovery that factor whether a fallback exists
  - [x] 19a. **OS preferences and first-login onboarding** - structured OS
    preference fields on AppSettings replacing the fixed display strings
    (with BAZZITE→LINUX enum migration and an explicit optional Windows
    fallback), an onboarding-completion gate that routes first login through
    an introduction screen (trivial default path on all-Windows setups, no
    compatibility explanation step) ending with an optional start-now /
    not-now taste-setup offer, Settings editing afterward through a
    confirmation dialog that precedes immediate re-derivation (compatibility
    synthesis recompute plus a synchronous recommendation re-run replacing
    the current run under normal run semantics), and export/import
    schema updates
  - [x] 19b. **Linux-gated compatibility flows** - one compatibility gate:
    ProtonDB/AWAY evidence, post-RAWG auto-queue, global sweeps, per-game
    refresh, ProtonDB card tags, and catalog/wishlist compatibility sections
    active only when the primary OS or the handheld is Linux; all-Windows
    setups see no compatibility flow anywhere, rendering no compatibility UI
    at all; fallback language states Windows is the only fallback and none
    exists when Windows is primary; per-setup and per-game display gating so
    compatibility appears only when it makes sense (cards use four distinct
    tag states - evidence, unknown/not-checked, stale, absent - with no
    hollow placeholders and no tag without a confirmed App ID); the
    deployment feature's cron sweep becomes a no-op here
  **OS-aware recommendations and wishlist discovery** - play-next and buy
  engines derive environment fit, play floors (e.g. the out-of-the-box READY
  floor), caveats, and explanations from the configured devices;
  compatibility contributes only when Linux targets exist; on a Linux setup
  without a Windows fallback, fallback-needing evidence hard-excludes a game
  from all play roles with a visible, explained reason (the sanctioned
  carve-out from the soft-signal rule; an emptied role is absent from the
  run) while buy picks and wishlist discovery apply a heavy practical-fit
  penalty plus caveat, never exclusion; setup changes re-derive compatibility
  and synchronously regenerate runs; preferred-environment options and the
  derived profile adapt to the configured setup.
  - [x] 19c. **Play environment fit and the no-fallback exclusion** -
    setup-aware compatibility context in the play engine (compatibility
    contributes only when Linux targets exist), device-derived environment
    fit and play floors, override-aware evidence, and the sanctioned
    no-fallback hard exclusion of fallback-needing evidence from play
    roles with recorded, visible reasons and role absence

  - [x] 19d. **Buy practical fit and setup-adapted environment fields** -
    wishlist compatibility evidence in the buy engine with a heavy
    practical-fit penalty plus caveat (never exclusion), preferred-
    environment options and taste setup restricted to configured devices,
    and derived-profile environment evidence adapting to the setup

- [x] 20. **Odyssey theme expansion** - two palette families (Dawn and
  Sunset, light and dark each) with family-owned semantic hue mapping, a
  Cinzel/Inter typography pairing, official brand icons, and a whole-app
  Odyssey voice sweep on expressive surfaces, locked through a prototype
  first
  - [x] 20a. **Prototype lock** - throwaway mockups validating the four
    palettes and the Cinzel + Inter pairing against real Today, Library,
    Wishlist, and detail surfaces before any application change; final
    palette mapping and font call happen here
  - [x] 20b. **Family tokens and selector** - Dawn (cyan/purple) and
    Sunset (orange/yellow) families in light and dark over the existing
    token architecture, each family owning its interactive/deal/warning/
    danger hue mapping with contrast validation, plus a Settings family
    selector beside the light/dark/system control
  - [x] 20c. **Typography** - Cinzel display for headers and hero moments,
    Inter body, unchanged technical monospace for evidence and freshness
    labels
  - [x] 20d. **Brand icons** - official source icons in the code-owned
    known-source catalog with the neutral fallback untouched for custom
    sources
  - [x] 20e. **Odyssey voice sweep** - adventurous copy mixing subtle
    allusion and named mythology across headers, empty states, buttons,
    dashboard moments, and dialogs; statuses, errors, evidence labels,
    field help, and caveats stay factual; navigation names unchanged
  - [x] 20f. **UI icon set swap (gated)** - replace general UI icons with
    the owner-selected premium/custom set once provided; current icons
    remain the fallback until then
  - [x] 20g. **Cross-app acceptance** - all four palettes across desktop
    and mobile in light, dark, and system modes with keyboard, focus,
    contrast, reduced-motion, and reduced-data review of every primary
    route

- [x] 21. **Pre-deployment polish and improvements** - owner-reported fixes
  organized one sub-feature per app section
  - [x] 21a. **Global visual fixes** - favicon respects the active theme
    color instead of being overwritten with cyan; remove the glow effect
    app-wide across all four palettes, keeping it only for the Today buy
    heading when the top offer exceeds 60% and for offers above 80% in the
    wishlist catalog and wishlist detail; sidebar minimize/maximize on click
  - [x] 21b. **Today** - rebuild the Today focus heading as a focus carousel
    that switches between the main game and the other in-progress games
    (main game offers only a view-details button; in-progress games add a
    make-main button); restore the wallpaper change control at the bottom of
    the screen with the manual refresh behavior from Settings, offering
    wallpaper refresh when no wallpapers are loaded and at least one game is
    in progress; working recent Steam activity with a manual refresh option
    and game-image backgrounds on the elongated cards; drop the
    abandoned-games counter in data health and replace the "Counts are
    actionable, not decoration." caption; fix or remove the always-"never"
    Steam provider freshness entry and show compatibility freshness only
    when the OS profile includes a Linux device; remove the "Best fit /
    #02" role numbering; rewrite play and buy reasoning as congruent
    natural-language chips instead of technical fragments, with individual
    reasons aggregated and ordered from strong positives to strong
    negatives; remove generated card descriptions; make the Tune
    recommendations (opt in) section header visible
    with an expand icon; and validate the no-fallback hidden-games message
    so it does not appear when Windows is primary with a Linux handheld
  - [x] 21c. **Library** - page-size control of 18/48/99 (default 18) in
    both grid and list views (shared mechanism, reused by 21d); edit and
    change-state actions working like game detail including the scroll
    effect; description-based warning for games without metadata replacing
    the meta ready/meta missing labels; a more noticeable background for the
    main-game selector; ProtonDB card tags omitted on all-Windows setups
  - [x] 21d. **Wishlist** - page-size control of 18/48/99 (default 18, the
    same sizes as the Library) in both views, with the size selector living
    inside the shared pagination bar (the 21c miss: the Library toolbar
    control moves there too); ITAD as a link in the offer description;
    replace the redundant opportunity signals with a discounted-games
    counter; sorting by discount; efficient search matching the library
    search behavior; warning color for the missing-metadata note
  - [x] 21e. **Settings and onboarding** - rearrange and group settings
    sections by concern; fix the hydration mismatch on hard reload with
    stored visual preferences; add an app theme choice (family and mode) to
    the welcome onboarding; strip trademark and copyright symbols from game
    names at Steam import time (import runs from the Settings Steam
    connection card)

- [x] 22. **Handheld suitability flag and handheld-aware recommendations** -
  owner-marked handheld-suitable games feeding environment-aware
  recommendations and compatibility presentation across catalog and wishlist
  - [x] 22a. **Handheld-suitable personal flag** - nullable flag on
    LibraryEntry and WishlistEntry (mirroring gameExperience), edit
    affordances on game detail and wishlist edit/detail, Library filter,
    export/import schema updates
  - [x] 22b. **Handheld-aware fit and context** - engine factors with visible
    explanations: a handheld-fit boost or caveat where the setup has a Linux
    handheld (including the Windows-primary case, where compatibility
    evidence is framed for the handheld target), and the Windows-handheld
    rescue: a handheld-suitable game playable on a configured Windows
    handheld is not hard-excluded by no-fallback evidence and the
    explanation says so, while non-flagged games keep the heavy
    practical-fit penalty; setup changes re-derive affected runs per the
    existing rules

- [x] 23. **IGDB as primary metadata, artwork, and playtime provider** -
  replace RAWG completely with IGDB for catalog and wishlist evidence, keeping
  SteamSpy as the duration-only fallback; provider data rebuilds from a clean
  database restart that doubles as the new-provider workflow test
  - [x] 23a. **IGDB client and identity foundation** - Twitch
    client-credentials token cache (about 60-day validity with proactive
    refresh), 4 requests/second and max-8-concurrent rate limiting with
    Retry-After handling, 10-second timeouts, Steam App ID identity resolution
    through IGDB `external_games`, and normalized fuzzy-search matching with
    high-confidence automatic fixing, persistent manual replacement, and
    base-game/DLC category safety; ambiguous or incompatible candidates remain
    unmatched for review; provider contract locked at spec time
  - [x] 23b. **Catalog IGDB enrichment** - IGDB-shaped metadata snapshot
    (summary, genres/themes/keywords, involved companies, first release date,
    ESRB age rating, separate IGDB aggregated, community, and total ratings
    with counts, websites, alternative names, collections, franchise, explicit
    DLC/expansion/remake relations, game modes), artwork and screenshot
    capture with derived palettes and wide-image fallback order (artwork,
    screenshot, cover, deterministic local fallback), post-import queueing,
    individual and catalog-wide load actions with overwrite warnings, and
    manual search with portrait cover candidates; dense metadata uses
    progressive disclosure
  - [x] 23c. **Playtime evidence and duration wiring** - IGDB
    `game_time_to_beats` primary (hastily, normally, and completely mapped to
    history main, history + extras, and completionist), automatic SteamSpy
    median fallback only when IGDB has no row and a confirmed Steam App ID
    exists, and RAWG playtime used nowhere; attributed expandable duration
    metadata and a three-profile preference captured in Welcome and editable
    in Settings, whose selected estimate appears in Library/Wishlist and feeds
    `durationBand`, Tune length matching, and the profile DURATION dimension;
    duration remains soft evidence
  - [x] 23d. **Wishlist IGDB flows and identity suggestions** - fill-only
    enrichment for base-game wishes, with explicit manual refresh/identity
    changes allowed to replace snapshots, and automatic application of a Steam
    App ID derived from any fixed high-confidence or manual IGDB match;
    identity remains editable, and the retired RAWG store-links and
    `storesearch` fallback are removed; wishlist metadata transfer on
    acquisition uses the IGDB snapshot
  - [x] 23e. **Engine re-derivation and RAWG retirement** - recommendation
    dimensions re-keyed to IGDB evidence with a per-dimension signal-value
    analysis (genres/themes/keywords, multiplayer modes, attributed ratings
    with sample size, era, publishers, collections/franchise) so each
    dimension earns its place by informing picks instead of mirroring RAWG
    blindly; compatibility auto-queue moved behind successful IGDB
    enrichment, attribution swap, RAWG client/env/code removal,
    stale-snapshot retry presentation, and a documented clean-restart
    procedure (personal export including all external IDs, wipe, empty-schema
    restore, Steam re-import, IGDB enrichment); runs after features 24-27

## Catalog renewal before engine re-derivation

Features 24-27 land before 23e so the engine re-derivation consumes the new
data; 28 completes the behavior renewal after 23e. Deployment remains last.

- [x] 24. **DLC metadata, pages, and browsing with IGDB** - IGDB snapshots for
  catalog DLCs (Steam-fetched and manual) and DLC wishes with description,
  first release date, cover, and artwork; dedicated detail pages for catalog
  DLCs with a visible base-game link (the base game stays required in the
  catalog); DLC identity resolved from the base game's IGDB relations plus
  exact Steam App ID lookup through external_games, with exact matches
  auto-applied and name variants routed to review. DLC acquisition is a
  manual per-game flow, not owned-sync derived: the reworked base-game DLC
  section offers a fetch-DLC-list action for games with a Steam App ID
  (Steam appdetails dlc IDs resolved to names through one batched IGDB
  external_games query, falling back to appdetails or raw App IDs), shown
  as an ephemeral unchecked dialog list where checked items are marked
  acquired as catalog DLCs with IGDB enrichment queued from the exact Steam
  App ID (no-match DLCs are still created unenriched), unchecked items are
  never persisted, and already-owned or wishlisted DLCs appear disabled with
  badges; manual games without a Steam App ID keep the existing Create DLC
  dialog and IGDB name-match enrichment. DLCs carry no library entry and no
  play state, ever (owned or wishlisted), so they cannot influence play
  state; existing DLC library entries are cleaned up and play-state UI is
  hidden on DLC pages, while the wishlist DLC acquisition parent play-state
  offer stays unchanged. Owned-sync DLC population is retired: the
  UnresolvedSteamDlc machinery becomes wishlist-DLC-only, with existing
  OWNED_SYNC rows removed. The library keeps hiding DLCs from its grid and
  list and adds a Has-DLC filter chip following the handheld-filter
  pattern; backlog progress and play-state counting remain base-game only
  and the plan keeps it that way; and the base-game DLC section becomes
  cover cards linking to DLC pages with IGDB match status

- [x] 25. **Interest defaults across ingestion paths** - Steam library import
  sets interest 2/5 matching wishlist import; manual creation defaults to
  3/5 in catalog and wishlist forms, including the wishlist edit dialog's
  null default; wishlist acquisition carries the wish's interest into the
  catalog entry for base-game wishes only (DLCs hold no library entry, so
  acquired DLCs store no interest), falling back to 3/5; Steam wishlist
  import, unresolved-DLC wishes, and taste setup keep their current values

- [x] 26. **Add Game dialog with IGDB suggestion and interest** - manual
  catalog creation asks interest (default 3) and offers the same IGDB
  suggest-and-confirm flow as the wishlist add dialog so games arrive
  enriched from the start

- [x] 27. **Collections: default shelves and IGDB series** - new system
  shelves for In progress, Completed, Backlog, Handheld picks, and Games
  with DLC (base games owning acquired DLCs, complementing the feature-24
  Has-DLC library filter), and calculated series/franchise shelves derived
  from the IGDB collection and franchise snapshot evidence

- [x] 28. **Recommendation behavior renewal** - after the re-keyed engine lands,
  replace the second Best Fit with a dedicated Handheld pick whenever the setup
  includes a handheld. It selects the highest-ranked play-eligible,
  handheld-suitable game under the existing environment-fit rules; when none
  qualifies, omit the role with an explanation. A Handheld Tune toggle strictly
  limits every Play Next role to handheld-suitable games.

  Replace the plain Tune accordion with a distinctive default question flow:
  time (Any, Under 6h, 6-20h, 20-50h, 50+h), play style (Any, Solo, Online
  with others, Couch co-op), and familiarity (Familiar, Balanced, Different).
  Handheld is a separate combinable toggle. Known conflicting play modes are
  excluded; unknown play-mode metadata remains a caveated fallback. Familiar
  boosts learned history and manual genre/tag preferences, with a caveated
  normal-ranking fallback. Balanced keeps current scoring. Different strictly
  selects outside those signals, leaving a role empty when no such candidate
  exists. Existing genres, tags, sequel posture, era, maturity, and source
  controls move under More filters with their current soft, capped, any-match
  behavior.

  Active Tune state is local to one browser tab, survives reloads in that tab,
  clears when it closes, and applies only through Update recommendations.
  Named presets persist but load only into the tab-local state. Rotation,
  exposure, and calibration behavior stay unchanged pending real usage data

- [x] 29. **Today recommendation spotlight carousels** - replace the Play Next
  and Buy role grids on Today with one spotlight carousel per section. Play Next
  retains both general fit picks, labeling the second **You Might Also Enjoy**,
  and may add Out of the Box, Change of Pace, and Handheld for up to five
  slides. Handheld is additive rather than replacing a Best Fit. Buy applies
  the same label to its second Best Fit when present and retains the existing
  deal-saturation role rules. Roles without a qualified candidate are omitted
  silently, producing a shorter balanced carousel without placeholders or
  omission notices.

  Each slide places game artwork beside useful metadata and the recommendation
  reasoning. Show the three or four strongest factors initially, with remaining
  factors and caveats available through an accessible disclosure. `View details`
  is the primary action; Play Next keeps `Start playing` as a secondary action.
  Buy opens Wishlist Detail rather than navigating directly to a seller. In the
  Wishlist Detail hero, the provider name in copy such as
  `Best current offer from Fanatical` links to the selected external offer.

  Both carousels advance every ten seconds, pause on hover, focus, touch, manual
  navigation, or another interaction, and resume afterward. Reduced motion
  makes them manual. Replace neutral `Show another`, separate dismiss controls,
  and optional dismissal reasons across every recommendation surface with one
  action: `Maybe some other time — show me another`. It records a dismissal,
  preserves the existing cumulative calibration rule, and immediately replaces
  the item from the retained batch for the same role. If that batch has no
  replacement, the slide disappears.

- [x] 30. **Current play state and prior-completion history** - use current
  states `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, and `ABANDONED`, with an
  independent user-editable `completedBefore` flag. No legacy-state migration
  or backward compatibility is required because the database will be rebuilt.

  Any transition away from `COMPLETED` automatically activates
  `completedBefore`. Moving from `COMPLETED` to `IN_PROGRESS`, whether manually
  or through `Start playing`, also consumes and clears `replay`; starting a
  recommended replay follows the same rule. The user may later clear
  `completedBefore` to correct their history. Taste Setup's
  `I've played this` activates only `completedBefore` and does not infer or
  change the current state.

  Active-backlog progress uses only the current state: `COMPLETED` counts as
  complete, `NOT_STARTED` and `IN_PROGRESS` count as active backlog, and
  `ABANDONED` is excluded. Prior completion remains visible history and does
  not double-count progress. For recommendation learning, current completion
  and prior completion consolidate into one positive completion signal. A
  prior completion and a current abandonment remain distinct positive and
  negative evidence.

  Rename the calculated Completed shelf to **Previously completed**. It includes
  games currently `COMPLETED` and games with `completedBefore = true`, so a
  replay may intentionally appear in both Previously completed and In Progress
  or Backlog. A `COMPLETED` game marked `replay` remains Play Next eligible.

  Update every state control, main-game/start flow, recommendation eligibility,
  profile/event derivation, Taste Setup, shelves, counts, acquisition prompt,
  export/import, and tests. DLC acquisition retains `No change`, `Not started`,
  `In progress`, and the separate `Plan to play` flag, plus the independent
  `Mark parent as replay candidate` option; state transitions apply the same
  completion-history and replay-consumption rules.

- [x] 31. **Personal-data and availability simplification** - remove catalog
  and wishlist notes and remove the redundant per-game availability display
  label from the Prisma model, validation, actions, forms, details,
  recommendation inputs, acquisition transfer, and export/import. Existing
  values may be discarded directly. Use each reusable source's canonical name
  everywhere.

  Keep reusable-source creation, rename, and archive exclusively in Settings.
  Game forms and Game Detail may assign or remove saved active sources and link
  to Settings, but never administer source definitions or preserve a draft
  while the user completes that separate Settings flow. An archived source
  already assigned to a game remains visible and marked `Archived`; it can be
  preserved or removed but cannot be assigned again after removal.

  Keep `Change platform` exclusive to Game Detail. Do not add it to Library
  cards. Preserve the existing Library-card `Delete` action, destructive
  confirmation, and Undo behavior.

  Merge the Game Detail `Play state` and `Personal Profile` sections into one
  compact personal-data section with two visual groups:
  **Journey** (current state, previously completed, main game, play soon,
  replay, hidden) and **Preferences** (interest, rating, priority, game
  experience, preferred environment, handheld suitability). Wishlist Detail
  uses **Personal fit** for interest, experience, and handheld suitability,
  while target price, identity, and offers remain in the purchase area.
  Replace permanent helper paragraphs with accessible information popovers
  usable by pointer, keyboard, and touch.

  Introduce the new export/import schema directly without backward-compatible
  normalization because the app has not reached staging and the database will
  be rebuilt. Removed fields are neither exported nor accepted for restore.

- [x] 32. **Unified personal tags and collection shelves** - make personal
  tags the only manual grouping model and remove the separate manual
  `Collection` model as part of the clean database rebuild. Every tag,
  including an empty tag, automatically creates a browsable collection shelf.
  Games may belong to multiple tags. Calculated system shelves and IGDB
  series/franchise shelves remain read-only and distinct.

  Add a `Manage tags` action to the Tag shelves section on Collections. Its
  dialog lists tags with game counts and supports creating, renaming, merging,
  and deleting them. Game Detail continues to support quick create-or-reuse,
  assignment, and removal. Tag names preserve the user's displayed
  capitalization, while uniqueness trims surrounding whitespace and ignores
  case.

  Renaming to an existing normalized name offers an explicit merge confirmation.
  A merge unions and deduplicates game memberships, updates active presets to
  the surviving tag, and removes the absorbed tag. Deleting a tag removes its
  memberships and active preset references. Historical recommendation runs
  retain their recorded tag names after rename, merge, or deletion.

  Tag shelves support alphabetical and game-count ordering, with alphabetical
  as the default. Preserve Library filtering. Add personal tags to Tune under
  More filters, visually distinct from IGDB genres/themes/keywords and inactive
  by default. Multiple selected tags use a soft, capped, any-match boost:
  matching several tags does not accumulate extra points. Include presets,
  current run context, explanations, recommendation reset, export/import, and
  tests.

- [x] 33. **Sign-in introduction demo** - playful, adventurous desktop sign-in
  panel with the brand icon, tagline "Turn your gaming backlog into your next
  adventure", and a decorative, reduced-motion-aware static cycle showing
  Half-Life 2, Cult of the Lamb, Elden Ring, Grand Theft Auto V, and NieR:Automata move
  from manual or Steam-imported backlog addition through personal tracking to
  an explainable recommendation; sign-in remains primary and the demo follows
  it on mobile.

- [x] 34. **Welcome regional prices and optional Steam connection** - deliver
  market-aware price preferences and the optional Steam connection in two
  reviewable parts.
  - [x] 34a. **Regional price preferences and presentation** - extend Welcome
    and Settings with Mexico, United States, Canada, Brazil, Colombia, and
    Argentina markets plus MXN, USD, CAD, BRL, COP, and ARS display currencies.
    Persist validated preferences; warn in Settings that a change requires a
    manual price refresh before offers reflect it. ITAD calls use the selected
    market and its regional activation rules. Offers preserve exact provider
    currency and amount; Frankfurter v2 conversion is presentation-only,
    visibly estimated, retains source amounts, and is unavailable rather than
    guessed when a rate cannot be fetched. Other regions and currencies are out
    of scope; no fallback market is offered.
  - [x] 34b. **Optional Steam connection in Welcome** - offer the existing
    Steam OpenID connection as an explicit optional Welcome action with a skip
    path. A connection attempt, cancellation, or failure never blocks setup.

- [ ] 35. **Deployment and CI readiness** - Vercel/Supabase environment
  review, Vercel Cron daily run at 06:00 UTC-6 with `CRON_SECRET` enqueueing
  the price refresh plus a compatibility freshness sweep for catalog and
  wishlist evidence older than the 180-day window, queue overlap protection,
  production build, smoke test, one reproducible Verify command, and automatic
  checks when configured; final planned step but not an inflexible feature gate

- [x] 36. **Today taste setup and recommendation gating** - pre-deployment
  renewal of Today: hide all recommendation surfaces until a saved Taste Setup;
  require at least ten library base games before setup can begin; randomly pick
  setup games; independently record `Played before`, `Recommend more like
  this`, and `Would like to play soon`; preselect and persist prior completion;
  treat combined prior-play and recommendation interest as a strong signal;
  replace without negative feedback; remove preferred environment; omit Buy
  recommendations with an empty wishlist; and align the second Today row and
  personal tag shelves with the provided visual reference.

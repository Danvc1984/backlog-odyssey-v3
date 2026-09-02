# Backlog Odyssey - Project Overview

> Private, single-user gaming library and decision assistant for choosing what
> to play and buy in Mexico across Bazzite, Steam Deck, and Windows.

## Product, user, and boundaries

Backlog Odyssey consolidates ownership, personal catalog state, prices,
compatibility evidence, metadata, and explainable recommendations. It is not a
launcher, storefront, or automatic purchasing tool.

The MVP serves one authorized Google account on Bazzite desktop, Steam Deck,
and a Windows fallback. Mexico pricing and UTC-6 are the defaults. Public
registration, collaboration, automatic Steam synchronization, notifications,
webhooks, PWA/offline behavior, and automatic non-Steam account-library imports
are outside scope. Alternative stores remain manual availability sources unless
they offer a supported account-library API.

Personal intent and explicit catalog choices are authoritative. Provider data
from Steam, RAWG, ITAD, ProtonDB, AWAY, and later Wallhaven is replaceable
evidence: it never silently overwrites local data. Provider work is persistent,
asynchronous, rate-limited, retryable up to three times, and failures preserve
the last usable data.

## Build order

The exact checked state is owned by blueprint/build-plan.md.

1. **[x] 1-6: Foundation, catalog, and Steam** - Auth, manual library, game
   detail, personal state, collections, Steam linking, and explicit sync.
2. **[x] 7a-7c: Catalog integrity** - Duplicate review, conservative
   merge/delete with short-lived Undo, and safe editing.
3. **[x] 8a-8e: RAWG enrichment** - Matching, versioned snapshots, asynchronous
   queues, post-import enrichment, ESRB, and series evidence.
4. **[x] 9: DLC review model** - Explicit base-game ownership and shared
   unresolved-Steam-DLC review queue.
5. **[x] 10a-10c: Wishlist and pricing** - Independent base/DLC wishes,
   acquisition, identity provenance, Mexican offers, target opportunities, and
   conservative manual Steam wishlist import.
6. **[x] 11-11d: Compatibility and wishlist detail** - Bazzite-first evidence,
   Windows fallback, catalog and wishlist queues/sweeps, and wishlist detail.
7. **[x] 12-12e: Recommendations** - Explainable Play Next and Buy runs,
   adaptive profile/calibration, role diversity, reusable alternative sources,
   and inclusive source tuning.
8. **[x] 13-13b: Today functional dashboard** - Progress, coverage, cached
   recent activity, latest explicit recommendations, offers, and operations.
9. **[x] 14a: Theme, preferences, and shell** - Prototype tokens, dark/light/
   system parity, non-migrating visual preferences, responsive shell.
10. **[x] 14b: Today dashboard composition** - Existing data rendered as two
    carousels, dominant Play Next, and lower operational context.
11. **[x] 14c: Library surfaces** - Shared system plus approved grid/list,
    filter chips, health strip, and catalog card parity without changing
    queries or behavior.
12. **[x] 14d: Wishlist surfaces** - Shared system plus approved focus/list,
    signal grid, and entry-card offer, identity, staleness, target, and
    interest composition.
13. **[ ] 14e: Library and Wishlist header action rework** - Homogenized header
    actions, operation statuses, follow-up sections, and ProtonDB compatibility
    tags on game cards in both views.
14. **[ ] 14f: Detail, collection, and supporting routes** - Shared treatment
    for Today, Game Detail, Wishlist Detail, Collections, Settings, dialogs,
    forms, safe image overlays, and deterministic fallbacks.
15. **[ ] 14g: Acceptance and accessibility** - Cross-app states, mobile,
    keyboard, focus, contrast, reduced motion/data, and final visual review.
16. **[ ] 15: Wallhaven background** - Optional cached SFW pool, daily
    deterministic rotation, shuffle, attribution, fallback, reduced-data off.
17. **[ ] 16: Per-game themes** - Server-derived RAWG palette data, read-only
    game-detail use, contrast safeguards, deterministic fallback.
18. **[ ] 17: Settings and export** - Sessions, provider/queue controls,
    diagnostics, Wallhaven, visual preferences, and manual JSON export.
19. **[ ] 18: Deployment and CI readiness** - Vercel/Supabase, Cron, smoke
    tests, Verify command, and automatic checks.

## Data model and ownership

The exact schema lives in prisma/schema.prisma. These are the stable product
boundaries.

### Identity, operations, and catalog

- User, Account, and Session provide one-user Google authentication.
- AppSettings holds fixed environment context and later app controls. Feature 14
  visual preferences use a non-migrating mechanism; provider/export controls
  remain Feature 17.
- SteamConnection, SyncRun, EnrichmentJob, PriceRefresh, and sweep/run records
  persist status, retry timing, counts, and safe diagnostics.
- SteamRecentActivityCache holds a 24-hour narrow activity result. It may show
  unimported titles but never imports or links catalog records.
- Game is catalog-only and represents a base game or DLC. LibraryEntry holds
  personal play state, main game, priority, interest, rating, environment,
  game experience, notes, replayCandidate, and hidden state.
- ExternalGameId stores provider identities and provenance. GameAvailability is
  separate from origin, provider IDs, compatibility, and offer sellers.
- Steam and ROM are built-in availability kinds. Other platform availability
  references reusable AlternativeSource, which has a normalized name, optional
  known-source key, icon metadata, and archive state. No source is inferred
  from legacy free text.
- MetadataSnapshot is replaceable RAWG data with attribution. PossibleDuplicate
  records review evidence. CatalogOperation enables scoped, reload-safe Undo for
  merge and delete.

### Wishlist, pricing, compatibility, and recommendations

- WishlistEntry stays independent from Game until explicit acquisition. It is an
  unowned base game or an unowned DLC linked to an owned base game.
- WishlistMetadataSnapshot is independent RAWG evidence. UnresolvedSteamDlc,
  WishlistImportReview, and WishlistImportIgnore preserve manual review across
  owned sync and wishlist import.
- DealOffer keeps valid Mexican offer alternatives. ItadIdentity caches
  Steam-App-ID-to-ITAD mapping. The selected offer is the cheapest valid Mexican
  offer, never one based on seller preference.
- Target price is optional. Fresh target hits create opportunity signals;
  historical low is display-only. Offers stale after 48 hours cannot create a
  strong opportunity signal.
- CompatibilitySnapshot and EnvironmentCompatibility hold catalog evidence.
  Bazzite is primary, Windows is derived, and Bazzite-only personal overrides
  take priority. Wishlist compatibility uses parallel, read-only storage keyed
  to wishlist entries and never reuses catalog snapshots.
- RecommendationRun, RecommendationItem, RecommendationFeedback,
  RecommendationEvent, RecommendationProfile, RecommendationPreference, tune
  state, and presets are recommendation-owned. Reset removes these only,
  preserving catalog and provider data.
- PersonalTag, GameTag, Collection, and CollectionMembership organize games.
  WallpaperState, introduced in Feature 15, stores URLs and selection only,
  never image binaries.

## Product rules

### Steam, catalog, and wishlist

- Base-game delete explicitly lists and cascades DLC. Merge combines compatible
  relationships, surfaces conflicts, and never silently deletes equivalent DLC.
- Steam import and sync are manual. Initial import queues RAWG work; later sync
  does not. Recent activity is a separate cache, never a hidden sync/import.
- ROM-only games are compatibility not applicable, not unknown. Mixed-source
  games may still receive Steam-keyed evidence.
- A wish is priceable only with confirmed identity: Steam import, a
  user-confirmed Steam URL/App ID, or an explicitly confirmed suggestion. When
  RAWG store URLs are empty in practice, the App ID resolves through Steam's
  keyless `storesearch` exact-name match behind the steam-slug trigger, still
  suggestion-only until confirmed. Provenance is visible.
- One explicit global Wishlist price action queues confirmed identities,
  prevents overlap, and reports refreshed, failed, and identity-required items.
  Scheduled work waits for deployment.
- ITAD is server-side, read-only, country=MX, batched, cached, and respects
  rate limits. The seller page is authoritative for activation; key stores warn
  that Mexico activation must be checked.

### Compatibility and recommendations

- ProtonDB and AWAY remain separate attributable evidence. A Steam App ID keys
  evidence. A single 180-day freshness rule keeps stale values visible and
  warns recommendations instead of excluding a game.
- A global compatibility sweep is already available from Settings as part of the
  shipped catalog and wishlist flows; Feature 17 may expand or relabel those
  controls. Scheduled rescheduling waits for deployment.
- Play Next considers non-hidden, non-main base games that are not started or
  replay-flagged played/abandoned games. In-progress titles belong to Today;
  DLC does not enter Play Next. Buy considers base wishes and eligible DLC
  wishes; ROMs never enter Buy.
- Interest is durable taste; catalog priority is short-term Play Next urgency.
  Compatibility and metadata are soft, explainable evidence, not hard gates.
- Source tuning is an inclusive, modest Play Next boost. It does not exclude
  eligible games, affect Buy, or influence seller/offer selection.
- Play Next provides two Best Fit roles, Out of the Box, and Change of Pace.
  Buy provides Best Fit and deal roles under the documented deal-saturation
  rule. No alphabetical tie-break decides a displayed game.
- Today renders the latest play-next run's stored roles (two best-fit, one
  qualified out-of-the-box, one change-of-pace) and the latest buy run's stored
  roles (best-fit and deal picks per the saturation rule); these remain the
  latest explicitly generated runs.
- Show another rotates retained candidates without a new run. Exposure is a
  temporary cooldown, never negative feedback. Start playing marks a game
  in progress and follows the existing main-game decision; it never launches a
  game.

## Today and visual direction

Today is the post-login decision dashboard. It recalculates local summaries but
never silently starts sync, enrichment, price, compatibility, or recommendation
work. It keeps active-backlog progress, coverage dialogs, latest explicit runs,
cached recent Steam activity, offers, freshness, and operation states.

### Feature 14 Today composition

The first viewport is two equal, independently useful carousels:

- Currently playing leads with main game then in-progress titles, offers
  local context, and links to Game Detail. It never claims to resume or
  launch.
- Featured offers renders up to three items from the existing Today offer
  ranking, preserving discount/target/price ordering, returned currency, store,
  freshness, wishlist detail, and seller links.

Both carousels have visible manual navigation, position, keyboard
access, slow discreet auto-advance, and pause on hover/focus. In reduced motion
they are manual. Contextual empty states can link to existing actions but
cannot trigger hidden provider work.

Play Next is the largest independent section: a primary Best Fit card takes
roughly two thirds of the layout and exposes stored explanations, factors,
caveats, compatibility/source context, and Start playing. The compact rail
carries all remaining stored roles: second Best Fit, Change of Pace, and Out of
the Box. Buy remains a full lower section; recent activity, data health,
freshness, and operations are supporting sections.

## Routes

- / - authentication landing.
- /today - decision dashboard, coverage dialogs, recommendations, recent Steam
  activity, offers, provider freshness, and operations.
- /library - searchable catalog, source filters, manual creation, duplicate
  review, and catalog enrichment. Feature 14 adds grid/list presentation.
- /games/[id] - personal fields, availability, metadata, compatibility, DLC,
  duplicate/recommendation context, and RAWG actions.
- /wishlist - independent wishes, RAWG, identity, global price refresh,
  opportunities, Steam import/review, and acquisition. Feature 14 adds focus/list.
- /wishlist/[id] - metadata, identity/provenance, offers, target, notes,
  interest, acquire/edit/delete, compatibility, and fill-only enrichment.
- /collections and /collections/[id] - collections and existing forms/dialogs,
  restyled in Feature 14f.
- /settings - sessions, recommendation profile/reset, provider and queue
  controls, wishlist diagnostics, visual preferences, Wallhaven, and export.

## Tech, validation, and deployment

- Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
  Prisma/PostgreSQL/Supabase, Auth.js/Google, Zod, Vitest, and Vercel.
- Commands: pnpm dev on port 3500, pnpm build, pnpm start, pnpm lint,
  pnpm typecheck, and pnpm test.
- Provider keys stay server-side. Production validates environment, database
  migration, queue/scheduler behavior, and smoke tests.
- Feature 18 configures Vercel Cron and CRON_SECRET to enqueue daily price
  refresh at 06:00 UTC-6. Claims must be atomic, calls idempotent, and retry
  history visible.
- Feature 14 acceptance covers primary routes on desktop/mobile and dark/light/
  system modes, keyboard/focus/targets/contrast, reduced motion/data, and
  loading/empty/error/stale/operation states, then existing automated checks.

## Open questions and plan gaps

- Wallhaven rate limits and keyword defaults validate in Feature 15; exact
  Vercel/Supabase scheduler configuration validates in Feature 18.

## Next workflow action

The next unchecked item is **Feature 14e: Library and Wishlist header action
rework**. Run `$feature 14e` to produce its reviewed implementation spec. If
the UI direction needs another review, `$prototype` remains available for
throwaway HTML/CSS mockups before implementation.

This overview is generated from the two plans and does not authorize code
changes.
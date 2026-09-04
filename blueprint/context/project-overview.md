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
from Steam, RAWG, ITAD, ProtonDB, AWAY, and Wallhaven is replaceable evidence:
it never silently overwrites local data. Provider work is persistent,
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
9. **[x] 14a-14f: Visual foundation** - Prototype-validated tokens, dark/light/
   system parity, non-migrating visual preferences, Today/Library/Wishlist/
   header rework, cross-app accessibility acceptance, and detail-route
   composition in Feature 15.
10. **[x] 15-16: Supporting routes and Wallhaven** - Shared treatment for Game
    Detail, Wishlist Detail, Collections, and Settings, plus the optional
    cached Wallhaven background with rotation, shuffle, attribution, fallback,
    and reduced-data hard-off.
11. **[ ] 17a-17d: Per-game themes and RAWG screenshots** - Version 3 snapshot
    adding derived palettes and up to six screenshots, hero-band themes with
    decorative accent tints on game detail and wishlist detail, a dedicated
    screenshots carousel, and backfill through the existing re-enrichment
    route.
12. **[ ] 18a-18c: Settings, export, and restore** - Consolidated Settings
    surfaces, versioned personal-data JSON export, and empty-schema-only
    import in one all-or-nothing transaction.
13. **[ ] 19a-19g: Odyssey theme expansion** - Dawn and Sunset palette families
    (light and dark each) with family-owned semantic hue mapping, Cinzel/Inter
    typography, official brand icons, and a whole-app Odyssey voice sweep on
    expressive surfaces, locked through a prototype first; the general UI icon
    swap waits for the owner's chosen set.
14. **[ ] 20: Deployment and CI readiness** - Vercel/Supabase, Cron covering
    prices plus the compatibility freshness sweep, smoke tests, Verify command,
    and automatic checks.

## Data model and ownership

The exact schema lives in prisma/schema.prisma. These are the stable product
boundaries.

### Identity, operations, and catalog

- User, Account, and Session provide one-user Google authentication.
- AppSettings holds fixed environment context and app controls. Feature 14
  visual preferences use a non-migrating mechanism and gain the Dawn/Sunset
  family selector in Feature 19; provider, export, and import controls live in
  Feature 18.
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
- MetadataSnapshot is replaceable RAWG data with attribution. Feature 17 bumps
  it to version 3: derived palette variants (primary plus dark/muted) and up
  to six screenshot URLs (id, image, width, height; RAWG-hidden entries
  filtered), tolerant of v1/v2 rows and backfilled by re-enrichment.
  PossibleDuplicate records review evidence. CatalogOperation enables scoped,
  reload-safe Undo for merge and delete.

### Wishlist, pricing, compatibility, and recommendations

- WishlistEntry stays independent from Game until explicit acquisition. It is an
  unowned base game or an unowned DLC linked to an owned base game.
- WishlistMetadataSnapshot is independent RAWG evidence and follows the same
  v3 contract for base-game wishes. UnresolvedSteamDlc, WishlistImportReview,
  and WishlistImportIgnore preserve manual review across owned sync and
  wishlist import.
- DealOffer keeps valid Mexican offer alternatives. ItadIdentity caches
  Steam-App-ID-to-ITAD mapping. The selected offer is the cheapest valid Mexican
  offer, never one based on seller preference.
- Target price is optional. Fresh target hits create opportunity signals;
  historical low is display-only. Offers stale after 48 hours cannot create a
  strong opportunity signal.
- CompatibilitySnapshot and EnvironmentCompatibility hold catalog evidence.
  Bazzite is primary, Windows is derived, and Bazzite-only personal overrides
  take priority. WishlistCompatibilitySnapshot and
  WishlistEnvironmentCompatibility are parallel, read-only storage keyed to
  wishlist entries and never reuse catalog snapshots.
- RecommendationRun, RecommendationItem, RecommendationFeedback,
  RecommendationEvent, RecommendationProfile, RecommendationPreference, tune
  state, and presets are recommendation-owned. Reset removes these only,
  preserving catalog and provider data. All of these are export/import data in
  Feature 18, restoring only into an empty schema.
- PersonalTag, GameTag, Collection, and CollectionMembership organize games.
  WallpaperState stores Wallhaven URLs and selection only, never image
  binaries.

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
- ITAD is server-side, read-only, country=MX, batched, cached, and respects
  rate limits. The seller page is authoritative for activation; key stores warn
  that Mexico activation must be checked.

### Compatibility and recommendations

- ProtonDB and AWAY remain separate attributable evidence. A Steam App ID keys
  evidence. A single 180-day freshness rule keeps stale values visible and
  warns recommendations instead of excluding a game.
- A global compatibility sweep is available from Settings. The deployment
  feature's daily cron enqueues a compatibility freshness sweep for catalog
  and wishlist evidence older than the window, alongside the price refresh.
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

### Themes, voice, and icons (Features 17 and 19)

- Per-game themes derive server-side during RAWG enrichment and apply
  read-only as a hero band plus decorative accent tints (headers, borders,
  chips, dividers). Semantic tokens stay untouched; contrast overlays,
  deterministic fallbacks, and reduced-data behavior apply.
- RAWG screenshots render as a dedicated bottom carousel-style section on
  game detail and wishlist detail (base-game wishes), separate from the
  metadata block, with attribution and reduced-data token fallback.
- Theme families are Dawn (cyan/purple) and Sunset (orange/yellow), each in
  light and dark - four selectable palettes over the feature-14 token
  architecture. Each family owns the hue mapping for the semantic roles
  (interactive, deal/opportunity, warning, danger), contrast-validated per
  palette; roles stay stable app-wide. Settings gains the family selector;
  system mode resolves light/dark within the selected family.
- Typography pairs Cinzel (display) with Inter (body); technical monospace
  evidence labels are unchanged. The pairing and Sunset mapping get their
  final call at the 19a prototype.
- The Odyssey voice sweep covers expressive surfaces only - page and section
  headers, empty states, buttons, dashboard moments, and dialogs - mixing
  subtle allusion with named mythology. Statuses, errors, evidence labels,
  freshness, field help, and caveats stay plain and factual. Navigation and
  section names keep their identity.
- Official brand icons replace placeholder art for known availability sources;
  the neutral fallback for custom sources is unchanged. The general UI icon
  swap is the gated final step awaiting the owner's premium/custom set.

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
  review, and catalog enrichment, with grid/list presentation.
- /games/[id] - personal fields, availability, metadata, screenshots,
  derived-palette themed surfaces, compatibility, DLC, duplicate/recommendation
  context, and RAWG actions.
- /wishlist - independent wishes, RAWG, identity, global price refresh,
  opportunities, Steam import/review, and acquisition, with focus/list
  presentation.
- /wishlist/[id] - metadata, screenshots and themed surfaces for base-game
  wishes, identity/provenance, offers, target, notes, interest,
  acquire/edit/delete, compatibility, and fill-only enrichment.
- /collections and /collections/[id] - collections and existing forms/dialogs.
- /settings - sessions, recommendation profile/reset, provider and queue
  controls, wishlist diagnostics, visual preferences with the Dawn/Sunset
  family selector, Wallhaven, export, and empty-schema import.

## Tech, validation, and deployment

- Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
  Prisma/PostgreSQL/Supabase, Auth.js/Google, Zod, Vitest, and Vercel.
- Commands: pnpm dev on port 3500, pnpm build, pnpm start, pnpm lint,
  pnpm typecheck, and pnpm test.
- Provider keys stay server-side. Production validates environment, database
  migration, queue/scheduler behavior, and smoke tests.
- Feature 20 configures Vercel Cron and CRON_SECRET for a daily run at
  06:00 UTC-6 enqueueing the price refresh plus a compatibility freshness
  sweep for catalog and wishlist evidence older than the 180-day window.
  Claims must be atomic, calls idempotent, and retry history visible.
- Visual acceptance (14f, and 19g for the families) covers primary routes on
  desktop/mobile and light/dark/system modes, keyboard/focus/targets/contrast,
  reduced motion/data, and loading/empty/error/stale/operation states, then
  existing automated checks.

## Open questions and plan gaps

- Wallhaven wording: project-plan.md section 13 and build-plan item 16 still
  describe a fixed keyword pool (gaming-art/landscape defaults), while the
  latest approved spec revision made searches game-driven - main game title
  first, then in-progress titles, no fixed keyword list. The plans can be
  updated to match the shipped behavior; nothing else depends on it.
- Sunset family's exact orange/yellow mapping and the final Cinzel/Inter
  confirmation happen at the 19a prototype.
- The general UI icon set choice is the owner's; it gates only 19f.

## Next workflow action

The next unchecked item is **17a: Version 3 snapshot - palettes and
screenshots**. Run `/feature 17` to produce the reviewed implementation spec.

This overview is generated from the two plans and does not authorize code
changes.

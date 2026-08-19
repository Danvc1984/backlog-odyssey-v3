# Backlog Odyssey - Project Overview

> A private, single-user gaming-library assistant for deciding what to play and buy in Mexico across Bazzite, Steam Deck, and Windows.

## Problem

Gaming ownership, prices, compatibility evidence, metadata, and personal notes
are scattered across separate services. The owner needs one private assistant to
decide what to play, what to buy in Mexico, and which environment is most
practical.

Backlog Odyssey consolidates ownership, manual entries, wishlist intent,
regional deals, compatibility evidence, metadata, and explainable
recommendations without becoming a launcher or storefront.

## Users

- One private owner using a Bazzite desktop, Steam Deck, and Windows fallback.
- Mexico prices and UTC-6 display.
- One authorized Google account. Public registration, roles, collaboration, and
  multi-user behavior are outside the MVP.

## Features

The MVP feature set follows `blueprint/build-plan.md` in order. Feature 8 is the
current headline area, with `8a` as the active sub-feature.

1. **App shell and auth gate** - Next.js shell and single-user Google access.
2. **Manual catalog and library base** - Manual games and library filters.
3. **Game detail** - Metadata, availability, and personal fields.
4. **Play states and main game** - State rules, flags, and main-game constraint.
5. **Collections** - Manual and calculated collections.
6. **Steam connection and sync** - Steam account linking, owned-game import,
   playtime, and recent synchronization.
7a. **Duplicate detection and review** - Normalized-name detection, review,
   dismissal, and duplicate warning.
7b. **Merge and delete** - Editable merge, conservative relation union, DLC
   reassignment, cascade-safe delete, temporary operation records, overlap
   protection, and reload-safe Undo.
7c. **Edit game and availability details** - Edit visible catalog fields while
   preserving immutable origin, Steam identity, and synchronized statistics.
8. **Catalog RAWG enrichment** - On-demand catalog matching and metadata,
   individual and global loading, import follow-up, overwrite warnings,
   attribution, asynchronous progress, retries, and partial failure handling.
   Its approved implementation slices are:
   - **8a. RAWG matching and metadata snapshot contract** - Server-side matching,
     normalized metadata persistence, attribution, and safe no-match behavior.
   - **8b. Single-game asynchronous enrichment** - Detail-page load action,
     overwrite warning, persistent job state, retries, and per-game progress.
   - **8c. Catalog-wide enrichment with progress and partial failure** - Library
     batch action and outcome reporting.
   - **8d. Post-import enrichment** - Queue every newly imported Steam game
     without rolling back or duplicating the import.
9. **DLC model and unresolved Steam queue** - Required base-game ownership,
   explicit deletion and cascade behavior, and a persistent manual-review queue.
10a. **Local wishlist, RAWG, and acquisition** - Independent wishes, optional
    provider identity, local intent, RAWG snapshots, manual acquisition, and
    metadata transfer.
10b. **Price enrichment and purchase opportunities** - Manual and daily Mexican
     Steam and ITAD refreshes, source preference, target prices, stale-data
     handling, and opportunity signals.
11. **Compatibility synthesis** - Asynchronous ProtonDB, Steam Deck Verified,
    anti-cheat, Windows fallback, personal overrides, retries, and progress.
12. **Recommendation engine** - Explicit explainable play-next and buy runs,
    deterministic ranking, warnings, DLC eligibility, dismissal, and calibration.
13. **Today dashboard** - Main and in-progress games, latest recommendations,
    recent Steam activity, offers, freshness, external links, and operation status.
14. **Global visual foundation** - Accessible light, dark, and system modes with
    reduced-data, reduced-motion, and fallback behavior.
15. **Wallhaven global background** - Optional cached SFW desktop background,
    reduced-data behavior, fallback, and attribution.
16. **Game-detail dynamic themes** - RAWG imagery and derived colors limited to
    detail pages with contrast safeguards and deterministic fallback.
17. **Settings and manual export** - Sessions, provider preferences, visual and
    accessibility settings, refresh controls, queue status, and personal-data
    JSON export.
18. **Deployment and CI readiness** - Vercel/Supabase review, queue and scheduler
    configuration, production smoke test, one Verify command, and automatic
    checks when configured.

## Data model

Personal intent, catalog state, and user choices are authoritative. Provider
data is replaceable and must not corrupt those records.

### Identity and settings

#### `User`, `Account`, `Session`

- Auth.js records for the single authorized Google user.
- `User` owns sessions and catalog operations.

#### `AppSettings`

- Singleton containing theme, fixed environments, Mexico and UTC-6 display,
  reduced-data behavior, provider refresh controls, Wallhaven controls, and
  global Steam/ITAD source preference.

#### `SteamConnection`

- Singleton containing `steamId64`, connection state, timestamps, and sync
  summary.

### Catalog, ownership, and metadata

#### `Game`

- Catalog-only record with `id`, `name`, `type` (`BASE_GAME` or `DLC`), origin,
  creation and update timestamps, and optional `baseGameId`.
- A DLC points to exactly one base game. Deleting a base game explicitly
  cascades to its DLC.
- Relates to external IDs, metadata snapshots, library state, availability,
  collections, tags, duplicates, compatibility, and recommendation items.

#### `ExternalGameId`

- External identity with namespace, identifier, and match provenance.
- Same-namespace conflicts block a merge or reassignment.
- A retained Steam App ID lets later sync update a manually acquired game.

#### `GameAvailability`

- Source and ownership availability, including Steam or another acquisition
  source, display name, Steam App ID, playtime, and last-played timestamp.

#### `LibraryEntry`

- Base-game personal state: play state, main-game flag, priority, interest,
  rating, notes, tags, preferred environment, play and replay flags, hidden
  state, and personal compatibility override.
- Only one base game may be the main game.

#### `MetadataSnapshot`

- Replaceable provider data for a catalog game, keyed by provider.
- RAWG payload includes main and alternate background images, genres, tags and
  gameplay styles, release date, description, playtimes, alternative names,
  developers, publishers, official website, RAWG updated date, local fetched
  date, ratings, Metacritic context, RAWG URL, and attribution.
- No metadata history is retained. Screenshots, videos, achievements, system
  requirements, franchises, series, and stores are deferred.

#### `PossibleDuplicate`

- Base-game pair, normalized-name evidence, confidence, and review state
  (`OPEN` or `DISMISSED`). Detection never merges automatically.

#### `CatalogOperation`

- Temporary merge or delete operation linked to the authenticated user.
- Stores state (`PENDING`, `UNDONE`, `EXPIRED`, or `COMPLETED`), affected game
  IDs, minimal reversible snapshot, timestamps, and roughly 15-second expiry.
- Operations may not overlap the same game. Permanent audit history is outside
  the MVP.

#### `EnrichmentJob`

- Planned persistent provider-work record for a catalog or wishlist entry.
- Stores provider stage, status, attempts, next attempt, progress or batch
  context, and safe failure detail.
- RAWG precedes compatibility. Transient failures retry at most three times with
  increasing delay, and final failures remain visible for manual retry.

#### `SyncRun`

- Provider operation timing, result, counts, and safe diagnostics for Steam and
  later provider batches.

### DLC, wishlist, and pricing

#### `UnresolvedSteamDlc`

- Persistent review record for an owned Steam DLC whose base game is absent.
- Stores source identity and temporary-discard state. A later unresolved sync
  returns it to pending.

#### `WishlistEntry`

- Independent, non-provisional wish with name, type (`BASE_GAME` or `DLC`), notes,
  local interest, optional provider and external identifiers, optional MXN target
  price, optional source preference, and an independent RAWG snapshot.
- It does not create a `Game` until manual acquisition.

#### `WishlistMetadataSnapshot`

- Replaceable RAWG data owned by a wishlist entry.
- Copies into a new catalog game on acquisition when present.

#### `PriceRefresh`

- Provider refresh status, timestamps, result, and freshness diagnostics for
  wishlist offers.

#### `DealOffer`

- Mexican offer data including source, store, current and regular price,
  currency, discount, historical low when available, DRM and platform data,
  external URL, expiry, and freshness.
- Stale offers remain visible but cannot produce a strong purchase recommendation.

### Compatibility, recommendations, and organization

#### `CompatibilitySnapshot`

- Sourced ProtonDB, Steam Deck Verified, and anti-cheat evidence with
  provenance and freshness.

#### `EnvironmentCompatibility`

- Synthesized Bazzite and Steam Deck status, implicit Windows fallback, mixed
  evidence, and a separate personal override that provider refreshes never replace.

#### `RecommendationRun` and `RecommendationItem`

- An explicitly requested run with timestamp and context.
- Ranked play-next or buy results with score factors and visible explanations.
- Unknown or stale compatibility is a warning, not a score penalty.

#### `RecommendationFeedback`

- Temporary per-run dismissal plus persistent per-type dismissal counters.
- Three cumulative dismissals reduce adjusted interest by one, never below zero.

#### `Collection`, `CollectionMembership`, `PersonalTag`, `GameTag`

- Manual and calculated collections plus reusable personal tags.

#### `WallpaperState`

- Cached SFW Wallhaven candidates, selection, freshness, render target, and
  attribution. It stores no image binaries.

### Load-bearing provider rules

- Manual entries and Steam imports save immediately. Provider work is asynchronous
  and persisted in PostgreSQL.
- RAWG failure never rolls back a Steam import or removes prior valid metadata.
- Manual Steam synchronization does not automatically start RAWG enrichment.
- Wishlist entries remain independent of catalog games until manual acquisition.
- A DLC cannot be created without resolving an existing or newly created base game.

## Tech stack

- **Next.js App Router, React, TypeScript, and pnpm** - application runtime and
  development tooling.
- **Tailwind CSS v4 and shadcn/ui** - accessible responsive interface.
- **Prisma and PostgreSQL/Supabase** - relational persistence and the durable
  enrichment queue.
- **Auth.js with Google** - single-account authentication enforced server-side.
- **Zod** - server-side input validation.
- **Vitest** - unit-test gate for logic-bearing changes.
- **Vercel** - intended application host.
- **Steam, RAWG, ITAD, Wallhaven, ProtonDB, Steam Deck Verified, and anti-cheat
  sources** - optional server-side enrichment boundaries.

## Monetization

Not in v1. The application is private and source-available under the PolyForm
Noncommercial License 1.0.0, with no ads, subscriptions, or analytics.

## UI/UX

- `/` - sign-in landing and Google access gate.
- `/today` - read-only dashboard for main and in-progress games, three current
  results of each recommendation type, Steam activity, offers, and background
  progress.
- `/library` - searchable catalog, filters, manual creation, duplicate review,
  and catalog-wide metadata action.
- `/wishlist` - independent wishes, RAWG metadata action, target-price and offer
  signals, acquisition, and DLC decisions.
- `/games/[id]` - personal fields, availability, metadata, attribution,
  compatibility, DLC, duplicate warning, recommendation explanation, and
  per-game RAWG loading.
- `/settings` - sessions, provider controls, preferences, visual and
  accessibility settings, Wallhaven controls, refresh and retry actions, queue
  progress, and JSON export.

The app is responsive. Desktop favors a constrained, dense multi-column
experience and may show a Wallhaven background. Mobile uses bottom navigation,
single-column cards, a filter sheet, 44px targets, and no wallpaper. Detail
artwork and global backgrounds must not override accessible contrast, theme
settings, reduced-data behavior, or reduced-motion safeguards.

## Deployment

- **Target:** Vercel with Supabase PostgreSQL.
- **Build:** `pnpm build`; use `pnpm start` for a production smoke test.
- **Database:** pooled runtime URL and direct migration URL; production runs
  `pnpm prisma:deploy` before start.
- **Environment:** `DIRECT_URL`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`,
  `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and
  `ALLOWED_GOOGLE_EMAIL`; future provider keys remain server-only.
- **Queue:** PostgreSQL-backed provider work processed in batches. Daily price
  refresh uses a deployment scheduler. Steam sync remains user-initiated.
- **Health:** app root smoke check.
- **Checks:** `pnpm lint`, `pnpm typecheck`, and `pnpm test`. A single Verify
  command and automatic checks are configured only in the final readiness feature
  when requested.

> TODO: Decide the exact Vercel/Supabase scheduler integration for daily price
> batches. Steam has no automatic schedule.

## Open questions

- Assign the project-plan requirement for RAWG match suggestions in manual catalog
  forms to a specific Feature 8 sub-feature. The approved split currently names
  server matching and detail/global actions but does not call out that form UI.
- Confirm the final RAWG API matching and attribution contract before implementing
  8a. Provider data must remain server-side and source links must be preserved.
- The project plan requires a persistent PostgreSQL enrichment queue, while the
  current Prisma schema still needs the concrete `EnrichmentJob` shape. Lock it
  during 8b before implementing retries or progress.
- Validate the final API contracts for ProtonDB, Steam Deck Verified, and
  anti-cheat before Feature 11. Until then, compatibility evidence stays unknown.
- Run `/feature` for the next unchecked build-plan leaf, currently `8a`. If the
  visual direction needs exploration first, `/prototype` can create throwaway
  static mockups without changing the main app code.

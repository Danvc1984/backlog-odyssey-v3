# Backlog Odyssey - Project Overview

> Private, single-user gaming-library assistant for deciding what to play and
> buy in Mexico across Bazzite, Steam Deck, and Windows.

## Problem and users

Gaming ownership, prices, compatibility evidence, metadata, and personal notes
are scattered across separate services. Backlog Odyssey consolidates them into
one explainable assistant without becoming a launcher or storefront.

The MVP serves one authorized Google account using a Bazzite desktop, Steam Deck,
and Windows fallback. Prices and display use Mexico and UTC-6. Public
registration, roles, collaboration, multi-user behavior, notifications,
webhooks, offline/PWA behavior, automatic purchasing, and automatic Steam sync
are outside the MVP.

## Build order

The checked state and exact ordering come from `blueprint/build-plan.md`.

1. **App shell and auth gate** - Next.js shell and single-user Google access.
2. **Manual catalog and library base** - Manual games and library filters.
3. **Game detail** - Metadata, availability, and personal fields.
4. **Play states and main game** - State rules, flags, and main-game constraint.
5. **Collections** - Manual and calculated collections.
6. **Steam connection and sync** - Account linking, owned-game import, playtime,
   and recent synchronization.
7a. **Duplicate detection and review** - Normalized-name evidence, review,
   dismissal, and warnings.
7b. **Merge and delete** - Conservative editable merge, DLC reassignment,
   cascade-safe delete, temporary operation records, and reload-safe Undo.
7c. **Edit game and availability details** - Editable visible fields while
   preserving origin, Steam identity, and synchronized statistics.
8a. **RAWG matching and metadata snapshot contract** - Server matching,
   normalized snapshots, attribution, and safe no-match behavior.
8b. **Single-game asynchronous enrichment** - Detail loading, overwrite warning,
   persistent state, retries, and progress.
8c. **Catalog-wide enrichment** - Batch enqueue, progress, and partial failure.
8d. **Post-import enrichment** - Queue each newly imported Steam game safely.
8e. **RAWG payload maturity and series evidence** - ESRB rating and the RAWG
game-series list captured into a version 2 metadata payload with
backward-compatible parsing; backfill through the existing catalog-wide
enrichment action; shown in the shared RAWG metadata section on game and
wishlist detail.
9. **DLC model and unresolved Steam queue** - Required base-game ownership,
   explicit deletion/cascade behavior, and manual review queue.
10a. **Local wishlist, RAWG, and acquisition** - Independent wishes, owned-base
   DLC wishes, RAWG snapshots, and manual acquisition into the catalog.
10b-a. **Price identity and provenance** - Confirmed Steam identity from import
   or a manual URL/AppID, plus a suggested identity resolved through Steam
   `storesearch`, with source provenance and an identity-required state.
10b-b. **ITAD prices and refresh queue** - Cached Steam-to-ITAD lookup, batched
   Mexican price calls, one overlap-safe global refresh queue, retry/freshness
   diagnostics, and clear partial results.
10b-c. **Offer display and opportunity badges** - Selected cheapest offer,
   expandable alternatives, real returned-currency display, MX activation
   warnings, historical-low context, inline MXN targets, stale rules, and
   opportunity badges without starting recommendation runs.
10c. **Steam wishlist import and enrichment** - Manual idempotent import,
   conservative 7a-matcher review where linking is never automatic, new-base
   RAWG follow-up, one shared source-discriminated unresolved-DLC queue,
   header sync chip, and persistent result summary.
11. **Compatibility synthesis** - Bazzite-first ProtonDB and separately shown
   AWAY anti-cheat evidence, derived Windows fallback, manual Steam AppID
   entry, ROM-only exemption as not applicable, Bazzite-only overrides,
   180-day freshness, retries, and progress.
11a. **Compatibility evidence and display** - Bazzite evidence, ProtonDB tier
   and game link, AWAY game link, Bazzite-only override controls, derived
   Windows fallback, and per-game refresh.
11b. **Compatibility batch queue and auto-queue** - Post-RAWG queueing,
   global sweep, progress, and overlap protection.
11c. **Wishlist detail** - Dedicated wishlist detail composition, including
   read-only compatible evidence and fill-only RAWG enrichment.
11c-a. **Wishlist compatibility foundation** - Parallel wishlist evidence
   storage, provider/synthesis reuse, and quiet per-entry refresh for eligible
   base-game wishes, without catalog-state reuse, overrides, auto-queue, or a
   sweep.
11c-b. **Wishlist detail page** - `/wishlist/[id]` navigation and composition
   of existing wish data, RAWG metadata, identity, offers, notes, interest,
   and existing edit/acquire/delete controls.
11c-c. **Wishlist detail compatibility and enrichment controls** - Read-only
   compatibility block, eligibility states, detail refresh, and fill-only RAWG
   enrichment that does not overwrite an existing snapshot.
11d. **Wishlist compatibility sweep** - Parallel wishlist evidence storage
   keyed by `wishlistEntryId` (`WishlistCompatibilitySnapshot`,
   `WishlistEnvironmentCompatibility`), separate from the catalog pipeline;
   auto-trigger on any confirmed Steam identity and a quiet async manual
   sweep for existing confirmed-identity wishes backed by a PriceRefresh-style
   run record with overlap protection and a completion toast; base-game wishes
   only, DLC wishes skipped; inline fail-silent refreshes and a simple
   "compatibility details not found" note on the detail page; single 180-day
   freshness window.
12. **Recommendation engine** - Explicit explainable play and buy runs with a
   deterministic baseline, then private adaptive diversification from provider
   metadata, personal history, and editable preferences.
12a. **Recommendation runs and play-next engine** - Completed dual-reference
   item storage, deterministic play-next scoring, explanations, manual runs,
   in-run dismissal, and rolling run retention.
12b. **Buy recommendations** - Wishlist eligibility, fresh-offer quality,
   targets, DLC affinity, pricing caveats, and Buy display.
12c. **Adaptive recommendation orchestration** - Taste setup, Game experience,
   contextual tune/preset controls, event/profile/preference storage, cold
   start, re-ranking, diversified role batches, `Show another`, and deal
   saturation.
12d. **Calibration from dismissal counters** - Adjusted interest from per-target
   dismissals and detail-page explanations.
13. **Today dashboard** - Post-login landing composing main/in-progress games,
   latest recommendations, Steam activity, offers sorted by discount,
   freshness, links, and operation status.
14. **Global visual foundation and full-app UI review** - Prototype-validated
   dark-first theme with dual-accent semantic tokens, accessible contrast,
   responsive navigation, polish, reduced-data/motion, and fallbacks.
15. **Wallhaven global background** - Cached SFW keyword pool (~10 candidates),
   deterministic daily rotation with shuffle, reduced-data hard-off,
   staleness-triggered queued refresh, attribution, and fallback.
16. **Game-detail dynamic themes** - Server-side dominant-color derivation
   during RAWG enrichment, applied read-only to detail pages with contrast
   safeguards and deterministic fallback.
17. **Settings and manual export** - Sessions, wishlist import diagnostics,
   visual/accessibility settings, refresh controls including the global
   compatibility sweep, queue status, and personal-data JSON export.
18. **Deployment and CI readiness** - Vercel/Supabase review, Vercel Cron daily
   price refresh at 06:00 UTC-6 with `CRON_SECRET`, queue protection,
   production smoke test, Verify command, and automatic checks when configured.

## Authoritative data boundaries

Personal intent, catalog state, ownership, and explicit user choices are
authoritative. Provider data is replaceable and never silently overwrites those
records. Provider work is asynchronous, persisted in PostgreSQL, rate-limited,
and retries transient failures at most three times with increasing delay.

## Data model

The concrete schema lives in `prisma/schema.prisma`. The models below reflect
the current schema plus planned additions from upcoming features. Fields marked
`(planned)` do not yet exist in the schema and will be added during their
feature's implementation.

### Identity and operations

- `User`, `Account`, `Session` - Auth.js records for the one permitted Google
  account; the user owns catalog and provider operations.
- `AppSettings` - singleton: `theme` (enum `LIGHT`/`DARK`/`SYSTEM`),
  `desktopOs`, `portableDevice`, `fallbackOs`, `priceCountry` (default `MX`),
  `timeZone` (default `America/Mexico_City`), `wallpaperEnabled`,
  `reducedData`, `steamDailySyncEnabled`, `itadDailyRefresh`.
- `SteamConnection` - singleton: `steamId64` (unique), `state`, `lastSyncAt`,
  `counts` (JSON).
- `SyncRun` - provider-operation timing: `provider` (enum), `status` (enum
  `RUNNING`/`SUCCESS`/`FAILED`/`PARTIAL`), `startedAt`, `finishedAt`, `counts`,
  `diagnostics`.
- `EnrichmentJob` - provider stage/status, attempts, retry time, progress/batch
  context, and safe failure detail. Links to `Game` and optionally `SyncRun`.
  Status enum: `QUEUED`/`RUNNING`/`RETRY_WAIT`/`AWAITING_MATCH`/`SUCCEEDED`/
  `FAILED`. Stage enum: `MATCHING`/`PERSISTING`/`RETRYING`/`COMPLETE`/`FAILED`.
  Unique on `[gameId, provider]`.

### Catalog

- `Game` - `id`, `name`, `type` (`BASE_GAME`/`DLC`), `origin`
  (`STEAM_IMPORT`/`MANUAL`), `baseGameId` (self-relation, cascade delete),
  timestamps. Indexes on `baseGameId`, `origin`, `type`.
- `ExternalGameId` - `namespaceId`, `namespace`, `externalId`, `matchMethod`
  (`EXACT_STEAM_APP_ID`/`MANUAL_RAWG_SEARCH`/`MANUAL_ITAD_LOOKUP`/`INFERRED`),
  `gameId`. Unique on `[namespace, externalId]`.
- `GameAvailability` - `gameId`, `source` (`STEAM`/`OTHER_PLATFORM`/`ROM`),
  `displayName`, `steamAppId`, `steamPlaytimeTotal`, `steamLastPlayed`.
- `LibraryEntry` - `gameId` (unique), `playState` (`NOT_STARTED`/`IN_PROGRESS`/
  `PLAYED_BEFORE`/`ABANDONED`), `isMainGame`, `priority`
  (`NONE`/`LOW`/`MEDIUM`/`HIGH`), `interest`, `rating`, `preferredEnvironment`
  (`BAZZITE`/`STEAM_DECK`/`WINDOWS`), `compatOverrideStatus`,
  `compatOverrideReason`, `playSoon`, `replayCandidate`, `hidden`, `notes`, and
  `gameExperience` `(planned, 12c)` (`PC_GAMING`/`MULTIPLAYER_COOP`/
  `COUCH_GAMING`/`ON_THE_GO`, nullable).
- `MetadataSnapshot` - `gameId`, `provider` (enum), `payload` (JSON),
  `sourceUrl`, `fetchedAt`, `expiresAt`. Indexed on `[gameId, provider]`.
- `PossibleDuplicate` - `gameAId`, `gameBId`, `evidence` (JSON), `confidence`,
  `status` (`OPEN`/`DISMISSED`), `reviewedAt`. Unique on `[gameAId, gameBId]`.
- `CatalogOperation` - `userId`, `type` (`MERGE`/`DELETE`), `state`
  (`PENDING`/`UNDONE`/`EXPIRED`/`COMPLETED`), `affectedGameIds` (string array),
  `snapshot` (JSON), `expiresAt`. Indexed on `[userId, state]` and `expiresAt`.

### DLC and wishlist

- `UnresolvedSteamDlc` - `steamAppId` (unique), `name`, `steamBaseAppId`,
  `source` (`OWNED_SYNC`/`WISHLIST_IMPORT`), `status` (`PENDING`/`DISCARDED`),
  `discardedAt`. One shared queue for library sync and wishlist import,
  discriminated by `source`. Indexed on `status`.
- `WishlistImportReview` - `steamAppId` (unique), `name`, `candidates` (JSON),
  `status` (`OPEN`/`LINKED`/`IGNORED`), `reviewedAt`.
- `WishlistImportIgnore` - `steamAppId` (unique), `name`, `createdAt`.
- `WishlistEntry` - `name`, `type` (`BASE_GAME`/`DLC`), `baseGameId` (cascade
  delete to base game), `interest`, `targetPriceMxn` (decimal 10,2), `notes`,
  `steamAppId`, `steamAppIdProvenance` (`STEAM_IMPORT`/`USER`/`RAWG_SUGGESTION`),
  and nullable `gameExperience` `(planned, 12c)`.
- `WishlistMetadataSnapshot` - `wishlistEntryId` (unique), `provider` (default
  `RAWG`), `payload` (JSON), `sourceUrl`, `fetchedAt`, `expiresAt`.
- `DealOffer` - `wishlistEntryId`, `shop`, `country`, `currency`, `price`,
  `regularPrice`, `discount`, `historicalLow`, `voucher`, `itadFlag`, `drm`,
  `platforms` (JSON), `url`, `expiresAt`, `fetchedAt`.
- `ItadIdentity` - `steamAppId` (PK), `itadId`, `fetchedAt`. Cached
  Steam-App-ID-to-ITAD-ID mapping.
- `PriceRefresh` - `wishlistEntryId` (optional, cascade), `status`
  (`RUNNING`/`SUCCESS`/`FAILED`/`PARTIAL`), `country`, `requestedAt`,
  `finishedAt`, `counts` (JSON). Indexed on `[status, requestedAt]`.

### Compatibility and recommendations

- `CompatibilitySnapshot` - `gameId`, `provider` (enum), `result` (JSON),
  `sourceUrl`, `fetchedAt`, `expiresAt`. Unique on `[gameId, provider]`.
- `EnvironmentCompatibility` - `gameId`, `environment` (enum), `status`
  (`READY`/`READY_WITH_TINKERING`/`FALLBACK_RECOMMENDED`/`REQUIRED`/`UNKNOWN`),
  `source`, `updatedAt`. Unique on `[gameId, environment]`.
- `WishlistCompatibilitySnapshot` `(planned, 11c-a/11d)` - `wishlistEntryId`,
  `provider` (`PROTONDB`/`ARE_WE_ANTICHEAT_YET`), `result` (JSON), `sourceUrl`,
  `fetchedAt`, `expiresAt`. Unique on `[wishlistEntryId, provider]`. Parallel to
  the catalog snapshot; never shared with `CompatibilitySnapshot`.
- `WishlistEnvironmentCompatibility` `(planned, 11c-a/11d)` - `wishlistEntryId`,
  `environment` (`BAZZITE`/`WINDOWS`), `status`, `source`, `updatedAt`. Unique
  on `[wishlistEntryId, environment]`.
- `WishlistCompatSweep` `(planned, 11d)` - manual sweep run record modeled on
  `PriceRefresh`: single RUNNING row for overlap protection, `status`,
  `requestedAt`, `finishedAt`, `counts` (JSON).
- `RecommendationRun` - `kind` (`PLAY_NEXT`/`BUY`), `context` (JSON),
  `createdAt`. Indexed on `[kind, createdAt]`; 12c extends `context` to retain
  optional tuning and qualified candidate batches.
- `RecommendationItem` - `runId`, nullable `gameId` or nullable
  `wishlistEntryId` (exactly one target enforced in code), `rank`, `score`,
  `positive`, `negative`, `caveats` (JSON factor payloads).
- `RecommendationFeedback` - nullable `gameId` or nullable `wishlistEntryId`,
  `kind` (`PLAY_NEXT`/`BUY`), `createdAt`; one row per dismissal and indexed by
  target plus kind.
- `RecommendationEvent` `(planned, 12c)` - append-only recommendation-owned
  interaction log for exposure, rotation, taste-setup answers, starts,
  completion, abandonment, dismissal, and optional reason; time-bounded by
  event kind.
- `RecommendationProfile` `(planned, 12c)` - rebuildable private aggregate of
  learned signals, profile version, and rebuild freshness.
- `RecommendationPreference` `(planned, 12c)` - explicit `PREFER`/`NEUTRAL`/
  `AVOID` override for a genre, tag, experience, duration band, publisher, era,
  series, environment, or maturity dimension.
- `RecommendationPreset` `(planned, 12c)` - named optional Tune-this-run
  context. A recommender reset removes all recommendation-owned records but
  preserves the catalog and provider snapshots.

### Organization and theme

- `PersonalTag` - `name` (unique).
- `GameTag` - composite `[gameId, tagId]`.
- `Collection` - `name` (unique), `color`, `icon`, `isSystem`.
- `CollectionMembership` - composite `[collectionId, gameId]`.
- `WallpaperState` - singleton: `candidates` (JSON, ~10 SFW URLs),
  `selectedIdx`, `renderTarget` (JSON), `cachedAt`.

## Wishlist and provider rules

- Wishlist entries remain independent of catalog games until manual acquisition.
- Price identity has three provenance-tracked paths: Steam import (confirmed),
  manual Steam URL/AppID paste (user-confirmed, also the override path), and a
  derived suggestion (unconfirmed until one click). The catalog RAWG snapshot
  contract stays unchanged; only the wishlist snapshot extends.
- ITAD maps from a cached Steam-App-ID-to-ITAD-ID lookup (`ItadIdentity`), then
  loads prices in batched `country=MX` calls (up to 200 games per request).
  Keyshop-flag mechanics validate during the 10b spec. Accepted caveat: the ITAD
  ToS asks private API users to make contact; registration runs through their
  app-setup page.
- The Wishlist has one global `Update prices` action. It queues entries with
  confirmed store identity and reports refreshed, failed, and identity-required
  entries. Individual price refresh is initially out of scope.
- Steam and ITAD have no source preference. The cheapest valid Mexican offer is
  selected while all valid alternatives remain visible.
- Every valid offer is shown with or without a target. A fresh offer at or below
  `targetPriceMxn` creates an opportunity badge on the entry. Historical lows
  are display-only and never strengthen signals. An offer older than 48 hours
  is stale: visible, but unable to create a strong signal or offer-quality
  points.
- Price refresh never starts or replaces a recommendation run. The seller page
  remains authoritative for regional activation. ITAD is optional, server-side,
  read-only, uses `country=MX`, caching, and `429`/`Retry-After` handling.
- Steam wishlist import is manual and visible from Wishlist. A new base game with
  a reliable, unknown Steam App ID is created with interest `2/5` and empty notes,
  then queued for wishlist RAWG enrichment.
- Local matching reuses the 7a normalized-name matcher; any candidate, exact
  names included, goes to persistent review. Linking is never automatic; it
  stores the Steam App ID with provenance onto the local entry so later imports
  skip silently. Ignored review entries stay suppressed until restored.
- A wishlist item already in the owned catalog is omitted silently. Steam title
  changes/removals never rename or delete local wishes; provider status appears
  only as a non-authoritative Wishlist-header chip backed by a stored last-run
  summary. Import is idempotent by Steam App ID and ends in a persistent result
  panel (created, linked, queued reviews, ignored, enrichment).
- RAWG metadata payload version 2 adds `esrbRating` and a `seriesGames` list
  fetched from the RAWG game-series endpoint. Parsing stays backward-compatible
  with version 1 snapshots, and version 1 rows upgrade the next time their game
  is enriched. Series evidence enables a "confident sequel" derivation (same
  series, strictly later release date) for the recommender's reserved SERIES
  dimension; ESRB enables the MATURITY dimension.
- Manual entries and Steam imports save first; provider failures never roll back
  local data or remove the last valid provider snapshot.
- `11c-b` adds the wishlist detail page (`/wishlist/[id]`) with full RAWG
  metadata, Steam identity and provenance, the offer block, notes and interest,
  and existing edit/acquire/delete actions. `11c-c` adds the read-only
  compatibility block, detail refresh, and fill-only RAWG enrichment that is
  hidden once a snapshot exists. Batch progress and error details stay out of
  the wishlist.

## Compatibility rules

- Evidence keys off a Steam App ID. Bazzite is primary (ProtonDB tier plus a
  per-game ProtonDB link); AWAY anti-cheat evidence shows separately; Windows is
  derived from effective Bazzite evidence plus anti-cheat status. Personal
  overrides apply to Bazzite only, take priority, are never overwritten, and
  affect the derived Windows fallback.
- Catalog games without a Steam App ID get a manual "add Steam App ID"
  affordance on the detail page, writing into `ExternalGameId`; evidence queues
  automatically once present. ROM-only games are fully exempt and read as
  **not applicable**, never unknown; mixed availability still gets evidence.
- Freshness uses one **180-day window** for all evidence types. Stale evidence
  keeps its values, shows its age, and produces a visible recommendation
  warning - never a penalty.
- Wishlist evidence (11c/11d) is read-only and lives in parallel storage keyed
  by `wishlistEntryId`, never shared with the catalog: a bought game leaves the
  wishlist, so reuse buys nothing. It applies to base-game wishes with a
  confirmed Steam App ID (`steamAppId` and `steamAppIdProvenance` both set);
  DLC wishes are skipped because their Linux compatibility is carried by the
  owned base game. Wishlist evidence has **no personal override**, but does
  derive the Windows fallback.
- Wishlist compatibility runs through its own jobs, separate from `EnrichmentJob`.
  Any confirmed identity - Steam import, manual paste, or RAWG
  suggest-and-confirm - auto-queues evidence silently as an inline call that
  catches and hides provider errors. A quiet async manual sweep covers existing
  confirmed-identity wishes: it confirms "sweep started", shows a completion
  toast, and persists a PriceRefresh-style run record with overlap protection.
  Per-entry refresh on the detail page is inline and equally quiet. Absent
  evidence shows a simple "compatibility details not found" note.

## Recommendations semantics

- `play-next` eligibility: base games, not hidden, not the main game, state
  `NOT_STARTED` or replay-flagged `PLAYED_BEFORE`/`ABANDONED`. `IN_PROGRESS`
  appears separately on the dashboard; DLC never enters play-next.
- `buy` eligibility: wishlist base games and DLC wishes with an owned base game.
  Unpriced entries stay eligible on interest alone with an explicit "no pricing
  yet" warning. ROMs are excluded from purchase recommendations.
- Interest (`0-5`) is durable personal desire and the core taste signal for play
  and buy. Catalog-only Priority is short-term play-next urgency, not a liking
  score. Visible field help appears in detail, quick-create, and bulk-edit UI.
- Compatibility is a small practical-fit factor for the intended environment,
  not a hard gate. Caveats remain visible; sparse, stale, or uncertain provider
  data lowers confidence rather than declaring a game unplayable.
- Metadata and activity evidence may include RAWG genres/tags, estimated
  playtime, release era, publisher, confident sequel relationship, ESRB when
  supplied, Metacritic and community-rating confidence, plus Steam playtime and
  recency. Manual played history is the fallback before Steam activity exists.
- Provider data is soft evidence. Manual fields remain authoritative; no
  alphabetical tiebreak decides a displayed recommendation.
- `Update recommendations` runs immediately. Optional `Tune this run` applies
  soft preferences for experience, length, genres/tags, sequel posture, era,
  and mature/casual context; presets reuse that context. Relaxed constraints are
  explained when the qualified pool is thin.
- Play output has two best-fit roles, one qualified out-of-the-box role, and one
  change-of-pace role. Buy output normally has two best-fit roles and one deal
  role; when three or more fresh 80%+ offers comprise at least 20% of eligible
  wishes, it instead has one best-fit and two deal roles. Deal roles always meet
  fit and quality floors.
- Runs persist context and qualified batches. `Show another` rotates within a
  role without starting a run; exposure yields only a short cooldown, never a
  negative signal. Starting a catalog recommendation sets `IN_PROGRESS` and
  makes it main only when no game is in progress; otherwise the UI asks.
- Cold-start mode diversifies imported metadata and labels its limited basis.
  Optional taste setup shows five or six swappable owned games: played marks
  `PLAYED_BEFORE`; like sets Interest `5/5` unless a personal value exists.
- A visible profile exposes semantic Prefer/Neutral/Avoid controls and full
  recommender reset. Exposures expire after 90 days; runs, starts, dismissals,
  and reasons after 12 months; played, completed, abandoned, and taste-setup
  events after 24 months. Derived signals decay and rebuild from retained events.

## UI and routes

- `/` - sign-in landing and Google access gate.
- `/today` - post-login front door with main/in-progress games, adaptive
  play-next and buy roles, Tune-this-run presets, `Show another`, Steam
  activity, offers, freshness, and operation progress.
- `/library` - searchable catalog, filters, manual creation, duplicate review, and
  catalog-wide metadata action.
- `/wishlist` - independent wishes, RAWG action, identity suggestions, global
  price refresh, alternatives, opportunity badges, Steam wishlist import, review
  queues, and acquisition.
- `/wishlist/[id]` - wishlist detail delivered across 11c-b and 11c-c: full
  RAWG metadata, identity and provenance, offers and target price, notes,
  interest, edit/acquire/delete, a read-only compatibility block, compatibility
  refresh, and fill-only RAWG enrichment.
- `/games/[id]` - personal fields and help, Game experience, availability,
  metadata, attribution, compatibility (with manual Steam AppID entry), DLC,
  duplicate warning, recommendation explanation, and RAWG loading.
- `/settings` - sessions, provider controls, recommendation profile/preferences
  and reset, visual/accessibility settings, Wallhaven, queue status,
  wishlist-import diagnostics, and JSON export.

The app is responsive. Desktop uses a dense constrained layout with an icon
sidebar; mobile uses bottom navigation, single-column cards, filter sheets,
44px targets, and no wallpaper.

Visual direction is **dark-first**, derived from `blueprint/reference/`:
deep charcoal and navy surfaces, dual-accent semantic tokens (cyan/teal for
interactive elements and ready states, magenta/pink for opportunity signals
and deals, amber for warnings, stale evidence, and mixed compatibility),
rounded cards, pill buttons, badge chips, and bold display typography for
headers. `/prototype` runs before feature 14 to lock the look. Artwork and
backgrounds must preserve contrast, theme settings, reduced-data behavior,
and reduced-motion safeguards.

## Tech and deployment

- Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
  Prisma, PostgreSQL/Supabase, Auth.js/Google, Zod, Vitest, and Vercel.
- Runtime uses pooled `DATABASE_URL`; migrations use direct `DIRECT_URL`.
- Required environment includes `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`,
  Google credentials, and `ALLOWED_GOOGLE_EMAIL`; provider keys remain
  server-only.
- Commands are `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, and
  `pnpm test`. A single Verify command and automatic checks are deferred to 18.
- Price refreshes are manual until deployment. Feature 18 configures Vercel Cron
  with `CRON_SECRET` to enqueue the daily persistent queue at **06:00 UTC-6**.
  Claims are atomic, scheduled runs are idempotent, overlapping work is
  prevented, and retry history remains visible.
- Production readiness includes `pnpm prisma:deploy`, a production smoke check,
  queue/scheduler review, and environment validation.

## Monetization and exclusions

There is no monetization in v1: the private app is source-available under the
PolyForm Noncommercial License 1.0.0 with no ads, subscriptions, or analytics.
Future possibilities include encrypted backups, richer providers, managed
workflow services, notifications, multi-user support, and offline/PWA behavior.

## Open questions and plan gaps

- `project-plan.md` §10 says a global compatibility sweep "waits for Settings'
  provider controls (feature 17)", but `build-plan.md` 11b is complete and
  already ships the global compatibility sweep from settings. Reconcile that
  source-plan wording before a later plan edit.
- `project-plan.md` describes RAWG store-link suggestions, while
  `build-plan.md` records that live RAWG store URLs were empty and the current
  suggestion resolves through Steam `storesearch`. Reconcile that source-plan
  wording before a later plan edit.
- `project-plan.md` phases dismissal events out after 12 months, while
  `build-plan.md` 12d still says calibration counters are never pruned. Decide
  whether calibration derives only from retained events or stores a separate
  durable aggregate before 12d is specified.
- The wishlist compat sweep (11d) may be added to Settings' manual provider
  controls in feature 17, alongside the catalog global sweep.
- Exact Vercel/Supabase production scheduler configuration remains a deployment
  concern for feature 18; the product decision is fixed (Vercel Cron with
  `CRON_SECRET` at 06:00 UTC-6).
- Wallhaven anonymous SFW rate limits and keyword-set defaults confirm during
  the feature 15 spec.

Run `/feature` for the next unchecked item, currently `12b`. Run `/prototype`
before feature 14 to lock the visual look against `blueprint/reference/`.

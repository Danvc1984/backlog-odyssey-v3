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
9. **DLC model and unresolved Steam queue** - Required base-game ownership,
   explicit deletion/cascade behavior, and manual review queue.
10a. **Local wishlist, RAWG, and acquisition** - Independent wishes, owned-base
   DLC wishes, RAWG snapshots, and manual acquisition into the catalog.
10b. **Price enrichment and purchase opportunities** - Provenance-tracked
   identity (Steam import auto-confirm, manual URL/AppID paste, RAWG-derived
   suggest-and-confirm), ITAD via cached AppID lookup and batched `country=MX`
   calls, cheapest 8-10 offers kept with alternatives, MX activation warnings,
   display-only historical lows, inline MXN targets, 48-hour freshness,
   bounded retries, and opportunity badges; Vercel Cron deferred to 18.
10c. **Steam wishlist import and enrichment** - Manual idempotent import,
   conservative 7a-matcher review where linking is never automatic, new-base
   RAWG follow-up, one shared source-discriminated unresolved-DLC queue,
   header sync chip, and persistent result summary.
11. **Compatibility synthesis** - ProtonDB primary, Deck Verified fallback, AWAY
   anti-cheat dataset, manual Steam AppID entry, ROM-only exemption as not
   applicable, Windows fallback, overrides, 180-day freshness, retries, and
   progress.
12. **Recommendation engine** - Explicit explainable play-next and buy runs,
   eligibility rules, compatibility as warning-only context that never moves
   rank, fresh-discount offer quality, boost-only DLC affinity, dismissal,
   calibration with exempt counters, and rolling 12-month run retention.
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

### Identity and operations

- `User`, `Account`, `Session`: Auth.js records for the one permitted Google
  account; the user owns catalog and provider operations.
- `AppSettings`: singleton for theme, fixed environments, Mexico/UTC-6 display,
  reduced-data behavior, provider controls, and Wallhaven controls.
- `SteamConnection`: singleton with `steamId64`, connection state, timestamps,
  and sync summary.
- `SyncRun`: provider-operation timing, result, counts, and safe diagnostics.
- `EnrichmentJob`: provider stage/status, attempts, retry time, progress/batch
  context, and safe failure detail for catalog or wishlist work. RAWG precedes
  compatibility.

### Catalog

- `Game`: catalog-only `id`, `name`, `type` (`BASE_GAME` or `DLC`), origin,
  timestamps, and optional `baseGameId`. A DLC points to exactly one base game;
  deleting a base game explicitly cascades to its DLC.
- `ExternalGameId`: namespace, identifier, and match provenance. Same-namespace
  conflicts block merge/reassignment. A retained Steam App ID lets later sync
  update a manually acquired game; a user-entered Steam App ID unlocks
  compatibility evidence for manual-only games.
- `GameAvailability`: source (`STEAM`, `OTHER_PLATFORM`, `ROM`), ownership,
  display name, Steam App ID, playtime, and last-played timestamp. ROM-only
  games are exempt from the compatibility pipeline.
- `LibraryEntry`: play state, main-game flag, priority, interest, rating, notes,
  tags, preferred environment, play/replay flags, hidden state, and personal
  compatibility override. Only one base game is main.
- `MetadataSnapshot`: replaceable provider snapshot keyed by provider, including
  the approved RAWG metadata and attribution. No metadata history is retained.
- `PossibleDuplicate`: base-game pair, normalized-name evidence, confidence, and
  `OPEN`/`DISMISSED` review state; detection never merges automatically.
- `CatalogOperation`: temporary authenticated merge/delete operation with state,
  affected IDs, minimal reversible snapshot, timestamps, roughly 15-second
  expiry, and overlap protection.

### DLC and wishlist

- `UnresolvedSteamDlc`: one persistent review record shared by library sync and
  wishlist import, discriminated by source (`owned-sync` / `wishlist-import`).
  It stores Steam identity and temporary-discard state; each source keeps its
  own reappear rules. A wishlist-side entry resolves naturally once its base
  game is acquired and a later import runs.
- `WishlistEntry`: independent wish with name, type (`BASE_GAME` or `DLC`),
  local notes and interest, optional external/provider identity with
  provenance (`steam-import`, `user`, or confirmed RAWG suggestion; RAWG
  derivations stay unconfirmed until one-click confirmation), optional MXN
  target, and RAWG snapshot for base games. A DLC wish must reference one
  existing catalog base game and does not create a catalog game until manual
  acquisition.
- `WishlistMetadataSnapshot`: replaceable RAWG data owned by a wishlist entry,
  extended to capture Steam store links for identity suggestions; it can
  transfer to a newly acquired catalog game.
- `PriceRefresh`: persistent provider refresh status, timestamps, result, retry,
  and freshness diagnostics for wishlist offers.
- `DealOffer`: Mexican offer with source, store, current/regular price, currency,
  discount, display-only historical low, DRM/platform data, URL, expiry, and
  freshness. The cheapest 8-10 valid offers persist per entry; the cheapest is
  selected and all alternatives stay visible. Keyshop offers carry an MX
  activation warning.

### Compatibility and recommendations

- `CompatibilitySnapshot`: sourced ProtonDB, Steam Deck Verified, and
  AreWeAntiCheatYet evidence with provenance and freshness. All evidence keys
  off a Steam App ID; a single 180-day window governs staleness.
- `EnvironmentCompatibility`: synthesized Bazzite/Steam Deck status, implicit
  Windows fallback, mixed evidence with attribution, and a separate personal
  override that provider refreshes never replace. ROM-only games read as not
  applicable rather than unknown.
- `RecommendationRun` and `RecommendationItem`: explicit run timestamp/context,
  ranked play-next or buy results, score factors, and visible explanations.
  Runs roll over 12 months; creating a run prunes older ones.
- `RecommendationFeedback`: temporary per-run dismissal and persistent per-type
  dismissal counters; three cumulative dismissals lower adjusted interest by one,
  never below zero. Counters are cumulative personal state and are never pruned.
- `Collection`, `CollectionMembership`, `PersonalTag`, `GameTag`: manual and
  calculated organization records.
- `WallpaperState`: cached SFW candidate URLs (~10 from a configurable keyword
  set), deterministic daily selection, freshness, render target, and
  attribution; no image binaries.

## Wishlist and provider rules

- Wishlist entries remain independent of catalog games until manual acquisition.
- Price identity has three provenance-tracked paths: Steam import (confirmed),
  manual Steam URL/AppID paste (user-confirmed, also the override path), and
  RAWG store-link suggestions (unconfirmed until one click). The catalog RAWG
  snapshot contract stays unchanged; only the wishlist snapshot extends.
- ITAD maps from a cached Steam-App-ID-to-ITAD-ID lookup, then loads prices in
  batched `country=MX` calls (up to 200 games per request). Keyshop-flag
  mechanics validate during the 10b spec. Accepted caveat: the ITAD ToS asks
  private API users to make contact; registration runs through their app-setup
  page.
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
- Manual entries and Steam imports save first; provider failures never roll back
  local data or remove the last valid provider snapshot.

## Recommendations semantics

- `play-next` eligibility: base games, not hidden, not the main game, state
  `NOT_STARTED` or replay-flagged `PLAYED_BEFORE`/`ABANDONED`. `IN_PROGRESS`
  appears separately on the dashboard; DLC never enters play-next.
- `buy` eligibility: wishlist base games and DLC wishes with an owned base game.
  Unpriced entries stay eligible on interest alone with an explicit "no pricing
  yet" warning. ROMs are excluded from purchase recommendations.
- Compatibility never changes ranking in any state; it surfaces only as visible
  warnings and explanation context, including unknown and stale evidence.
- Buy offer quality: fresh-offer discount percentage earns points; proximity to
  the historical low breaks ties; stale offers contribute nothing.
- DLC base-game affinity is boost-only (owned base rated >=4/5, completed, or
  replay-flagged), named explicitly in the explanation; it never lowers a score.
- Manual signals dominate: interest, priority, play state, flags, then
  calibration. One `Update recommendations` action (Today header/empty state,
  also Library and Wishlist headers) creates a run with both lists.

## UI and routes

- `/`: sign-in landing and Google access gate.
- `/today`: read-only dashboard and post-login front door with main/in-progress
  games, latest play-next and buy results, Steam activity, offers, freshness,
  and operation progress.
- `/library`: searchable catalog, filters, manual creation, duplicate review, and
  catalog-wide metadata action.
- `/wishlist`: independent wishes, RAWG action, identity suggestions, global
  price refresh, alternatives, opportunity badges, Steam wishlist import, review
  queues, and acquisition.
- `/games/[id]`: personal fields, availability, metadata, attribution,
  compatibility (with manual Steam AppID entry), DLC, duplicate warning,
  recommendation explanation, and RAWG loading.
- `/settings`: sessions, provider controls, visual/accessibility settings,
  Wallhaven, queue status, wishlist-import diagnostics, and JSON export.

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

- Provider contracts validate during their feature specs: ITAD keyshop-flag
  mechanics and lookup behavior before 10b; ProtonDB summary-endpoint
  stability, Deck Verified categories inside Steam `appdetails`, and
  AreWeAntiCheatYet dataset shape before 11.
- Exact Vercel/Supabase production scheduler configuration remains a deployment
  concern for feature 18; the product decision is fixed (Vercel Cron with
  `CRON_SECRET` at 06:00 UTC-6).
- Wallhaven anonymous SFW rate limits and keyword-set defaults confirm during
  the feature 15 spec.

Run `/feature` for the next unchecked item, currently `10b`. Run `/prototype`
before feature 14 to lock the visual look against `blueprint/reference/`.

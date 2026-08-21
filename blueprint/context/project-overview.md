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
10b. **Price enrichment and purchase opportunities** - One global manual
   Steam/ITAD refresh, cheapest valid offer, alternatives, freshness, retries,
   and opportunity signals; Vercel Cron is deferred to 18.
10c. **Steam wishlist import and enrichment** - Manual idempotent import,
   conservative local review, new-base RAWG follow-up, and unresolved queues.
11. **Compatibility synthesis** - ProtonDB, Steam Deck Verified, anti-cheat,
   Windows fallback, overrides, retries, and progress.
12. **Recommendation engine** - Explicit explainable play-next and buy runs,
   deterministic ranking, DLC affinity, dismissal, and calibration.
13. **Today dashboard** - Main/in-progress games, latest recommendations,
   Steam activity, offers, freshness, links, and operation status.
14. **Global visual foundation and full-app UI review** - Accessible themes,
   tokens, responsive navigation, polish, reduced-data/motion, and fallbacks.
15. **Wallhaven global background** - Optional cached SFW background,
   attribution, reduced-data behavior, and fallback.
16. **Game-detail dynamic themes** - RAWG imagery and derived colors limited to
   detail pages with contrast safeguards.
17. **Settings and manual export** - Sessions, wishlist import status, visual
   settings, refresh controls, queue status, and personal-data JSON export.
18. **Deployment and CI readiness** - Vercel/Supabase review, Vercel Cron,
   `CRON_SECRET`, queue protection, production smoke test, Verify command, and
   automatic checks when configured.

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
  update a manually acquired game.
- `GameAvailability`: source, ownership, display name, Steam App ID, playtime,
  and last-played timestamp.
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

- `UnresolvedSteamDlc`: persistent review record for an owned Steam DLC whose
  base game is absent. It stores source identity and temporary-discard state;
  later unresolved sync returns it to pending.
- `WishlistEntry`: independent wish with name, type (`BASE_GAME` or `DLC`), local
  notes and interest, optional external/provider identity, optional MXN target,
  and RAWG snapshot for base games. A DLC wish must reference one existing
  catalog base game and does not create a catalog game until manual acquisition.
- `WishlistMetadataSnapshot`: replaceable RAWG data owned by a wishlist entry;
  it can transfer to a newly acquired catalog game.
- `PriceRefresh`: persistent provider refresh status, timestamps, result, retry,
  and freshness diagnostics for wishlist offers.
- `DealOffer`: Mexican offer with source, store, current/regular price, currency,
  discount, historical low when available, DRM/platform data, URL, expiry, and
  freshness. All valid alternatives remain visible; the cheapest valid offer is
  selected. Key-store offers carry an MX activation warning.

### Compatibility and recommendations

- `CompatibilitySnapshot`: sourced ProtonDB, Steam Deck Verified, and anti-cheat
  evidence with provenance and freshness.
- `EnvironmentCompatibility`: synthesized Bazzite/Steam Deck status, implicit
  Windows fallback, mixed evidence, and a separate personal override that
  provider refreshes never replace.
- `RecommendationRun` and `RecommendationItem`: explicit run timestamp/context,
  ranked play-next or buy results, score factors, and visible explanations.
- `RecommendationFeedback`: temporary per-run dismissal and persistent per-type
  dismissal counters; three cumulative dismissals lower adjusted interest by one,
  never below zero.
- `Collection`, `CollectionMembership`, `PersonalTag`, `GameTag`: manual and
  calculated organization records.
- `WallpaperState`: cached SFW candidates, selection, freshness, render target,
  and attribution; no image binaries.

## Wishlist and provider rules

- Wishlist entries remain independent of catalog games until manual acquisition.
- The Wishlist has one global `Update prices` action. It queues entries with
  confirmed store identity and reports refreshed, failed, and identity-required
  entries. Individual price refresh is initially out of scope.
- Steam and ITAD have no source preference. The cheapest valid Mexican offer is
  selected while all valid alternatives remain visible.
- Every valid offer is shown with or without a target. A fresh offer at or below
  `targetPriceMxn` creates an opportunity signal. An offer older than 48 hours is
  stale: visible, but unable to create a strong signal.
- Price refresh never starts or replaces a recommendation run. The seller page
  remains authoritative for regional activation. ITAD is optional, server-side,
  read-only, uses `country=MX`, caching, and `429`/`Retry-After` handling.
- Steam wishlist import is manual and visible from Wishlist. A new base game with
  a reliable, unknown Steam App ID is created with interest `2/5` and empty notes,
  then queued for wishlist RAWG enrichment.
- Local matches, Steam DLC without an owned base, and other ambiguous cases use
  persistent review. Ignored review entries stay suppressed until restored.
- A wishlist item already in the owned catalog is omitted silently. Steam title
  changes/removals never rename or delete local wishes; provider status is only
  informational. Import is idempotent by Steam App ID.
- Manual entries and Steam imports save first; provider failures never roll back
  local data or remove the last valid provider snapshot.

## UI and routes

- `/`: sign-in landing and Google access gate.
- `/today`: read-only dashboard with main/in-progress games, latest play-next and
  buy results, Steam activity, offers, freshness, and operation progress.
- `/library`: searchable catalog, filters, manual creation, duplicate review, and
  catalog-wide metadata action.
- `/wishlist`: independent wishes, RAWG action, global price refresh, alternatives,
  opportunity signals, Steam wishlist import, review queues, and acquisition.
- `/games/[id]`: personal fields, availability, metadata, attribution,
  compatibility, DLC, duplicate warning, recommendation explanation, and RAWG
  loading.
- `/settings`: sessions, provider controls, visual/accessibility settings,
  Wallhaven, queue status, wishlist-import diagnostics, and JSON export.

The app is responsive. Desktop uses a dense constrained layout; mobile uses
bottom navigation, single-column cards, filter sheets, 44px targets, and no
wallpaper. Artwork and backgrounds must preserve contrast, theme settings,
reduced-data behavior, and reduced-motion safeguards.

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
  with `CRON_SECRET` to enqueue the daily persistent queue. Claims are atomic,
  scheduled runs are idempotent, overlapping work is prevented, and retry history
  remains visible.
- Production readiness includes `pnpm prisma:deploy`, a production smoke check,
  queue/scheduler review, and environment validation.

## Monetization and exclusions

There is no monetization in v1: the private app is source-available under the
PolyForm Noncommercial License 1.0.0 with no ads, subscriptions, or analytics.
Future possibilities include encrypted backups, richer providers, managed
workflow services, notifications, multi-user support, and offline/PWA behavior.

## Open questions and plan gaps

- `build-plan.md` item 17 still says “global Steam/ITAD preference,” while the
  approved project plan explicitly removed source preference in favor of the
  cheapest valid offer. This overview follows the approved project plan; update
  item 17 before implementing it.
- Exact Vercel/Supabase production scheduler configuration remains a deployment
  concern for feature 18; the product decision is Vercel Cron with `CRON_SECRET`.
- Provider API contracts for ProtonDB, Steam Deck Verified, and anti-cheat remain
  to be validated before feature 11.

Run `/feature` for the next unchecked item, currently `10b`. Use `/prototype`
first only if the UI direction needs throwaway visual exploration.

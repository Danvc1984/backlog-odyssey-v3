# Backlog Odyssey - Project Overview

> A private, single-user gaming-library assistant for deciding what to play and buy in Mexico across Bazzite, Steam Deck, and Windows.

## Problem

Gaming ownership, prices, compatibility evidence, metadata, and personal notes
are scattered across separate services. The owner needs one private assistant to
make explainable play-next and purchase decisions without becoming a launcher or
storefront.

## Users

- One authorized Google user.
- Fixed environments: Bazzite desktop, Steam Deck, and Windows fallback.
- Mexican prices and UTC-6 display.

Public registration, roles, collaboration, and multi-user behavior are outside
the MVP.

## Features

Completed work is retained here for context; the next unchecked feature is 7c.

1. **App shell and auth gate** - provides the Next.js shell and restricted Google access.
2. **Manual catalog and library base** - provides manual games and library filters.
3. **Game detail** - provides metadata, availability, and personal fields.
4. **Play states and main game** - enforces state rules, flags, and one main game.
5. **Collections** - provides manual and calculated collections.
6. **Steam connection and sync** - links Steam, imports owned games, and syncs playtime and recent activity.
7a. **Duplicate detection and review** - detects normalized-name matches, supports review and dismissal, and warns in the UI.
7b. **Merge and delete** - adds confirmed catalog consolidation or removal with conservative relation handling and short-lived, reload-safe Undo.
7c. **Edit game and availability details** - edits a game's name and visible availability fields from the detail page while preserving immutable game origin, Steam identity, and synchronized provider statistics.
8. **Catalog RAWG enrichment** - enriches catalog entries on demand and queues every initial Steam import for metadata.
9. **DLC model and unresolved Steam queue** - models base-game ownership for DLC and gives unresolved Steam DLC a persistent review flow.
10a. **Local wishlist, RAWG, and acquisition** - adds independent wishes, wishlist metadata, and conversion into catalog entries.
10b. **Price enrichment and purchase opportunities** - refreshes Mexican Steam and ITAD offers manually and daily without running recommendations.
11. **Compatibility synthesis** - asynchronously enriches post-RAWG games with ProtonDB, Steam Deck Verified fallback, and anti-cheat evidence.
12. **Recommendation engine** - explicitly generates three explainable play-next and three buy results, led by manual signals.
13. **Today dashboard** - composes recommendations, Steam activity, offers, freshness, and background-operation progress without starting work.
14. **Global visual foundation** - adds accessible light, dark, and system modes with reduced-data and reduced-motion behavior.
15. **Wallhaven global background** - adds an optional SFW cached background with attribution and safe fallbacks.
16. **Game-detail dynamic themes** - derives accessible, deterministic detail-page themes from RAWG imagery.
17. **Settings and manual export** - manages session, provider, visual, accessibility, refresh, and JSON-export controls.
18. **Deployment and CI readiness** - verifies Vercel/Supabase production readiness and configures reproducible checks when requested.

## Data model

Provider data is rebuildable. Personal intent, catalog state, and user choices
are authoritative.

### Identity and settings

- `User`, `Account`, `Session` (Auth.js records) - authenticate the sole permitted Google account.
- `AppSettings` (singleton) - fixed environments, Mexico and UTC-6 display, theme, reduced-data behavior, provider refresh controls, Wallhaven controls, and global price-source preference (`STEAM`, `ITAD`, `NO_PREFERENCE`).
- `SteamConnection` - `steamId64`, connection status, timestamps, and sync summary for the linked account.

### Catalog, ownership, and metadata

- `Game` - catalog-only record with `id`, `name`, `type` (`BASE_GAME` or `DLC`), origin, and optional `baseGameId`. A DLC must reference one base game; base-game deletion explicitly cascades to its DLC.
- `ExternalGameId` - external identity with namespace, identifier, and match provenance. Same-namespace conflicts block a merge. A retained Steam App ID lets later sync update a manually acquired game.
- `GameAvailability` - source and ownership availability, including Steam or another acquisition source; used when an acquired wish becomes a catalog game.
- `LibraryEntry` - base-game personal state: play state, main-game flag, priority, interest, rating, notes, tags, preferred environment, play/replay/hidden signals, and personal compatibility override. Only one base game may be main.
- `MetadataSnapshot` - replaceable RAWG snapshot for a catalog game with images, genres, tags/styles, release date, description, playtimes, alternative names, developer/publisher, website, rating/Metacritic context, RAWG URL, provider update time, local fetch time, and attribution. No history is retained.
- `PossibleDuplicate` - base-game pair, normalized-name evidence, confidence, and review state (`OPEN` or `DISMISSED`). It gates merge; detection never merges automatically.
- `CatalogOperation` - merge/delete operation linked to `User`, with type, state (`PENDING`, `UNDONE`, `EXPIRED`, `COMPLETED`), affected game IDs, minimal reversible snapshot, timestamps, and roughly 15-second expiry. Operations may not overlap the same game.
- `EnrichmentJob` - persistent provider work for a catalog or wishlist entry, with stage, status, attempts, next attempt, batch/progress context, and safe failure detail. RAWG precedes compatibility; transient failures retry at most three times.

### DLC, wishlist, and pricing

- `UnresolvedSteamDlc` - persistent review-queue record for an owned Steam DLC whose base game is absent, including source identity and a temporary-discard state. It returns to pending on a later unresolved sync.
- `WishlistEntry` - independent, non-provisional wish with name, type (`BASE_GAME` or `DLC`), notes, local interest, optional provider and external identifiers, optional `targetPriceMxn`, optional source-preference override, and independent RAWG snapshot. It does not create a `Game` until manual acquisition.
- `WishlistMetadataSnapshot` - replaceable RAWG data owned by a `WishlistEntry`; copy it into the new catalog game on acquisition when present.
- `PriceRefresh` - provider refresh status, timestamps, result, and freshness diagnostics. Failed refreshes preserve prior valid data.
- `DealOffer` - Mexican offer data: source, store, current price, currency, discount, historical low when available, DRM/platform data, external URL, expiry, and freshness. Stale offers stay visible but cannot produce a strong purchase recommendation.

### Compatibility, recommendations, and organization

- `CompatibilitySnapshot` - sourced ProtonDB, Steam Deck Verified, and anti-cheat evidence with provenance and freshness. ProtonDB is primary for Bazzite and Steam Deck; Verified is the Deck fallback.
- `EnvironmentCompatibility` - synthesized Bazzite and Steam Deck status, implicit Windows fallback, mixed-evidence state, and a separate personal override that provider refreshes never replace.
- `RecommendationRun` - an explicitly requested execution and its timestamp/context.
- `RecommendationItem` - ranked play-next or buy result with score factors and visible explanation. Manual signals lead ranking; unknown/stale compatibility is a warning, not a penalty. `play-next` is catalog-only; buy results exclude DLC whose base game is not owned.
- `RecommendationFeedback` - temporary per-run dismissal plus persistent per-type dismissal counters. Three cumulative dismissals reduce adjusted interest by one, never below zero.
- `Collection`, `CollectionMembership`, `PersonalTag`, `GameTag` - manual/calculated collections and reusable personal tags.
- `WallpaperState` - cached SFW Wallhaven candidate metadata, selection, freshness, and attribution; it stores no image binaries.
- `SyncRun` - provider operation timing, result, counts, and safe diagnostics.

## Tech stack

- **Next.js App Router, React, TypeScript, pnpm** - application runtime and development tooling.
- **Tailwind CSS v4 and shadcn/ui** - accessible responsive interface components.
- **Prisma and PostgreSQL/Supabase** - relational persistence and migrations.
- **Auth.js with Google** - single-account authentication, enforced server-side by `ALLOWED_GOOGLE_EMAIL`.
- **Zod** - server-side input validation.
- **Vitest** - unit-test gate for logic-bearing changes.
- **Vercel** - intended application host.
- **Steam, RAWG, ITAD, Wallhaven, compatibility providers** - server-side, optional enrichment boundaries; provider failure cannot corrupt personal data.

## Monetization

Not in the MVP. The application is private and source-available under the
PolyForm Noncommercial License 1.0.0, with no ads, subscriptions, or analytics.

## UI/UX

- `/` - sign-in landing and Google access gate.
- `/today` - read-only dashboard for main and in-progress games, three current results of each recommendation type, Steam activity, offers, and background progress.
- `/library` - searchable catalog, filters, manual creation, duplicate review, and catalog-wide metadata action.
- `/wishlist` - independent wishes, RAWG metadata action, target-price and offer signals, acquisition, and DLC decisions.
- `/games/[id]` - personal fields, availability, metadata, compatibility, DLC, duplicate warning, recommendation explanation, and per-game RAWG loading.
- `/settings` - sessions, provider controls, preferences, visual/accessibility settings, refresh actions, and JSON export.

The app is responsive: desktop favors a constrained, dense multi-column
experience and may show a Wallhaven background; mobile uses a bottom navigation,
single-column cards, a filter sheet, 44px targets, and no wallpaper. Detail-page
artwork and global backgrounds must never override accessible contrast,
light/dark/system modes, reduced-data behavior, or reduced-motion safeguards.

## Deployment

- **Target:** Vercel with Supabase PostgreSQL.
- **Build:** `pnpm build`; use `pnpm start` for a production smoke test.
- **Database:** pooled runtime URL and direct migration URL; production uses `pnpm prisma:deploy` before start.
- **Environment:** `DIRECT_URL`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_GOOGLE_EMAIL`; future provider keys for Steam, RAWG, ITAD, Wallhaven, and compatibility sources remain server-only.
- **Health:** app root smoke check.
- **Jobs:** PostgreSQL-backed queue processes provider batches; the daily price refresh uses a deployment scheduler. Steam sync remains user-initiated.
- **Checks:** `pnpm lint`, `pnpm typecheck`, and `pnpm test`; a single Verify command and automatic checks are configured only in the final readiness feature when requested.

> TODO: Decide the exact Vercel/Supabase scheduler integration for daily price batches. Steam has no automatic schedule.

## Open questions

- Features 7b, 7c, 8, 9, and 12 each contain several independently testable flows. Preserve their current roadmap entries, but split the implementation spec into small approved steps before building.
- Select and validate the final API/contracts for ProtonDB, Steam Deck Verified, and anti-cheat before feature 11; until then, provider evidence remains explicitly unknown.

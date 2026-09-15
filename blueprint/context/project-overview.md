# Backlog Odyssey - Project Overview

<!-- blueprint:source-hash 781bc6142cb2916a14bc09087ce66b3900b88e5ea970f06da67475f9e415536b -->

> A private, single-user gaming library and decision assistant for choosing what to play and buy in Mexico across a configured PC and handheld setup.

## Problem

Game ownership, prices, compatibility evidence, metadata, and personal notes are scattered across services. Backlog Odyssey consolidates them into an explainable private decision tool, not a launcher or storefront.

## User and access

- One authorized Google account; no public registration, collaboration, or roles in the MVP.
- The owner configures a Linux or Windows primary PC, optional Linux/Windows handheld, and an optional Windows fallback only for a Linux primary.
- Prices are Mexican pesos (MXN); time uses UTC-6.

## Features and build order

Completed work establishes the app shell, manual catalog, Steam import, catalog integrity, RAWG-to-IGDB transition foundations, wishlist/prices, compatibility, recommendations, dashboard, visual system, settings/export, OS onboarding, and handheld suitability.

1. **1-7a. Foundation and catalog** - authenticated shell, searchable manual library, play states, collections, Steam ownership import, and duplicate review.
2. **7b-7c. Catalog integrity** - transaction-safe merge/delete Undo and editable availability.
3. **8. Legacy RAWG enrichment** - completed provider contract now being retired by feature 23.
4. **9-10c. DLC, wishlist, and pricing** - manual DLC ownership, independent base/DLC wishes, acquisition, offers, targets, and manual Steam wishlist import.
5. **11. Compatibility** - ProtonDB/AWAY evidence, Linux-gated display and queues, Windows fallback synthesis, and wishlist evidence.
6. **12. Recommendations** - explainable play-next and buy runs, adaptive profile, tuning, rotation, calibration, and source-aware availability.
7. **13. Today** - local dashboard composition, data-health prompts, recent Steam activity, offers, and operation status.
8. **14-17. Visual system** - responsive dark/light/system UI, Dawn/Sunset themes, Odyssey copy, wallpaper, route composition, artwork, and detail themes.
9. **18-22. Operations and setup** - settings, personal-data export/empty-schema restore, first-login environment setup, polish, and handheld suitability.
10. **23. IGDB primary provider** - IGDB client, catalog and wishlist enrichment, and playtime are complete; **23e remains** to re-key recommendation evidence, move compatibility after successful IGDB enrichment, remove RAWG, swap attribution, and document clean restart.
11. **24-27. Catalog renewal** - completed IGDB DLC pages/browsing, ingestion-path interest defaults, IGDB-assisted manual creation, and system/series shelves.
12. **28. Recommendation behavior renewal** - pending handheld role, tab-local Tune flow, play-style/familiarity choices, and More filters.
13. **29. Deployment and CI readiness** - pending Vercel/Supabase review, daily cron, production checks, reproducible Verify command, and automated checks when configured.

## Data model

### Identity and catalog

- **User** - authenticated single-owner record; owns all personal data and provider operations.
- **Game** - catalog-only record: `id`, `name`, `type` (`BASE_GAME` | `DLC`), immutable `origin`, and optional `baseGameId` for DLC. A DLC must reference one base game and has no library entry or play state.
- **LibraryEntry** - one base-game personal record: `gameId`, `playState`, `mainGame`, `hidden`, `replay`, `priority`, nullable `interest` (0-5), `gameExperience`, `handheldSuitable`, preferred environment, notes, and play history.
- **Availability** - `gameId`, built-in kind (`STEAM` | `ROM`) or `OTHER_PLATFORM`, display label, and optional `alternativeSourceId`; a game can have many.
- **AlternativeSource** - user-owned reusable source: `id`, display/normalized name, optional known-source key, icon metadata, and archive state. Archived sources remain referenced but cannot be newly selected.
- **ExternalGameId** - provider identity: namespace, external ID, provenance, and `gameId`; confirmed Steam App IDs key Steam, IGDB, price, and compatibility work.
- **Tag** and **Collection** - user-owned labels/groups with join records. Calculated shelves derive from play state, handheld flag, owned DLC, and IGDB collection/franchise evidence.

### Wishlist, metadata, and offers

- **WishlistEntry** - independent unowned item: `id`, `name`, `type`, nullable `baseGameId` (required for DLC), notes, `interest`, game experience, handheld flag, target MXN price, and confirmed Steam identity/provenance. It never creates a provisional `Game`.
- **IGDB snapshot** - replaceable catalog or wishlist evidence: fixed identity, summary, genres/themes/keywords, involved companies, release date, ratings and counts, websites/alternative names, collection/franchise/structural relations, modes, cover/artwork/screenshots, palette, and fetched/updated provenance. DLC carries its own snapshot.
- **Playtime evidence** - attributed IGDB `game_time_to_beats` values (hastily, normally, completionist); SteamSpy median is fallback only when IGDB has no row and a confirmed Steam App ID exists.
- **PriceOffer** - a persisted valid Mexican offer with store, source, price/discount, freshness, seller URL, keyshop warning, historical-low context, and wishlist relation. The selected offer is the cheapest current valid offer; stale after 48 hours.

### Evidence, operations, and recommendations

- **CompatibilitySnapshot** / **EnvironmentCompatibility** - catalog evidence keyed by game and Steam App ID: ProtonDB, AWAY, freshness, Linux result, derived Windows fallback, and optional personal Linux override. Wishlist uses separate parallel snapshot/environment tables keyed by `wishlistEntryId`.
- **ProviderOperation** and refresh/run records - PostgreSQL-backed queued Steam, IGDB, price, and compatibility work with progress, retries (maximum three transient retries), rate limits, overlap protection, and visible failures.
- **CatalogOperation** - short-lived merge/delete Undo record: authenticated user, type, affected game IDs, exact snapshot, state, and ~15-second expiry; overlapping game operations are blocked.
- **RecommendationRun** and items - stored play-next/buy context, visible roles, factors, caveats, retained candidate batches, and 12-month retention.
- **RecommendationEvent**, **RecommendationProfile**, **RecommendationPreference**, and **RecommendationPreset** - append-only feedback, rebuildable learned dimensions, semantic Prefer/Neutral/Avoid overrides, and named tuning shortcuts. Dismissal counters can reduce adjusted interest to a floor of zero.
- **AppSettings** - OS/handheld/fallback setup, visual and accessibility choices, duration profile, and provider-related settings. Visual preferences do not require migration.

## Product rules

- Catalog and wishlist are separate. Acquiring a wish creates a real catalog game (or linked DLC), transfers applicable IGDB metadata and base-game interest, then removes the wish.
- Steam owned sync never implies DLC ownership. DLC stays outside Library and recommendations; deleting a base game explicitly cascades to its DLC.
- Compatibility UI and automatic work exist only when a configured device runs Linux. All-Windows setups render no compatibility controls or tags.
- Recommendations are deterministic and explain their factors. Compatibility is normally soft evidence; Linux without Windows fallback can hard-exclude fallback-needing play candidates, subject to the configured Windows-handheld rescue.
- Provider work is asynchronous, persistent, rate-limited, and never destroys valid personal or prior provider data on failure.
- ROMs are excluded from wishlist and buy recommendations; ROM-only games are compatibility not applicable.

## Tech stack

- **Next.js App Router, React, TypeScript, pnpm** - web application.
- **Tailwind CSS v4 and shadcn/ui** - accessible component styling and semantic tokens.
- **Prisma, PostgreSQL, Supabase** - relational persistence and hosted database.
- **Auth.js and Google** - single-user authentication.
- **Zod** - validation; **Vitest** - unit tests.
- **IGDB/Twitch, Steam, SteamSpy, ITAD, ProtonDB, AWAY, Wallhaven** - server-side metadata, ownership, price, compatibility, and optional background integrations.
- **Vercel** - intended deployment and cron host.

## UI/UX

Dark-first Dawn/Sunset palette families use Cinzel display type, Inter body type, semantic dual accents, rounded cards/chips, accessible overlays, desktop sidebar, and mobile bottom navigation. Reduced motion disables carousel automation; reduced data avoids remote images and uses deterministic token fallbacks.

- `/` - Today dashboard: current games, explicit recommendations, offers, activity, coverage, and operation state.
- `/library` and `/games/[id]` - owned base-game browsing, filters, details, availability, personal fields, DLC, and compatibility when active.
- `/wishlist` and `/wishlist/[id]` - independent base/DLC wishes, identity, offers, acquisition, metadata, and eligible compatibility evidence.
- `/collections` - manual collections and calculated system/series shelves.
- `/settings` - session, setup, theme/accessibility, provider controls, diagnostics, export, and restore.

## Deployment

- **Target:** Vercel application with Supabase/PostgreSQL.
- **Scheduled work:** Vercel Cron at 06:00 UTC-6, protected by `CRON_SECRET`, enqueues price refresh and catalog/wishlist compatibility freshness sweeps; duplicate claims and overlapping runs must be safe.
- **Environment:** provider credentials stay server-side; exact environment-variable inventory, health path, domain, and production smoke-test contract are pending feature 29.
- **Verification:** `pnpm` commands, including existing typecheck/tests/build, will be consolidated into one reproducible Verify command in feature 29.

## Open questions

- **Build-order dependency:** `23e` is numbered under feature 23 but is explicitly deferred until after completed features 24-27; `/feature` should continue with 23e before feature 28.
- **Identifier ambiguity:** build-plan feature `19c` is used both for its parent and a child item. Preserve the historic entries, but assign a unique identifier before a future plan edit references that child.
- **TODO:** Feature 29 must finalize environment-variable names beyond `CRON_SECRET`, health endpoint, domain, and exact Verify/CI configuration.

# Backlog Odyssey - Project Overview

<!-- blueprint:source-hash fa0b89245ebf38405bc054f4a06646ec1d14005df15266a407d35428d4bc3c9e -->

> A private, single-user gaming library and decision assistant for choosing what to play and buy across a configured PC and handheld setup, with selectable market and display-currency preferences.

## Problem

Ownership, prices, compatibility evidence, metadata, and personal gaming decisions are fragmented across services. Backlog Odyssey consolidates them into one explainable private tool without becoming a launcher or storefront.

## Users

- One authorized Google account; no public registration, collaboration, or roles in the MVP.
- The owner configures a Linux or Windows primary PC, an optional Linux or Windows handheld, and an optional Windows fallback only when Linux is primary.
- The owner selects Mexico, United States, Canada, Brazil, Colombia, or Argentina as the ITAD market, with MXN, USD, CAD, BRL, COP, or ARS as the display currency. Provider prices retain their original currency; external conversion is presentation-only and visibly estimated. Time defaults to UTC-6.

## Features

Completed work establishes the authenticated app, catalog, Steam imports, wishlist and pricing, compatibility, recommendations, dashboard, visual system, settings/export, environment onboarding, handheld behavior, and IGDB provider transition.

1. **1-7a. Foundation and catalog** - authenticated shell, searchable manual library, play state, collections, Steam ownership import, and duplicate review.
2. **7b-7c. Catalog integrity** - transactional merge/delete with reload-safe Undo and editable game availability.
3. **8. Legacy RAWG enrichment** - completed provider foundation later superseded by feature 23.
4. **9-10c. DLC, wishlist, and pricing** - manual DLC ownership, independent base/DLC wishes, acquisition, regional offers and targets, and manual Steam wishlist import.
5. **11. Compatibility** - ProtonDB/AWAY evidence, Linux-gated presentation and queues, derived Windows fallback, and separate wishlist evidence.
6. **12. Recommendations** - explicit explainable play-next and buy runs, adaptive profile, tuning, retained batches, calibration, and source-aware ranking.
7. **13. Today** - dashboard composition, data-health prompts, recent Steam activity, offers, and provider-operation status.
8. **14-17. Visual system** - responsive themes, route composition, Wallhaven background, artwork, screenshots, and per-game palettes.
9. **18-22. Operations and setup** - settings, personal-data export/empty-schema restore, OS onboarding, polish, and handheld suitability.
10. **23. IGDB primary provider** - IGDB metadata, artwork, identity, ratings, playtime evidence, recommendation re-keying, and RAWG retirement.
11. **24-27. Catalog renewal** - IGDB DLC pages, ingestion-specific interest defaults, IGDB-assisted manual creation, and system/series shelves.
12. **28. Recommendation behavior renewal** - handheld role, tab-local Tune flow, play-style/familiarity questions, and More filters.
13. **29. Today recommendation spotlight carousels** - Play Next and Buy spotlights with up to five additive roles, ten-second accessible auto-advance, compact reasoning, detail-first actions, and one dismissal-and-replacement action across all recommendation surfaces.
14. **30. Current state and prior completion** - independent `completedBefore`, automatic history preservation, replay consumption on start, deduplicated learning evidence, and the Previously completed shelf.
15. **31. Personal-data and availability simplification** - removal of notes and per-game source labels, Settings-only source administration, compact Journey/Preferences/Personal fit controls, and a clean export/import schema break.
16. **32. Unified tags and shelves** - tag-only manual grouping, empty tag shelves, centralized create/rename/merge/delete, shelf sorting, and capped personal-tag Tune targeting.
17. **33. Sign-in introduction demo** - completed playful, responsive sign-in panel with icon-led branding, the approved tagline, and an accessible static story from manual or Steam-imported backlog addition through personal tracking to explainable recommendation using curated recognizable games.
18. **34. Welcome regional prices and optional Steam connection** - completed regional market/currency preferences, ITAD querying, Frankfurter v2 presentation-only FX conversion, and optional Steam OpenID connect-or-skip in Welcome.
19. **36. Today taste setup and recommendation gating** - completed required Taste Setup with a ten-game library threshold, random independent prior-play, stronger-interest, and play-soon signals, recommendation gating, empty-wishlist Buy omission, preferred-environment removal, and Today tag/shelf styling.
20. **37. Library and game-detail renewal** - completed detail-page reorganization and personal-data presentation, merged title/IGDB maintenance, section links and feedback cleanup, duplicate-review and platform-merge fixes, ProtonDB deep links, and completed-game backlog progress correction.
21. **35. Mobile responsiveness pass** - completed pre-deployment mobile review and fixes for overflow, viewport-fitting titles, buttons, and sections, detail-page actions, collapsible Library and Wishlist health strips, grid-only narrow-screen Library and Wishlist browsing plus Collection detail grids, Today worthy-bargain game art, and mobile Wallhaven availability subject to visual preferences.
22. **38. Deployment and CI readiness** - pending Vercel/Supabase review, protected daily cron, production checks, one reproducible Verify command, and optional automatic checks. This is the final planned step.

The active ad-hoc fix before feature 38 merges owned-game Interest and enum Priority into one Play priority; it is tracked in `current-feature.md`, not as another build-plan item. Checked items above record their original delivery.

## Data model

The shapes below describe the intended model, including the pending Play priority fix. Provider evidence remains replaceable; personal data remains authoritative.

### Identity and catalog

- **User** - single authenticated owner; parent for personal data, settings, operations, and recommendation records.
- **Game** - catalog-only entity with `id: string`, `name: string`, `type: BASE_GAME | DLC`, immutable origin, and nullable `baseGameId`. A DLC must reference a base game and has no `LibraryEntry` or play state.
- **LibraryEntry** - one base-game profile with `gameId`, current `playState: NOT_STARTED | IN_PROGRESS | COMPLETED | ABANDONED`, `completedBefore: boolean`, `isMainGame`, `hidden`, `replay`, `playSoon`, nullable numeric `interest: 1..5` stored as **Play priority** (unset allowed), rating, game experience, handheld suitability, and play history. The separate enum `priority` will be dropped without backfill; the three development entries remain and keep their numeric values.
- **Availability** - many per game; built-in `STEAM | ROM` or `OTHER_PLATFORM` with an `alternativeSourceId`. Feature 31 removes the per-game display label.
- **AlternativeSource** - reusable owner-defined source with canonical and normalized names, optional known-source key/icon metadata, and archive state. Definitions live only in Settings; archived assignments remain visible and removable but cannot be newly selected.
- **ExternalGameId** - provider namespace, external ID, provenance, and game relation. Confirmed Steam App IDs key Steam, IGDB, compatibility, and price work.
- **PersonalTag** / **GameTag** - normalized case-insensitive tag identity and many-to-many game membership. After feature 32 every tag, including an empty tag, creates a shelf; the separate manual Collection model is absent.
- **PossibleDuplicate** - open/dismissed normalized-match relation that gates base-game merge.

### Wishlist, metadata, and offers

- **WishlistEntry** - independent unowned base game or DLC with `id`, `name`, type, nullable `baseGameId` required for DLC, interest, game experience, handheld suitability, optional `targetPriceMxn`, and optional confirmed Steam identity/provenance. It never creates a provisional `Game`; notes are removed in feature 31.
- **IGDB metadata snapshot** - replaceable catalog or wishlist evidence containing fixed IGDB identity, summary, genres/themes/keywords, companies, release date, ESRB context, separate attributed ratings and counts, websites, alternative names, collection/franchise/structural relations, modes, cover/artwork/screenshots, palette, and fetched/updated provenance. DLC carries its own snapshot.
- **PlaytimeEvidence** - replaceable attributed IGDB `game_time_to_beats` values; SteamSpy median is fallback only when IGDB has no row and a confirmed Steam App ID exists.
- **PriceOffer** - wishlist relation, store/source, selected market country, exact ITAD source currency and amount, optional presentation-only converted display amount/rate, discount, seller URL, freshness, optional region-activation warning, and historical-low context. Up to 8-10 valid offers persist; the selected offer is the cheapest comparable regional offer and becomes stale after 48 hours.
- **Price identity mapping** - confirmed Steam App ID to cached ITAD ID with provenance; seller preference never overrides cheapest-valid selection.
- Acquiring a base-game wish creates a real catalog game, transfers applicable IGDB metadata and Wishlist Interest as library Play priority, adds availability, and removes the wish. Acquiring a DLC creates a linked catalog DLC and may update the base game's play intent.

### Compatibility and operations

- **CompatibilitySnapshot** / **EnvironmentCompatibility** - catalog evidence keyed by game and Steam App ID: ProtonDB, AWAY, freshness, Linux synthesis, derived Windows fallback, and optional personal Linux override.
- **WishlistCompatibilitySnapshot** / **WishlistEnvironmentCompatibility** - parallel provider-only evidence keyed by `wishlistEntryId`; never shared with catalog records.
- Compatibility is active only when a configured device runs Linux. ROM-only games are not applicable; all-Windows setups expose no compatibility UI or work.
- **Provider jobs and run records** - PostgreSQL-backed Steam, IGDB, price, compatibility, and wallpaper work with progress, bounded retries, rate limits, overlap protection, and visible terminal failure. Provider failure preserves prior valid evidence.
- **CatalogOperation** - merge/delete Undo record with owner, type, affected game IDs, exact minimal snapshot, status, and roughly 15-second expiration. Operations touching the same game cannot overlap.

### Recommendations and settings

- **RecommendationRun** / **RecommendationItem** - `PLAY_NEXT | BUY` run context, visible roles, factors, caveats, retained per-role candidate batches, and 12-month retention. Feature 29 allows Best Fit, You Might Also Enjoy, Out of the Box, Change of Pace, and additive Handheld roles.
- **RecommendationEvent** - append-only exposure, start, completion, abandonment, dismissal, and taste-setup evidence with kind-specific retention.
- **RecommendationProfile** - rebuildable learned dimensions for genre/tag, experience, duration, publisher, era, series, and maturity with recency decay.
- **RecommendationPreference** - semantic `PREFER | NEUTRAL | AVOID` override.
- **RecommendationPreset** - persisted named Tune context; loading affects only the active tab-local Tune state.
- **Dismissal feedback** - `Maybe some other time — show me another` records a dismissal and replaces from the same retained role batch. Three cumulative same-kind dismissals lower adjusted Play priority (Play Next) or Wishlist Interest (Buy) by one, floor zero.
- **AppSettings** - primary OS, optional handheld and valid Windows fallback, onboarding state, supported price country and display currency, duration profile, theme family/mode, reduced-motion/data choices, and provider-related settings.
- **WallpaperState** - cached SFW Wallhaven candidate URLs and deterministic daily selection; reduced-data mode disables all image fetching.

## Product rules

- Catalog and wishlist remain separate; ROMs are excluded from wishlist and buy recommendations. After the pending fix, Play Next scores owned-game Play priority once, while Buy continues using Wishlist Interest. Library cards and game-detail stars all edit the same Play priority; `playSoon` stays independent. Today considers a visible game's recommendation profile incomplete when Play priority is unset.
- Steam owned sync never implies DLC ownership. DLC stays outside Library, play state, and play-next recommendations.
- Current state and prior completion are independent after feature 30. Leaving `COMPLETED` preserves `completedBefore`; starting that replay also clears `replay`. Current and prior completion count as one positive profile signal.
- Active-backlog progress uses current state only. Previously completed may overlap In Progress or Backlog.
- Source definitions are managed in Settings; game surfaces assign existing active sources and use canonical names.
- Recommendations are deterministic and explain their factors. Compatibility is normally soft evidence; Linux without a Windows fallback may hard-exclude fallback-needing play candidates, subject to the Windows-handheld rescue.
- Provider work is asynchronous, persistent, rate-limited, and must not destroy valid personal or prior provider data on failure.
- A duplicate merge unions compatible platform assignments and deduplicates semantically identical records, including system-added and manually added Steam availability.

## Tech stack

- **Next.js App Router, React, TypeScript, pnpm** - web application and package workflow.
- **Tailwind CSS v4 and shadcn/ui** - responsive accessible interface and semantic tokens.
- **Prisma, PostgreSQL, Supabase** - relational persistence and intended hosted database.
- **Auth.js and Google** - single-owner authentication.
- **Zod and Vitest** - validation and unit testing.
- **IGDB/Twitch, Steam, SteamSpy, ITAD, Frankfurter v2, ProtonDB, AWAY, Wallhaven** - server-side metadata, ownership, duration, regional pricing, presentation-only currency conversion, compatibility, and optional imagery.
- **Vercel** - intended application and cron host.

## Monetization

Not in the MVP. This is a private single-owner tool, not a public service or storefront.

## UI/UX

Dark-first Dawn and Sunset families use light/dark/system modes, defaulting to dark Sunset until the owner chooses otherwise, with Cinzel display type, Inter body type, semantic accents, accessible overlays, a desktop sidebar, and mobile bottom navigation. Reduced motion disables carousel automation; reduced data prevents remote artwork requests. Before deployment, a mobile pass eliminates clipped text and actions, constrains titles and controls, supplies scrolling where content needs it, keeps detail-page More actions reachable, allows dense Library and Wishlist health strips to collapse on mobile, uses their grid presentation at narrow widths and grid cards in Collection detail, gives the Today worthy-bargain panel a blurred offer-game-art background when available, and allows the existing decorative Wallhaven background on mobile when enabled and reduced data is off.

- `/` - Today: current games, Taste Setup when eligible, and only after it is saved, recommendation spotlights; offers, activity, coverage, freshness, and operations remain available. Buy recommendations are omitted with an empty wishlist.
- `/library` - owned base-game grid/list, search, filters, pagination, card deletion, and catalog health.
- `/games/[id]` - metadata, compact Journey/Preferences controls, availability, tags, DLC, and gated compatibility.
- `/wishlist` - independent base/DLC wishes, search/sort, offers, targets, identity, and acquisition.
- `/wishlist/[id]` - Personal fit, IGDB evidence, offers, linked seller provider, acquisition, and eligible compatibility.
- `/collections` and `/collections/[id]` - tag-generated shelves plus calculated system and IGDB series/franchise views; feature 32 adds centralized tag management and sorting.
- `/` when signed out - icon-led Backlog Odyssey sign-in with the tagline "Turn your gaming backlog into your next adventure"; a decorative reduced-motion-aware demo cycles static curated games from manual or Steam-imported backlog addition through personal tracking to an explainable recommendation. Desktop places it alongside authentication; mobile keeps authentication primary and presents it below.
- `/welcome` - first-login setup for device context; Mexico, United States, Canada, Brazil, Colombia, or Argentina market selection; MXN, USD, CAD, BRL, COP, or ARS display currency; and an optional Steam OpenID connection with a skip path. Setup completion does not depend on Steam.
- `/settings` - session, device setup, editable market/currency preferences with a manual price-refresh warning, theme/accessibility, source administration, provider controls, diagnostics, export, and empty-schema restore.
- First login routes through OS/handheld/fallback setup and then may offer Taste Setup when the library has at least ten games.

## Deployment

- **Target:** Vercel application with Supabase/PostgreSQL.
- **Scheduled work:** Vercel Cron daily at 06:00 UTC-6, protected by `CRON_SECRET`, enqueues price refresh plus catalog/wishlist compatibility evidence older than 180 days. Claims and overlapping invocations must be idempotent; compatibility work is a no-op when inactive.
- **Runtime:** server-side provider credentials; persistent PostgreSQL queue and retry history.
- **Regional prices:** ITAD receives the configured supported country. Its returned amount and currency remain authoritative; a Frankfurter v2 value is optional display-only context, must remain labeled as an estimate, and cannot silently change offer selection or regional warning semantics.
- **Still pending feature 38:** exact production environment-variable inventory beyond `CRON_SECRET`, health path, domain, production smoke-test contract, one reproducible Verify command, and final CI configuration.

## Open questions

- Build-plan feature 10b still says Vercel Cron activation was deferred to feature 24, while the current project plan and feature 33 place deployment cron activation in feature 33. The current overview follows feature 33; the historical cross-reference remains stale.
- The project plan still calls playtime queueing semantics a future spec decision even though feature 23c is checked complete. Confirm whether that sentence is stale when the plans are next edited.

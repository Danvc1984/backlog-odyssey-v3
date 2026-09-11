# Backlog Odyssey - Project Overview

<!-- blueprint:source-hash 98bfb76f80be38901adc6e769f5111bda866d67deab7439a0c1082840953c9ca -->

> Private, single-user gaming library and decision assistant for choosing what to play and buy in Mexico across a self-configured Linux or Windows setup.

## Problem

Gaming information is fragmented across Steam, price services, compatibility communities, metadata catalogs, and personal notes. Backlog Odyssey consolidates ownership, manual catalog entries, wishlist intent, regional offers, compatibility evidence, metadata, and explainable recommendations without becoming a launcher, storefront, or automatic purchasing tool.

## Users

- One private owner with one authorized Google account.
- A setup configured at first login: one primary Linux-based or Windows OS, an optional Linux or Windows handheld, and an optional Windows fallback only when the primary OS is Linux.
- The owner needs Mexican prices, MXN targets, and UTC-6 behavior. Public registration, roles, collaboration, and multi-user accounts are outside the MVP.

## Features

The checked state is owned by `blueprint/build-plan.md`; the list below is the compact build-order map.

1. **[x] 1-6: Foundation** - App shell, Google access, manual catalog, game detail, play state, collections, Steam linking, import, and explicit sync.
2. **[x] 7a-7c: Catalog integrity** - Duplicate review, conservative merge/delete with reload-safe short Undo, and game/availability editing.
3. **[x] 8: RAWG enrichment** - Historical matching, replaceable snapshots, asynchronous jobs, post-import enrichment, ESRB, and series evidence; Feature 23 migrates this boundary to IGDB.
4. **[x] 9: DLC and unresolved Steam queue** - Base-game ownership, reviewed DLC creation, persistent unresolved-DLC review, and safe deletion/cascade rules.
5. **[x] 10a: Local wishlist and acquisition** - Independent base/DLC wishes, personal fields, provider data, and explicit acquisition into the catalog.
6. **[x] 10b-10c: Prices and Steam wishlist import** - Provenance-tracked identity, Mexican ITAD offers, target opportunities, and conservative manual wishlist import/review.
7. **[x] 11: Compatibility and wishlist detail** - Linux ProtonDB/AWAY evidence, derived Windows fallback, setup gating, compatibility queues, sweeps, and wishlist detail.
8. **[x] 12: Explainable recommendations** - Play-next and Buy engines, adaptive profile, calibration, retained candidate batches, roles, rotation, source tuning, and private event history.
9. **[x] 13: Today dashboard** - Backlog progress, coverage actions, cached Steam activity, latest explicit runs, offers, provider freshness, and operation status.
10. **[x] 14: Global visual foundation** - Dark/light/system tokens, responsive shell, accessibility, reduced motion/data, and full-app visual acceptance.
11. **[x] 15-16: Supporting routes and Wallhaven** - Detail, collection, Settings composition, plus optional cached background rotation, fallback, attribution, and reduced-data hard-off.
12. **[x] 17: Dynamic detail themes and screenshots** - Server-derived artwork palettes and screenshot carousels on catalog and wishlist detail; the provider source migrates from RAWG to IGDB in 23.
13. **[x] 18: Settings, export, and restore** - Provider/queue controls, visual settings, personal-data JSON export, and empty-schema-only transactional restore.
14. **[x] 19: OS setup and environment-aware behavior** - First-login setup, Linux-gated compatibility, no-fallback Play exclusions, setup-adapted fields, and synchronous re-derivation after changes.
15. **[x] 20: Odyssey theme expansion** - Dawn/Sunset families, Cinzel/Inter typography, official brand icons, Odyssey voice, Phosphor UI icons, and four-palette acceptance.
16. **[x] 21: Pre-deployment polish** - Today, Library, Wishlist, Settings, onboarding, wallpaper, Steam activity, pagination, metadata guidance, and action-state fixes.
17. **[x] 22: Handheld suitability** - Owner-marked handheld fit and the Windows-handheld rescue for no-fallback Play recommendations.
18. **[ ] 23: IGDB as primary provider** - `23a` (client and identity foundation) is shipped; `23b-23e` still replace RAWG catalog/wishlist evidence, add IGDB/SteamSpy duration, re-derive engines, and document the clean restart.
19. **[ ] 24: Deployment and CI readiness** - Vercel/Supabase review, Cron, production/smoke verification, one Verify command, and automatic checks when configured.

## Data model

The durable schema is in `prisma/schema.prisma`. Personal data, provider evidence, and operational history have separate ownership and replacement rules.

### Identity, setup, and catalog

- `User`, `Account`, and `Session` provide the single Google-authenticated account.
- `AppSettings` stores `primaryOs`, `hasWindowsFallback`, `handheldOs`, and `onboardingCompleted`; OS changes are confirmed, then synchronously re-derive compatibility and recommendation runs.
- `SteamConnection`, `SyncRun`, `SteamRecentActivityCache`, `EnrichmentJob`, `PriceRefresh`, and compatibility sweep records persist provider operations, freshness, retry timing, counts, and safe diagnostics. Recent activity is a narrow cache and never imports games.
- `Game` is catalog-only with base-game/DLC type and immutable origin. `LibraryEntry` stores play state, main-game flag, priority, interest, rating, environment, `GameExperience`, notes, replay candidate, hidden state, and nullable handheld suitability.
- `ExternalGameId` stores provider namespace, identifier, and provenance. `GameAvailability` answers where a catalog game can be played; Steam and ROM are built-ins, while other platforms reference reusable `AlternativeSource` records with normalized names, aliases/icon metadata, and archive state.
- `MetadataSnapshot` is replaceable attributed JSON provider evidence. Existing checked features are RAWG-era; Feature 23 targets an IGDB-shaped snapshot with summary, genres/themes/keywords, companies, release date, ESRB, separate rating fields and counts, websites, alternative names, collections/franchise, structural relations, game modes, artwork, screenshots, and derived palette.
- `PossibleDuplicate` records review evidence. `CatalogOperation` stores a minimal exact merge/delete snapshot, affected games, pending/undone/expired/completed state, overlap protection, and an approximately 15-second Undo window.

### Wishlist, offers, and compatibility

- `WishlistEntry` is independent until explicit acquisition: an unowned base game or DLC linked to an owned catalog base game. It carries name, personal notes/interest/experience, optional identity, and handheld suitability.
- `WishlistMetadataSnapshot` holds independent base-game provider evidence. `WishlistImportReview`, `WishlistImportIgnore`, and unresolved DLC records preserve manual review across owned-library sync and wishlist import.
- `DealOffer` stores valid Mexican offer alternatives; `ItadIdentity` caches Steam-App-ID mapping. The selected offer is always the cheapest valid Mexican offer, with seller/source visible. `targetPriceMxn` is optional, opportunities require a fresh selected offer at or below target, and historical low is display-only. Offers go stale after 48 hours.
- `CompatibilitySnapshot`/`EnvironmentCompatibility` store catalog evidence; parallel `WishlistCompatibilitySnapshot`/`WishlistEnvironmentCompatibility` store read-only wishlist evidence keyed by wishlist entry. ProtonDB and AWAY are separate attributable Linux evidence, with Windows derived only for an eligible fallback.
- Feature 23 adds replaceable attributed IGDB `game_time_to_beats` evidence (`hastily`, `normally`, `completely`) and SteamSpy median fallback only when IGDB has no row and a confirmed Steam App ID exists. RAWG playtime is retired.

### Recommendations and personal organization

- `PersonalTag`, `GameTag`, `Collection`, and `CollectionMembership` organize catalog games.
- `RecommendationRun` and `RecommendationItem` retain context, roles, explanations, qualified batches, and visible results. `RecommendationFeedback`, append-only `RecommendationEvent`, `RecommendationProfile`, `RecommendationPreference`, tune state, and presets hold private calibration and adaptive preference data.
- Recommendation-owned data is retained by event type, rebuildable where possible, and reset without deleting catalog or provider data. Feature 18 exports the personal decisions needed to restore into an empty schema; provider snapshots, credentials, and operational caches rebuild manually.
- `WallpaperState` stores Wallhaven URLs and selection only, never image binaries. `IgdbTokenCache` keeps server-side IGDB client-credential expiry data.

## Tech stack

- **Next.js App Router, React, TypeScript** - application and route rendering.
- **pnpm** - package manager; the project uses `pnpm@11.17.0`.
- **Tailwind CSS v4, shadcn/ui, Radix** - styling and accessible UI primitives.
- **Prisma and PostgreSQL/Supabase** - durable data, migrations, and persistent provider queues.
- **Auth.js and Google** - single-user authentication.
- **Zod and Vitest** - validation and unit/logic tests.
- **Steam, IGDB, SteamSpy, ITAD, ProtonDB, AWAY, and Wallhaven** - server-side, attributable, replaceable evidence or optional imagery. RAWG is the historical provider being retired in Feature 23.

## Monetization

Not in v1. This is a private single-user decision assistant with no storefront, purchasing, public accounts, or advertising scope.

## UI/UX

- `/` - authentication landing.
- `/welcome` - first-login OS, handheld, fallback, and optional taste-setup flow.
- `/today` - local dashboard with Currently Playing and Featured Offers carousels, Play Next roles, Buy results, coverage, recent activity, offers, freshness, and operations. It never silently starts provider work or launches a game.
- `/library` - searchable catalog, source filters, manual creation, duplicate review, enrichment, and grid/list browsing with 18/48/99 page sizes.
- `/games/[id]` - personal fields, availability, metadata, screenshots, detail theme, compatibility, DLC, duplicate/recommendation context, and provider actions.
- `/wishlist` - independent wishes, identity, offers, target prices, opportunities, Steam import/review, acquisition, and grid/list browsing.
- `/wishlist/[id]` - wish metadata, screenshots/theme, identity provenance, offers, personal fields, acquisition/edit/delete, compatibility, and fill-only enrichment.
- `/collections` and `/collections/[id]` - collection browsing and forms.
- `/settings` - session, OS, recommendation, provider/queue, wishlist diagnostics, visual, Wallhaven, export, and empty-schema import controls.

The visual system is Dawn and Sunset, each with light/dark modes, Cinzel display typography, Inter body text, technical monospace evidence labels, official source icons, semantic contrast-validated colors, deterministic fallbacks, and explicit reduced-motion/reduced-data behavior. Expressive copy may use the Odyssey voice; statuses, errors, evidence, freshness, and caveats remain factual.

## Deployment

- **Target:** Vercel application with PostgreSQL/Supabase storage.
- **Commands:** `pnpm dev` (port 3500), `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- **Operations:** provider work uses persistent PostgreSQL queues with bounded retries, rate limits, idempotent claims, overlap protection, and visible retry history. Price refresh is manual until Feature 24.
- **Scheduled work:** Feature 24 plans a Vercel Cron at 06:00 UTC-6 using `CRON_SECRET` to enqueue price refresh and a compatibility freshness sweep for catalog and wishlist evidence older than 180 days. The compatibility sweep is a no-op when compatibility is inactive.
- **Secrets:** Twitch/IGDB credentials, database credentials, Steam/ITAD credentials where applicable, and `CRON_SECRET` remain server-side; the retired RAWG key is removed by Feature 23.
- **Verification:** no combined `Verify` command or GitHub workflow exists yet. Feature 24 will define the reproducible command and automatic checks.

> TODO (confirm): the production health-check path, exact Vercel/Supabase environment values, and final smoke-test route are not specified in the plans.

## Open questions

- The plans intentionally describe a RAWG-era shipped foundation and an IGDB target. Feature 23 must complete the source migration without silently preserving legacy RAWG snapshots.
- `project-plan.md` leaves duration queueing semantics as a specification decision; Feature 23c must define whether and when duration evidence is queued or refreshed.
- The project plan uses both automatic IGDB-derived App ID application for fixed matches and “suggest-and-confirm” wording in the wishlist compatibility section. Resolve that wording before 23d.
- `build-plan.md` contains two checked items labeled `19c` (the parent and its Play-environment child). Their history is complete, but the identity should be clarified before future references rely on it.
- Feature 23 still needs implementation-level decisions for exact IGDB snapshot shape, token-cache/rate-limit coordination, migration sequencing, and stale-snapshot retry presentation.

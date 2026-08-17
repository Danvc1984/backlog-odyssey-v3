# Backlog Odyssey - Project Overview

> Private, single-user gaming library and decision assistant for a fixed
> Bazzite / Steam Deck / Windows setup, focused on Mexico.

## Problem

Gaming information is fragmented across Steam, price-comparison services,
compatibility communities, metadata catalogs, and personal notes. The owner
cannot easily answer what to play next from already-owned games, which wishlist
base game or DLC is worth buying now for Mexico, or whether to use Bazzite, Steam
Deck, or Windows for a given game. Backlog Odyssey consolidates these signals
into one private assistant without becoming a launcher, storefront, or analytics
service.

## Users

A single private owner on one fixed environment (Bazzite desktop, Steam Deck
portable, Windows fallback, MX prices, UTC-6). No multi-user, roles,
registration, or teams. Access is a single authorized Google email
(`ALLOWED_GOOGLE_EMAIL`); every protected server entry point enforces that
identity.

## Features

In build-plan order. The headline feature is the **Today dashboard**.

1. **App shell and auth gate** - Next.js shell with desktop nav / mobile bottom nav and single-user Google sign-in restricted to the allowed email.
2. **Manual catalog and library base** - create manual games (base / other-platform / ROM) and a searchable, filterable library.
3. **Game detail** - metadata, availability, record origin, and personal fields (priority, interest, rating, notes, tags, preferred environment).
4. **Play states and main game** - play-state rules, single main-game constraint, candidate flags (play soon / replay / hidden), abandoned signal.
5. **Collections** - persistent manual Collections and calculated system Collections.
6. **Steam connection and sync** - Steam OpenID connect, SteamID64, owned / recent import, exact App ID idempotency, playtime and last-played.
7. **Possible duplicates** - similarity evidence, review, dismiss, delete, or manual merge.
8. **Wishlist** - local wishlist for base games and DLC, target price, notes, already-available warning.
9. **DLC model** - DLC as children of base games; DLC sees deals but never play-next.
10. **ITAD price enrichment** - Steam App ID to ITAD ID, MX price queries, offer cards, freshness / stale labeling, buy recommendations.
11. **Compatibility synthesis** - ProtonDB, anti-cheat dataset, Steam Deck verified, per-environment practical status, personal override.
12. **Recommendation engine** - deterministic rule-based play-next and buy scoring with explanations and feedback.
13. **Today dashboard** - main game, in-progress games, play-next recs, recent Steam activity, wishlist deals, provider freshness.
14. **Dynamic visual theme** - theme from the featured game, light/dark/system, simple fallback, WCAG AA.
15. **Wallhaven desktop wallpaper** - SFW search, cached candidates, desktop only, never on mobile.
16. **Settings** - connected services, sessions, theme, wallpaper / reduced-data, refresh controls, JSON export.
17. **Backup and export** - on-demand JSON export and daily encrypted off-site backup rotation.
18. **Deployment and CI** - Vercel config, env review, smoke test, Verify command and CI.

## Data model

Derived from the PRD product model; the Prisma schema in `prisma/schema.prisma`
is the current ground truth and should track these responsibilities.

> Shapes that later features depend on: game type (BASE_GAME / DLC),
> availability sources, play state, main-game single flag, external identity by
> `(namespace, externalId)`, base-game-owned LibraryEntry, one WishlistEntry per
> game, and immutable recommendation runs.

### Auth (Auth.js, database sessions)

- `User` / `Account` / `Session` - standard Auth.js records for the one Google identity. No password, no roles.

### Settings and connections

- `AppSettings` (singleton, id=1) - theme, fixed environment (Bazzite / Steam Deck / Windows), price country MX, UTC-6 time zone, wallpaper and reduced-data preference, refresh settings.
- `SteamConnection` (singleton) - one SteamID64, connection state, last sync time and counts.

### Catalog

- `Game` (BASE_GAME or DLC) - name, origin (STEAM_IMPORT / MANUAL), optional `baseGameId` for DLC; a base game can have zero or more DLC.
- `ExternalGameId` - `(namespace, externalId)` identity, unique; namespaces STEAM_APP / RAWG_GAME / ITAD_GAME; match method.
- `MetadataSnapshot` - rebuildable provider payload, provenance, fetched/expiry, attribution.
- `PossibleDuplicate` - ordered symmetric game pair, evidence, confidence, status (OPEN / DISMISSED), reviewed time.

### Library and availability

- `LibraryEntry` (one per base game) - play state, main flag, priority, interest (1-5), rating (1-10), preferred environment, compatibility override, notes, play soon / replay / hidden flags.
- `GameAvailability` - source (STEAM / OTHER_PLATFORM / ROM), display name, Steam playtime and last-played for Steam rows.

### Wishlist and prices

- `WishlistEntry` (one per game) - local wishlist authority, interest, optional target price, notes.
- `PriceRefresh` / `DealOffer` - ITAD refresh outcome and returned offers (shop, country, currency, prices, discount, historical low, DRM, platforms, timestamps, expiry, unmodified URL, freshness). Only for Steam-backed wishlist entries.

### Organization and tags

- `Collection` (manual or system) / `CollectionMembership` - persistent manual membership; system collections are calculated with no rows.
- `PersonalTag` / `GameTag` - case-insensitively unique names, many-to-many to base games.

### Compatibility

- `CompatibilitySnapshot` - provider evidence (ProtonDB, anti-cheat, Steam Deck verified) with provenance and freshness.
- `EnvironmentCompatibility` - per-game practical status per environment (Bazzite / Steam Deck / Windows).

### Recommendations

- `RecommendationRun` / `RecommendationItem` / `RecommendationFeedback` - immutable run context, ranked items with score breakdowns and explanations, and feedback (Not now expiry / play soon / hide).

### Theme and operations

- `WallpaperState` - cached candidate metadata and selected index; no image binaries.
- `SyncRun` - provider, timing, status, counts, safe diagnostics.

## Tech stack

- **Next.js App Router** - pages, layout, server components.
- **React / TypeScript** - UI and type safety.
- **Turbopack** - dev and build bundler.
- **pnpm** - package manager.
- **Tailwind CSS v4 + shadcn/ui (Radix)** - styling and accessible primitives.
- **Prisma + Supabase PostgreSQL** - ORM and data store.
- **Auth.js (Google)** - single allowed-email authentication, database sessions.
- **Zod** - input validation on server boundaries.
- **Vitest** - unit tests (gate).
- **Playwright** - E2E (not a gate).
- **Vercel** - deployment host.
- **Off-site encrypted backups** - daily logical backup of irreplaceable tables.

## Monetization

Not in v1. Private single-user app, source-available under the PolyForm
Noncommercial License 1.0.0. No ads, subscriptions, or analytics.

## UI/UX

Look and feel: private responsive browser app; dynamic theme driven by the
featured main game with accessible light/dark/system modes (WCAG AA) and a
simple fallback; game artwork and optional wallpaper as decoration.

- `/` (sign-in landing) - Google sign-in gate.
- `/today` - main game, in-progress, play-next recs, recent activity, wishlist deals, freshness.
- `/library` - searchable grid / compact table, filters, sorting, bulk actions, manual creation, duplicate review.
- `/wishlist` - local wishlist and ITAD deal cards.
- `/games/[id]` - game detail with metadata, availability, play state, personal fields, compatibility, DLC, duplicate warning, recommendation explanation.
- `/settings` - connected services, sessions, theme, wallpaper, refresh controls, JSON export.

Desktop (up to 2560x1440): constrained width, persistent nav and filters,
multi-column. Mobile: bottom nav, single-column, slide-up filter sheet, 44px
touch targets, simple fallback background, no wallpaper.

## Deployment

- Host: Vercel (Next.js build / start).
- Database: Supabase PostgreSQL. Runtime uses the pooled `DATABASE_URL`; migrations use the direct `DIRECT_URL`.
- Env vars: `DIRECT_URL`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_GOOGLE_EMAIL` (per `.env.example`), plus future server-only `STEAM_WEB_API_KEY`, `ITAD_API_KEY`, `WALLHAVEN_API_KEY`.
- Jobs: scheduled daily Steam sync, ITAD price refresh, provider freshness, and Wallhaven candidate refresh.
- Backup: daily encrypted off-site logical backup of irreplaceable tables, retaining the 7 most recent.
- Migration: `prisma migrate deploy` before app start.
- Health check: app root.

## Open questions

- Verify the Supabase pooled vs direct connection setup for Vercel before feature 6 (Steam sync) and feature 18 (deploy).
- ITAD, RAWG, ProtonDB, and Wallhaven provider keys are not defined yet; adapters must keep the app usable when a provider is unavailable (design constraint throughout, but keyed in features 6-11, 15).
- No `verify` package command exists yet; only add one when feature 18 (Run `/ci`) defines it.

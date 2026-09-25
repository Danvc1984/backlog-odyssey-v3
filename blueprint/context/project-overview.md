# Backlog Odyssey - Project Overview

<!-- blueprint:source-hash 42e0aa14ace0e82f2aa539a5e3b3ac6931b6628231c988c34fc1182e72b89e3c -->

> A private, single-owner gaming library and explainable assistant for choosing what to play and buy.

## Problem

Ownership, prices, compatibility, metadata and personal decisions are fragmented across services. Backlog Odyssey consolidates them without becoming a launcher or storefront.

## Users

One authorized Google account; no public registration, roles or collaboration. Linux/Windows primary PC, optional Linux/Windows handheld, optional Windows fallback only with a Linux primary. Windows primary has no fallback. ITAD markets: Mexico, US, Canada, Brazil, Colombia, Argentina; display currencies MXN, USD, CAD, BRL, COP, ARS. Provider amounts stay authoritative; FX is visibly estimated presentation, never a ranking or purchase input.

## Features

Checked items record original delivery. Feature 38 supersedes conflicting historical recommendation behavior, not completion markers. The ad-hoc Play priority fix replaced owned-game Interest/Priority with one numeric field; Wishlist Interest stays independent.

1. **1-7a. Foundation** - authenticated shell, manual library, play state, collections, Steam linking/import/sync, duplicate review.
2. **7b-7c. Integrity** - transactional merge/delete, reload-safe Undo, name and availability editing.
3. **8. Historical RAWG foundation** - async enrichment, superseded by IGDB.
4. **9-10c. DLC/wishlist/prices** - linked DLC, wishes and acquisition, offers/targets, manual Steam wishlist import and review.
5. **11. Compatibility** - ProtonDB/AWAY, Linux gates, derived fallback, separate wishlist evidence.
6. **12. Recommendations** - Play Next/Buy runs, profiles/preferences, Tune, batches, exposure, calibration.
7. **13. Today** - current games, progress, data health, cached Steam activity, offers, operations.
8. **14-15. Visual foundation** - prototype tokens, accessible themes, responsive shell, route composition.
9. **16-17. Artwork** - Wallhaven, palettes, screenshots; provider is IGDB.
10. **18-22. Operations/setup/polish** - export/restore, OS onboarding, Dawn/Sunset, Cinzel/Inter, icons, voice, handheld suitability and rescue.
11. **23a-23d. IGDB** - identity, catalog metadata, playtime, wishlist enrichment.
12. **24-27. Catalog renewal** - DLC browsing/acquisition, ingestion defaults, IGDB Add Game, shelves.
13. **23e. Provider retirement** - IGDB engine re-key, RAWG removal, clean restart.
14. **28-29. Recommendation UX** - tab-local Tune, roles, spotlights, ten-second carousels, unified replacement.
15. **30. Completion history** - independent current/prior completion, replay consumption, deduplicated learning.
16. **31-32. Personal data/grouping** - no notes/source labels, Settings-only sources, tags replace collections.
17. **33-35. Presentation** - sign-in demo, Welcome regions/Steam option, Today/detail renewal, mobile pass.
18. **38. Contextual recommendation renewal (pending):**
    - **38a. Signal provenance and clean-start contracts:** new origins/dates, versioned derived data, current-only export/restore. Owner resets dev DB; no legacy conversion or automatic wipe.
    - **38b. Contextual ranking:** stable taste, recent context, priority, backlog-aware Buy, diversity, property tests.
    - **38c. Stable runs and reversible feedback:** neutral rotation, pauses/exclusions, Undo, revalidation, race safety.
    - **38d. Optional Taste Setup and truthful Tune:** no gates, honest history, flexible duration, counts, explanations.
    - **38e. Completion and reset:** optional rating invitation, clearer history, confirmed recommendation-only reset.
    - **38f. Acceptance:** reviewed/reserved comparisons plus real UI flows.
19. **39. Deployment/CI (pending)** - Vercel/Supabase readiness, protected cron, production checks, Verify. Last planned milestone.

## Data model

Personal fields are authoritative; provider evidence is replaceable. Pending shapes are intent, not claims they exist.

### Catalog and identity

- **Game** - catalog-only; ID, name, immutable origin, `BASE_GAME | DLC`, nullable `baseGameId` required for DLC. No library entry or play state.
- **LibraryEntry** - per base game: `playState: NOT_STARTED | IN_PROGRESS | COMPLETED | ABANDONED`, independent `completedBefore`, main/hidden/play-soon/replay flags, nullable `interest: 1..5` labeled Play priority, personal rating 1-10, experience, handheld suitability, compatibility override. No separate priority enum. Feature 38 records known new signal origins/dates; never infer them from value or `updatedAt`.
- **GameAvailability** - many per game; Steam/ROM or OTHER_PLATFORM with a reusable source. Steam App ID, playtime totals and last-played are provider facts, not enjoyment.
- **AlternativeSource** - canonical/normalized unique name, known-source key, archive date. No per-game label.
- **ExternalGameId** - namespace/ID/provenance/game; confirmed Steam identity enables lookups.
- **PersonalTag/GameTag** - trimmed case-insensitive uniqueness, displayed capitalization preserved; every tag creates a shelf. No manual Collection model.
- **PossibleDuplicate** gates base-game merge. **CatalogOperation** - actor, affected IDs, minimal snapshot, roughly 15-second reload-safe Undo, no overlapping ops.

### Wishlist, providers, offers

- **WishlistEntry** - independent; base/DLC type with owned `baseGameId` required for DLC, Interest, experience, handheld suitability, optional target, Steam ID/provenance. No provisional Game or notes. Feature 38 records Interest origin/date.
- Acquisition creates Game/availability, transfers IGDB and Interest into Play priority, removes the wish; DLC acquisition creates linked DLC without a library entry.
- **IGDB snapshots** - replaceable: summary, genres/themes/keywords, companies, release date, ESRB, attributed ratings with counts, websites, alt names, collections/franchise, relations, modes, cover/artwork/screenshots, derived palette. Store URLs, not binaries. Wide-image order: artwork, screenshot, cover, local fallback.
- **PlaytimeEvidence** - IGDB hastily/normally/completely plus sample count; SteamSpy fallback only without an IGDB row and with confirmed Steam ID. Duration profile selects display/engine estimate. SteamSpy is not a completion-time promise; RAWG duration is unused.
- **Offers/refreshes** - exact source currency/amount, seller URL, discount, timestamps, selected/alternatives, warnings. Keep the cheapest 8-10 valid; cheapest comparable wins; stale after 48 hours retains evidence without fresh signal. Historical low is display context; FX never changes selection or targets.
- **Import reviews/ignores/unresolved DLC** - conservative persistent review; names never auto-link; owned entries omitted; unresolved DLC is wishlist-only.

### Compatibility and operations

Separate catalog and wishlist snapshots/synthesis use confirmed Steam identity, ProtonDB/AWAY, source links, timestamps and 180-day freshness. Catalog personal Linux overrides are authoritative; wishlist has none. Windows fallback derives only with Linux primary and configured fallback. Compatibility is active only with a Linux primary or handheld; all-Windows shows no compatibility UI or work; ROM-only is not applicable; cards distinguish evidence, unknown, stale, absent; wishlist DLC has no separate flow. Stale evidence stays visible with a warning, never a staleness penalty.

Persistent PostgreSQL jobs cover Steam, IGDB, prices, compatibility and wallpaper with progress, retries, overlap protection and visible failure; failure preserves personal and last-valid provider data. Steam import queues IGDB; manual sync does not; successful IGDB triggers compatibility when applicable.

**AppSettings** - devices/onboarding, market/currency, duration profile, timezone, visual and provider controls (non-migrating preferences). **WallpaperState** - roughly ten SFW cached URLs, daily deterministic selection, shuffle, on-use stale refresh; no binaries, none in reduced data.

### Recommendation data and recovery

- **Run/Item** - PLAY_NEXT or BUY, context, roles, scores, reasons, batches; 12-month retention. Feature 38 versions semantics, stabilizes reloads, revalidates eligibility, varies only qualified near-equal picks.
- **Event/Profile** - append-only events; rebuildable genre/tag/experience/duration/publisher/era/series/maturity. Retention: exposure 90 days; starts/dismissals 12 months; completion/abandonment/setup 24 months. Feature 38 separates stable/recent evidence and deduplicates.
- **Preference** - PREFER/NEUTRAL/AVOID. **Preset** - named Tune. Active Tune is tab-local, survives reload, clears on close, applies only via Update.
- **38 feedback** - Show another is exposure/rotation only; Not for now pauses one engine 15 days; Not interested excludes until reversed; immediate Undo and management, no star changes or related penalties.
- **38 reset** - confirmed deletion of recommendation-owned runs/items/events/answers/profiles/feedback/preferences/presets/Tune/pauses/exclusions, including tab-local Tune. Personal fields, wishes, offers and provider evidence survive; runs can relearn from them.
- **38 clean start** - owner restarts the dev DB; no conversion, backfill or old exports; code must never auto-reset. Current-version export/restore preserves personal data and provenance.

## Product rules

### Catalog and lifecycle

Single-owner authorization at every protected entry point; server-side credentials, never exported. DLC stays out of Library/counts/play roles; ownership is explicit per-game acquisition via an ephemeral unchecked list with disabled owned/wishlisted badges; catalog DLC requires its owned base. Leaving COMPLETED activates `completedBefore`; starting that replay consumes replay intent. COMPLETED counts complete, NOT_STARTED/IN_PROGRESS active, ABANDONED excluded; prior completion never double-counts; Previously completed may overlap replay shelves. Sources are administered only in Settings; game surfaces assign/remove saved sources and link there without preserving drafts; archived assignments stay marked/removable, not reassignable; Change platform is Game Detail-only; Library Delete keeps confirmation/Undo. Tag merge confirms collisions, unions membership and updates active presets; delete removes memberships/references; historical run names stay recorded; shelves sort alphabetically by default or by count; personal-tag Tune is distinct, inactive, soft/capped/any-match.

### Feature 38 recommendation target

Current delivered gates/calibration stand until their sub-feature changes them; target is optional Taste Setup, no ten-game threshold, honest sparse-data language, no Buy for an empty wishlist. Balance taste, recent play, priority, play-soon, Tune and fit; no blanket short-game bias; priority is strong, not absolute; positive preferences cannot reduce scores; correlated evidence is bounded without discarding positives; missing/stale/weak evidence is uncertainty, not dislike. Rating and explicit more-like-this outrank completion; start/playtime is not enjoyment; historical completion is not recent activity; current/prior completion deduplicate; abandonment is distinct negative evidence; played-only answers never write completion (38d asks Completed before or records played-only). Linux without fallback may hard-exclude fallback-needing Play candidates except handheld-suitable games on a Windows handheld; Buy gets a heavy penalty/caveat instead; all-Windows has no compatibility scoring; handheld qualification persists. Favor coherent variety, not forced slots or negative judgments of redundant candidates; Familiar leans to continuity, Different explores without favoring negative affinity; fewer roles beat filler; explain exhausted pools; stored reproducible rotation, never alphabetical/reload-random; cooldown matters in short pools. Buy weighs genuinely usable similar owned alternatives, ignoring hidden/unavailable/finished games unless replay is intended; explicit desire may outweigh overlap; DLC uses owned-base context; distinguish buy-now fit, owned-alternative-first and insufficient evidence; a discount never justifies poor fit or expired offers. Tune keeps strict handheld-only/known conflicts; unknown modes are visibly unverified; duration is a strong flexible preference with outside-range disclosure; other filters stay soft; count eligible games separately from soft matches and unknowns; avoid misleading zero-match/per-card caveats. Explanations lead with one brief decisive reason, optional caveat and expandable facts; never infer enjoyment from starting/completing or claim ease without evidence; attribute estimates. A split button defaults to Show another; menu offers Not for now/Not interested; replace only that slot from its run or remove with explanation; revalidate acquired/hidden/started/ineligible targets and expired offers; protect retries/cross-tab races; context changes invalidate only incompatible picks; field changes affect new runs, not silent replacement. Explicit Update rebuilds profile and both runs; Rebuild profile, if kept, lives in Diagnostics and never refreshes displayed runs; completion may invite a nonblocking 1-10 rating; total reset names what it removes. Cover ranking, provenance, correlated signals, sparse/short pools, exposure/rotation, Tune, compatibility, DLC scale, owned alternatives, feedback races and reset/restore with fixed-input/time tests; compare reviewed/reserved scenarios and verify real UI flows before shipping.

## Tech stack

Next.js App Router, React, TypeScript, pnpm, Tailwind v4, shadcn/ui, Prisma, PostgreSQL/Supabase, Auth.js/Google, Zod, Vitest, Vercel. Providers: IGDB/Twitch, Steam/SteamSpy, ITAD, Frankfurter v2, ProtonDB, AWAY, Wallhaven. No LLM/hosted recommender, session tracking or mood inference.

## Monetization

None: private single-owner tool.

## UI/UX

Dark-first Sunset default; Dawn/Sunset each support light/dark/system with family-owned hues. Cinzel display, Inter body, monospace evidence; prototype tokens, accessible contrast/focus/targets, desktop sidebar/mobile nav, explicit loading/empty/invalid/error/stale states. Odyssey voice is expressive only; statuses/errors/evidence/help stay factual. Reduced motion disables automation; reduced data blocks remote art/wallpaper with token fallbacks.

- `/` signed in - carousels for current games and offers, explicit recommendation spotlights, coverage, activity, freshness/operations; no automatic sync/enrichment/runs; Steam activity cached 24 hours may show unimported titles without importing; spotlights advance every ten seconds, pause on interaction, detail-first actions.
- `/` signed out - primary sign-in plus decorative demo; tagline "Turn your gaming backlog into your next adventure"; demo below sign-in on mobile.
- `/library` - grid/list, search/filter/pagination, Play priority stars, Delete/Undo; narrow screens are grid-only with collapsible health strip.
- `/games/[id]` - hero/links, details, Journey/Preferences, tags, platforms, DLC, compatibility, artwork, delete; combined title/IGDB maintenance; info popovers; mobile-reachable menus.
- `/wishlist`, `/wishlist/[id]` - base/DLC wishes, Personal fit, identity/target/offers, evidence, edit/acquire/delete; offer provider links externally; narrow grids, collapsible strip.
- `/collections` - tag management/shelves plus read-only system/series shelves; mobile detail cards.
- `/welcome` - OS, region/currency, duration/theme, optional Steam connect and taste invitation; skip/cancel/failure never blocks; feature 38 removes the taste threshold.
- `/settings` - session/environment, region/currency with refresh warning, visuals/sources/Wallhaven, provider retry/progress, diagnostics, export/restore.

## Deployment

Vercel plus Supabase/PostgreSQL, server credentials, persistent queues. IGDB: cached Twitch tokens with proactive refresh, 4 rps, max eight concurrent, 10-second timeout, Retry-After. Exact Steam/high-confidence search fixes identity; ambiguous/incompatible categories stay reviewable; manual choices persist. Wishlist auto-enrichment is fill-only; explicit replacement warns. Attribute providers near content and in credits.

Feature 39 schedules daily 06:00 UTC-6 Cron with `CRON_SECRET` enqueueing prices plus catalog/wishlist compatibility older than 180 days; compatibility no-ops without Linux; idempotent claims with overlap protection. No automatic full Steam sync, off-site backups or deployment in earlier features.

Export excludes rebuildable provider/activity snapshots, connections and credentials. Current-version Zod import refuses nonempty catalog/wishlist, restores atomically, queues no provider work; enrichment rebuild is manual. Feature 38 rejects previous exports and uses owner-managed clean restart, never automatic migration/reset. Production env inventory, health/domain, smoke checks and Verify are feature 39 decisions; local commands live in AGENTS.md, and absent CI does not block planning.

## Open questions

- Historical 10b says cron in feature 24; deployment is now 39. Preserve checked scope; treat that stale cross-reference as history.
- Older prose says Mexico-only prices, 5-point DLC base rating scale and played-before meaning completion. Features 34 and 38 supersede explicit conflicts; 38b must use the actual 1-10 rating scale.
- Older defaults prose says manual creation starts 3/5; the shipped Play priority fix presents Unset. 38a preserves observed behavior rather than silently changing defaults.
- Playtime queueing is called a future decision despite completed 23c. Preserve shipped behavior unless explicitly changed.

# Backlog Odyssey - Project Overview

> Private, single-user gaming library and decision assistant for choosing what
> to play and buy in Mexico across a self-configured setup of Linux or Windows
> desktops and handhelds.

## Product, user, and boundaries

Backlog Odyssey consolidates ownership, personal catalog state, prices,
compatibility evidence, metadata, and explainable recommendations. It is not a
launcher, storefront, or automatic purchasing tool.

The MVP serves one authorized Google account on a setup the owner configures at
first login: one primary OS (Linux-based or Windows) and an optional handheld
running Linux (e.g. Steam Deck) or Windows (e.g. ROG Ally). A Windows fallback
is optional - it exists only when the primary OS is Linux and the owner has a
Windows machine; the fallback OS is always Windows when one exists, and a
Windows primary has no fallback. Mexico pricing and UTC-6 are the defaults.
Public registration,
collaboration, automatic Steam synchronization, notifications, webhooks,
PWA/offline behavior, and automatic non-Steam account-library imports are
outside scope. Alternative stores remain manual availability sources unless
they offer a supported account-library API.

Personal intent and explicit catalog choices are authoritative. Provider data
from Steam, IGDB, SteamSpy, ITAD, ProtonDB, AWAY, and Wallhaven is replaceable
evidence: it never silently overwrites local data. IGDB is the primary
metadata, artwork, and playtime provider, fully replacing RAWG as part of
feature 23; SteamSpy is the duration-only fallback. Provider work is
persistent, asynchronous, rate-limited, retryable up to three times, and
failures preserve the last usable data.

## Build order

The exact checked state is owned by blueprint/build-plan.md.

1. **[x] 1-6: Foundation, catalog, and Steam** - Auth, manual library, game
   detail, personal state, collections, Steam linking, and explicit sync.
2. **[x] 7a-7c: Catalog integrity** - Duplicate review, conservative
   merge/delete with short-lived Undo, and safe editing.
3. **[x] 8a-8e: RAWG enrichment** - Matching, versioned snapshots, asynchronous
   queues, post-import enrichment, ESRB, and series evidence.
4. **[x] 9: DLC review model** - Explicit base-game ownership and shared
   unresolved-Steam-DLC review queue.
5. **[x] 10a-10c: Wishlist and pricing** - Independent base/DLC wishes,
   acquisition, identity provenance, Mexican offers, target opportunities, and
   conservative manual Steam wishlist import.
6. **[x] 11-11d: Compatibility and wishlist detail** - Linux evidence with a
   Windows fallback, catalog and wishlist queues/sweeps, and wishlist detail.
7. **[x] 12-12e: Recommendations** - Explainable Play Next and Buy runs,
   adaptive profile/calibration, role diversity, reusable alternative sources,
   and inclusive source tuning.
8. **[x] 13-13b: Today functional dashboard** - Progress, coverage, cached
   recent activity, latest explicit recommendations, offers, and operations.
9. **[x] 14a-14f: Visual foundation** - Prototype-validated tokens, dark/light/
   system parity, non-migrating visual preferences, Today/Library/Wishlist/
   header rework, cross-app accessibility acceptance, and detail-route
   composition in Feature 15.
10. **[x] 15-16: Supporting routes and Wallhaven** - Shared treatment for Game
    Detail, Wishlist Detail, Collections, and Settings, plus the optional
    cached Wallhaven background with rotation, shuffle, attribution, fallback,
    and reduced-data hard-off.
11. **[x] 17a-17d: Per-game themes and screenshots** - Derived palettes and up
    to six screenshots captured during enrichment, hero-band themes with
    decorative accent tints on game detail and wishlist detail, and a dedicated
    screenshots carousel. Built on RAWG evidence at the time; feature 23
    re-points the sources to IGDB.
12. **[x] 18a-18c: Settings, export, and restore** - Consolidated Settings
    surfaces, versioned personal-data JSON export, and empty-schema-only
    import in one all-or-nothing transaction.
13. **[x] 19a-19d: OS setup, onboarding, and environment-aware behavior** -
    First-login onboarding capturing the primary OS, optional Windows
    fallback, and optional handheld (trivial path on all-Windows setups,
    ending with an optional taste-setup offer); Linux-gated compatibility
    flows with per-setup and per-game display gating; OS-aware play
    recommendations with the no-fallback play-role hard exclusion; buy picks
    taking the practical-fit penalty plus caveat instead; setup-adapted
    environment fields; Settings setup changes confirm, then immediately
    re-derive compatibility and synchronously regenerate runs.
14. **[x] 20a-20g: Odyssey theme expansion** - Shipped: the 20a prototype
    lock (Sunset mapping and Cinzel/Inter pairing owner-confirmed 07 Sep
    2026), Dawn/Sunset palette families with the Settings family selector,
    Cinzel/Inter typography, official brand icons with the dragon identity
    mark, the Odyssey voice sweep (20e), the Phosphor UI icon swap (20f),
    and cross-app acceptance (20g).
15. **[x] 21a-21e: Pre-deployment polish and improvements** - Shipped,
    one sub-feature per app section: global visual fixes (theme-aware
    favicon, glow removed except above-threshold offers, sidebar
    minimize/maximize); Today (focus carousel over main and in-progress
    games, wallpaper control restored, recent-activity fixes with image
    backgrounds, natural-language reasoning chips, no generated card
    descriptions, visible Tune header, no-fallback message validation,
    data-health and freshness corrections); Library (18/48/99 page sizes,
    detail-style edit and change-state with scroll effect, metadata warning,
    clearer main-game selector, ProtonDB tag gating on all-Windows setups);
    Wishlist (page sizes inside the shared pagination bar, ITAD link,
    discounted-games counter, discount sorting, library-style search,
    warning-colored missing-metadata note); Settings and onboarding
    (section regrouping, hydration fix, welcome theme choice, Steam-name
    symbol cleanup at import).
16. **[x] 22a-22b: Handheld suitability flag and handheld-aware
    recommendations** - Shipped and archived: owner-marked handheld-suitable
    personal flag on catalog and wishlist entries (mirroring gameExperience);
    handheld-fit factors with visible explanations where the setup has a Linux
    handheld, including compatibility framed for the handheld target on
    Windows-primary setups; the Windows-handheld rescue lifting the no-fallback
    hard exclusion for flagged games with a visible explanation while
    non-flagged games keep the heavy practical-fit penalty.
17. **[ ] 23a-23e: IGDB as primary metadata, artwork, and playtime provider** -
    Full RAWG replacement: IGDB client and identity foundation (Twitch token
    cache, 4 rps / max-8-concurrent rate limiting with Retry-After, Steam App
    ID resolution through `external_games`, high-confidence fuzzy matching and
    persistent manual replacement); catalog IGDB snapshot with artwork,
    palettes, screenshots, three rating fields,
    collections/relations, and game modes; playtime evidence
    (`game_time_to_beats` primary, SteamSpy median fallback, RAWG playtime
    nowhere); three duration profiles across Welcome/Settings/Library/Wishlist
    and recommendation scoring; editable, automatically applied IGDB App IDs
    replacing `storesearch`; engine re-derivation and RAWG retirement
    with a documented clean-restart procedure (personal export, wipe,
    empty-schema restore, Steam re-import, IGDB enrichment).
18. **[ ] 24: Deployment and CI readiness** - Vercel/Supabase, Cron covering
    prices plus the compatibility freshness sweep (a no-op while compatibility
    is inactive), smoke tests, Verify command, and automatic checks.

## Data model and ownership

The exact schema lives in prisma/schema.prisma. These are the stable product
boundaries.

### Identity, operations, and catalog

- User, Account, and Session provide one-user Google authentication.
- AppSettings holds the owner-configured OS setup - primary OS
  (`LINUX`/`WINDOWS`), an optional Windows fallback (`hasWindowsFallback`,
  only offered when the primary is Linux), optional handheld OS
  (`NONE`/`LINUX`/`WINDOWS`), and onboarding completion - captured at first
  login and editable in Settings. The derived fallback is Windows only when
  the primary is Linux and the owner has a Windows machine; it is absent
  when the primary is Windows or no Windows machine exists. Changing the
  setup in Settings requires a confirmation dialog and then immediately
  re-derives compatibility synthesis and synchronously regenerates
  recommendation runs (normal run semantics: fresh run record, retained
  batches, exposure cooldowns; it replaces the previous tuned run). Feature
  14 visual preferences use a non-migrating mechanism and include the
  Dawn/Sunset family selector (shipped in 20b); provider, export, and import
  controls live in Feature 18.
- SteamConnection, SyncRun, EnrichmentJob, PriceRefresh, and sweep/run records
  persist status, retry timing, counts, and safe diagnostics.
- SteamRecentActivityCache holds a 24-hour narrow activity result. It may show
  unimported titles but never imports or links catalog records.
- Game is catalog-only and represents a base game or DLC. LibraryEntry holds
  personal play state, main game, priority, interest, rating, environment,
  game experience, notes, replayCandidate, hidden state, and a nullable
  handheld-suitable flag (shipped in 22a).
- ExternalGameId stores provider identities and provenance. GameAvailability is
  separate from origin, provider IDs, compatibility, and offer sellers.
- Steam and ROM are built-in availability kinds. Other platform availability
  references reusable AlternativeSource, which has a normalized name, optional
  known-source key, icon metadata, and archive state. No source is inferred
  from legacy free text.
- MetadataSnapshot is replaceable provider data with attribution. Feature 23
  re-points it to an IGDB-shaped snapshot with a clean restart and no legacy
  RAWG tolerance: summary, genres/themes/keywords, involved companies, first
  release date, ESRB age rating, separate IGDB `aggregated_rating`, community
  `rating`, and `total_rating` scores with sample counts, official website,
  alternative names, collections/franchise plus explicit
  DLC/expansion/remake relations and game modes as series/structural evidence,
  artwork and screenshots at named IGDB image sizes, and the derived palette
  (re-derived on re-enrichment). Compact cards use cover art; wide surfaces
  fall back from artwork to screenshot, cover, then deterministic local art.
  PossibleDuplicate records review evidence. CatalogOperation enables scoped,
  reload-safe Undo for merge and delete.
- Playtime evidence (feature 23) is replaceable, attributed IGDB
  `game_time_to_beats` / SteamSpy data keyed by the confirmed Steam App ID.
  It stores main (`hastily`), main-plus-extras (`normally`), and completionist
  (`completely`) estimates. SteamSpy is fetched only when IGDB has no row.
  RAWG `playtimeHours` is used nowhere: not a fallback, not displayed.

### Wishlist, pricing, compatibility, and recommendations

- WishlistEntry stays independent from Game until explicit acquisition. It is an
  unowned base game or an unowned DLC linked to an owned base game, carrying
  the shared personal fields including the handheld-suitable flag.
- WishlistMetadataSnapshot is independent IGDB evidence following the same
  contract for base-game wishes. UnresolvedSteamDlc, WishlistImportReview,
  and WishlistImportIgnore preserve manual review across owned sync and
  wishlist import.
- DealOffer keeps valid Mexican offer alternatives. ItadIdentity caches
  Steam-App-ID-to-ITAD mapping. The selected offer is the cheapest valid Mexican
  offer, never one based on seller preference.
- Target price is optional. Fresh target hits create opportunity signals;
  historical low is display-only. Offers stale after 48 hours cannot create a
  strong opportunity signal. Wishlist Steam App ID suggestions derive from
  IGDB `external_games` (the RAWG store-links and `storesearch` paths are
  retired in feature 23).
- CompatibilitySnapshot and EnvironmentCompatibility hold catalog evidence and
  WishlistCompatibilitySnapshot and WishlistEnvironmentCompatibility hold the
  parallel, read-only wishlist copies keyed to wishlist entries. The
  `Environment` enum is `LINUX` (migrated from BAZZITE), `STEAM_DECK`, and
  `WINDOWS`. Evidence is active only while the configured setup includes a
  Linux device; personal overrides apply to the Linux evidence only.
- RecommendationRun, RecommendationItem, RecommendationFeedback,
  RecommendationEvent, RecommendationProfile, RecommendationPreference, tune
  state, and presets are recommendation-owned. Reset removes these only,
  preserving catalog and provider data. All of these are export/import data in
  Feature 18, restoring only into an empty schema.
- PersonalTag, GameTag, Collection, and CollectionMembership organize games.
  WallpaperState stores Wallhaven URLs and selection only, never image
  binaries.

## Product rules

### Steam, catalog, and wishlist

- Base-game delete explicitly lists and cascades DLC. Merge combines compatible
  relationships, surfaces conflicts, and never silently deletes equivalent DLC.
- Steam import and sync are manual. Initial import queues IGDB work; later sync
  does not. Recent activity is a separate cache, never a hidden sync/import.
- ROM-only games are compatibility not applicable, not unknown. Mixed-source
  games may still receive Steam-keyed evidence.
- A wish is priceable only with confirmed identity: Steam import, a
  user-confirmed Steam URL/App ID, or an IGDB-derived App ID automatically
  applied from a fixed identity (`external_games`). Provenance is visible and
  the identity remains editable.
- One explicit global Wishlist price action queues confirmed identities,
  prevents overlap, and reports refreshed, failed, and identity-required items.
- ITAD is server-side, read-only, country=MX, batched, cached, and respects
  rate limits. The seller page is authoritative for activation; key stores warn
  that Mexico activation must be checked.
- Playtime estimates come from IGDB's `game_time_to_beats` (hastily, normally,
  completely plus sample count) with the SteamSpy median as the only fallback
  when IGDB has no row and an App ID exists. `hastily` is history main,
  `normally` is history plus extras, and `completely` is completionist; the
  selected global duration profile controls default display and duration
  scoring. RAWG's separate extra line disappears. RAWG playtime
  is not a fallback and is retired from duration derivation and estimates
  display. Estimates are replaceable, attributed evidence keyed by the
  confirmed Steam App ID; games without provider rows show unknown duration,
  like any other missing provider evidence. Duration stays soft evidence.
- IGDB identity: catalog games resolve through `external_games` (uid = Steam
  App ID); entries without an App ID use normalized fuzzy search with
  ambiguous-candidate behavior. IGDB rate limits are 4 requests/second with a
  maximum of 8 concurrent requests; exceeding them returns 429 with
  Retry-After, handled like ITAD.

### OS setup, compatibility, and recommendations

- The OS setup is captured at first login through an onboarding gate and stays
  editable in Settings. It is the single source for environment semantics:
  which devices exist, which run Linux, and whether a Windows fallback
  exists. All-Windows onboarding is the trivial path with no compatibility
  explanation step; onboarding ends with an optional start-now / not-now
  taste-setup offer (the import-flow entry point is unchanged).
- The compatibility pipeline (ProtonDB and AWAY evidence, post-IGDB auto-queue,
  global sweeps, per-game refresh, ProtonDB card tags, and catalog/wishlist
  compatibility sections) is active only while the primary OS or the handheld
  is Linux. All-Windows setups see no compatibility flow anywhere, rendering
  no compatibility UI at all; the deployment cron's sweep becomes a no-op.
- Compatibility display is gated per setup and per game so it appears only
  when it makes sense: active Linux setups show full UI for confirmed-App-ID
  non-ROM base games; catalog games without a confirmed App ID get only the
  detail-page "add Steam App ID" affordance (cards show no tag, not a hollow
  placeholder); wishlist entries without confirmed identity and DLC wishes
  show nothing. Card tags use four distinct states - evidence,
  unknown/not-checked, stale (its own state, past the 180-day window), and
  absent - while detail pages keep richer freshness treatment.
- Changing the OS setup (primary OS, fallback flag, or handheld) in Settings
  shows a confirmation dialog, then immediately re-derives compatibility
  synthesis and synchronously regenerates recommendation runs. The re-run
  uses normal run semantics (fresh run record, retained batches, exposure
  cooldowns) and replaces the previous tuned run.
- ProtonDB and AWAY remain separate attributable evidence keyed by a Steam App
  ID and represent Linux playability for any Linux device - there is no
  separate per-device Linux layer. Windows is derived from that evidence only
  when the primary OS is Linux and a Windows fallback is configured; the
  fallback OS is always Windows when one exists, and it is absent when the
  primary is Windows or the owner has no Windows machine. When no fallback
  exists, evidence that would otherwise recommend the Windows fallback marks
  the game as not practically playable on this setup. This rule is stated
  consistently across the
  app.
- A single 180-day freshness rule keeps stale values visible and warns
  recommendations instead of excluding a game.
- Play Next considers non-hidden, non-main base games that are not started or
  replay-flagged played/abandoned games. In-progress titles belong to Today;
  DLC does not enter Play Next. Buy considers base wishes and eligible DLC
  wishes; ROMs never enter Buy.
- Interest is durable taste; catalog priority is short-term Play Next urgency.
  Compatibility and metadata are soft, explainable evidence, not hard gates,
  with two sanctioned exceptions. On all-Windows setups compatibility
  contributes no factors, floors, or caveats, and environment fit derives
  from the configured devices. First exception: on a Linux setup without a
  Windows fallback, fallback-needing evidence (denied/broken anti-cheat,
  not-playable Linux, or unknown Linux evidence where a READY floor applies)
  hard-excludes the game from all play roles with a visible, explained
  reason; a play role left empty is absent from the run. Second exception
  (feature 22b, shipped): that no-fallback exclusion does not apply to a game
  the owner flagged as handheld-suitable when the setup includes a Windows
  handheld - the game remains playable there and the explanation says so;
  non-flagged games keep the heavy practical-fit penalty. The same evidence
  class never hard-excludes from Buy or wishlist discovery - there it is a
  heavy practical-fit penalty plus caveat, never exclusion.
- The handheld-suitable flag is soft personal evidence: a handheld-fit boost
  or caveat where the setup has a Linux handheld (compatibility framed for
  the handheld target on Windows-primary setups), visible in explanations,
  never an eligibility gate by itself.
- Recommendation metadata evidence comes from IGDB: genres, themes, keywords,
  release era, publisher, sequel relationship where confidently known
  (collections plus explicit structural relations; franchise as broader
  context), ESRB context when available, and separate Steam-based and IGDB
  community ratings with sample-size confidence. Publisher, release-era,
  quality, series, genre/tag, duration, and mature or casual context are soft
  evidence only; sparse provider data, low rating counts, or uncertain series
  links lower confidence rather than fabricating preference.
- Source tuning is an inclusive, modest Play Next boost. It does not exclude
  eligible games, affect Buy, or influence seller/offer selection.
- Play Next provides two Best Fit roles, Out of the Box, and Change of Pace.
  Buy provides Best Fit and deal roles under the documented deal-saturation
  rule. No alphabetical tie-break decides a displayed game.
- Today renders the latest play-next run's stored roles (two best-fit, one
  qualified out-of-the-box, one change-of-pace) and the latest buy run's stored
  roles (best-fit and deal picks per the saturation rule); these remain the
  latest explicitly generated runs.
- Show another rotates retained candidates without a new run. Exposure is a
  temporary cooldown, never negative feedback. Start playing marks a game
  in progress and follows the existing main-game decision; it never launches a
  game.

### Themes, voice, and icons (Features 17, 20, and 23)

- Per-game themes derive server-side during IGDB enrichment (feature 23
  re-points the RAWG-era source) and apply read-only as a hero band plus
  decorative accent tints (headers, borders, chips, dividers). Semantic tokens
  stay untouched; contrast overlays, deterministic fallbacks, and
  reduced-data behavior apply.
- IGDB screenshots render as a dedicated bottom carousel-style section on
  game detail and wishlist detail (base-game wishes), separate from the
  metadata block, with attribution and reduced-data token fallback.
- Theme families are Dawn (cyan/purple) and Sunset (orange/yellow), each in
  light and dark - four selectable palettes over the feature-14 token
  architecture, shipped in 20b with the Settings family selector. Each family
  owns the hue mapping for the semantic roles (interactive, deal/opportunity,
  warning, danger), contrast-validated per palette; roles stay stable
  app-wide. System mode resolves light/dark within the selected family.
- Typography pairs Cinzel (display) with Inter (body), shipped in 20c;
  technical monospace evidence labels are unchanged. The pairing and the
  Sunset mapping were owner-confirmed at the 20a prototype (07 Sep 2026).
- The Odyssey voice sweep covers expressive surfaces only - page and section
  headers, empty states, buttons, dashboard moments, and dialogs - mixing
  subtle allusion with named mythology. Statuses, errors, evidence labels,
  freshness, field help, and caveats stay plain and factual. Navigation and
  section names keep their identity. The sweep shipped in 20e.
- Official brand icons are shipped (20d): known availability sources render
  their official SVGs from `public/` via the code-owned `brandIcon` field;
  ROM keeps `Disc3` and custom sources keep the neutral `Box` fallback. The
  dragon icon is the app's identity mark (favicon and nav brand), and the
  ITAD icon marks the offers source. The general UI icon set swap shipped in
  20f as the Phosphor set; a later premium set remains a post-MVP swap.

## Today and visual direction

Today is the post-login decision dashboard. It recalculates local summaries but
never silently starts sync, enrichment, price, compatibility, or recommendation
work. It keeps active-backlog progress, coverage dialogs, latest explicit runs,
cached recent Steam activity, offers, freshness, and operation states.

### Feature 14 Today composition

The first viewport is two equal, independently useful carousels:

- Currently playing leads with main game then in-progress titles, offers
  local context, and links to Game Detail. It never claims to resume or
  launch.
- Featured offers renders up to three items from the existing Today offer
  ranking, preserving discount/target/price ordering, returned currency, store,
  freshness, wishlist detail, and seller links.

Both carousels have visible manual navigation, position, keyboard
access, slow discreet auto-advance, and pause on hover/focus. In reduced motion
they are manual. Contextual empty states can link to existing actions but
cannot trigger hidden provider work.

Play Next is the largest independent section: a primary Best Fit card takes
roughly two thirds of the layout and exposes stored explanations, factors,
caveats, compatibility/source context, and Start playing. The compact rail
carries all remaining stored roles: second Best Fit, Change of Pace, and Out of
the Box. Buy remains a full lower section; recent activity, data health,
freshness, and operations are supporting sections.

## Routes

- / - authentication landing.
- /welcome - first-login onboarding capturing the OS setup (primary OS,
  handheld, handheld OS) behind an onboarding-completion gate, ending with
  an optional taste-setup offer.
- /today - decision dashboard, coverage dialogs, recommendations, recent Steam
  activity, offers, provider freshness, and operations.
- /library - searchable catalog, source filters, manual creation, duplicate
  review, and catalog enrichment, with grid/list presentation.
- /games/[id] - personal fields, availability, metadata, screenshots,
  derived-palette themed surfaces, compatibility, DLC, duplicate/recommendation
  context, and IGDB actions.
- /wishlist - independent wishes, IGDB metadata, identity, global price
  refresh, opportunities, Steam import/review, and acquisition, with
  focus/list presentation.
- /wishlist/[id] - metadata, screenshots and themed surfaces for base-game
  wishes, identity/provenance, offers, target, notes, interest,
  acquire/edit/delete, compatibility, and fill-only enrichment.
- /collections and /collections/[id] - collections and existing forms/dialogs.
- /settings - sessions, OS preferences (edited through a confirmation dialog
  that precedes immediate re-derivation), recommendation profile/reset,
  provider and queue controls, wishlist diagnostics, visual preferences with
  the Dawn/Sunset family selector, Wallhaven, export, and empty-schema
  import.

## Tech, validation, and deployment

- Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
  Prisma/PostgreSQL/Supabase, Auth.js/Google, Zod, Vitest, and Vercel.
- Commands: pnpm dev on port 3500, pnpm build, pnpm start, pnpm lint,
  pnpm typecheck, and pnpm test.
- Provider keys and credentials stay server-side. Feature 23 adds IGDB
  credentials (Twitch client ID/secret, cached about-60-day client-credentials
  token) and keyless SteamSpy under the same server-side rule, and retires
  the RAWG key. Production validates environment, database migration,
  queue/scheduler behavior, and smoke tests.
- Feature 23 migrates provider data through a documented clean restart:
  personal-data export (18b), database wipe, empty-schema restore (18c), Steam
  re-import, then IGDB enrichment rebuilds provider data - doubling as the
  new-provider workflow test. No legacy RAWG snapshots are preserved.
- Feature 24 configures Vercel Cron and CRON_SECRET for a daily run at
  06:00 UTC-6 enqueueing the price refresh plus a compatibility freshness
  sweep for catalog and wishlist evidence older than the 180-day window; the
  sweep is a no-op while compatibility is inactive. Claims must be atomic,
  calls idempotent, and retry history visible.
- Visual acceptance (14f, and 20g for the families) covers primary routes on
  desktop/mobile and light/dark/system modes, keyboard/focus/targets/contrast,
  reduced motion/data, and loading/empty/error/stale/operation states, then
  existing automated checks.

## Open questions and plan gaps

- Wallhaven wording: project-plan.md section 13 still describes a fixed
  keyword pool (gaming-art/landscape defaults), while build-plan item 16 and
  the approved spec made searches game-driven - main game title first, then
  in-progress titles, no fixed keyword list. The plan can be updated to match
  the shipped behavior; nothing else depends on it.
- Interest range mismatch: project-plan.md section 11 states Interest
  (`0-5`), but the implemented personal field and all surfaces use 1-5.
  Likely a plan typo; update the plan or confirm the range.
- Duplicate numbering in build-plan.md: two checked items carry the label
  19c (the OS-aware recommendations parent and the Play environment fit
  child) following the 2026-09-07 renumbering. All are complete, so this is
  cosmetic; renaming the parent would clean the history.
- The project plan still calls the automatic IGDB identity path
  "suggest-and-confirm" once in the Wishlist compatibility section, while its
  identity section and build plan say a fixed IGDB match applies the App ID
  automatically. Resolve that wording in the plan before implementation.
- Feature 23 still needs implementation-level decisions in `/feature`, such as
  the persisted rate-limit/token-cache coordination and exact snapshot schema.

## Next workflow action

Features 1 through 22 are complete (22a and 22b are archived under
`blueprint/history/`). `blueprint/context/current-feature.md` is empty - the
next action is `/feature` to spec **23a (IGDB client and identity
foundation)**, followed by 23b-23e, with deployment as **feature 24**.

This overview is generated from the two plans and does not authorize code
changes.

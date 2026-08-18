# Project Plan

## 1. Problem

Gaming information is fragmented across Steam, price comparison services,
compatibility communities, metadata catalogs, and personal notes. The owner
needs one private assistant to decide what to play, what to buy in Mexico, and
which environment is most practical.

Backlog Odyssey consolidates ownership, manual entries, wishlist intent,
regional deals, compatibility evidence, metadata, and explainable
recommendations without becoming a launcher or storefront.

## 2. Users

A single private owner using:

- Bazzite desktop.
- Steam Deck portable.
- Windows fallback.
- Mexico prices and UTC-6.

The MVP has one authorized Google account. The data model may retain explicit
user relations where cheap and useful, but multi-user accounts, roles, public
registration, and collaboration are outside the MVP.

## 3. MVP Features

- App shell and authentication.
- Manual catalog and searchable library.
- Game detail, play state, personal fields, tags, collections, and availability.
- Steam account linking, initial import, and independent manual synchronization.
- Duplicate detection, review, dismiss, merge, delete, and short-lived Undo.
- RAWG metadata enrichment for catalog and wishlist entries.
- DLC model with explicit base-game ownership.
- Persistent manual-review queue for unresolved Steam DLC.
- Independent wishlist for base games and DLC.
- Manual wishlist acquisition into the catalog.
- ITAD/Steam price enrichment for wishlist entries.
- Optional MXN target prices and source preference.
- Compatibility evidence for Bazzite, Steam Deck, and Windows.
- Deterministic explainable play-next and buy recommendations.
- Recommendation runs with temporary dismissal and persistent calibration signals.
- Today dashboard with recent Steam activity and wishlist offers.
- Global visual foundation and optional Wallhaven background.
- Per-game detail themes based on RAWG metadata.
- Settings and manual JSON export.
- Deployment and CI readiness as the final planned milestone, without making it
  an inflexible MVP gate.

The following are explicitly outside the MVP:

- Automatic daily encrypted off-site backups.
- Backup rotation and automated restoration infrastructure.
- 90-day audit history.
- Public registration, roles, social features, and collaboration.
- Launcher, storefront, ROM catalog, PWA, offline mode, notifications, webhooks,
  or automatic price conversion.

## 4. Catalog and Wishlist Model

`Game` represents catalog entries only. Wishlist entries are independent and
do not create provisional `Game` records.

A wishlist entry may exist without a provider or external identifier. It may
store:

- Name.
- Base game or DLC type.
- Notes and local interest.
- Optional external identifiers.
- Independent RAWG metadata snapshot.

Price target and Steam/ITAD source preference belong to the later pricing
feature, not the initial local wishlist feature.

When a wishlist game is acquired manually:

1. The user chooses the acquisition source.
2. A real manual `Game` is created immediately.
3. Wishlist metadata is copied into the game's RAWG snapshot.
4. The selected availability is added.
5. The wishlist entry for the base game is removed.
6. Wishlist DLC remains until individually marked acquired.

If a Steam App ID exists in wishlist data, the new manual game retains it so a
later Steam sync updates the existing game instead of creating a duplicate.
Duplicate detection remains a fallback for cases without reliable identity.

A DLC cannot be created without resolving an existing or newly created base
game. DLC acquisition always requires that resolution first. ROMs are excluded
from wishlist and purchase recommendations.

## 5. DLC and Unresolved Steam DLC

DLC catalog entries:

- Must point to one existing base game.
- Are created from a base-game detail flow or through a reviewed Steam-DLC flow.
- Do not enter play-next recommendations.
- May be deleted individually.
- Are deleted through an explicit cascade when their base game is deleted.

If Steam reports an owned DLC whose base game is absent, the app creates a
persistent unresolved-DLC queue entry. No automatic matching or creation occurs,
even when the Steam App ID appears to be an exact match.

Each queue entry supports manual review actions:

- Link the DLC to an existing base game.
- Create the base game and DLC together from Steam in one confirmation.
- Discard temporarily.

Discarded entries remain stored and reappear as pending during the next Steam
sync if they are still unresolved.

## 6. Merge, Delete, and Catalog Integrity

Merge is available only for base-game pairs backed by an open
`PossibleDuplicate`. Direct DLC merge is deferred to the DLC feature.

The merge flow has two phases:

1. Editable proposal:
   - Suggested survivor, preferring Steam import over manual or other sources.
   - User may choose the other survivor.
   - Final name is freely editable.
   - Personal conflicts are resolved field by field.
   - Relationships are previewed.
   - Same-namespace external ID conflicts block the merge until resolved.
2. Explicit confirmation:
   - Shows the complete final summary.
   - Executes one transaction.
   - Starts a short Undo window.

Relations use conservative union behavior. Compatible relations are merged and
deduplicated. Unresolvable relations become explicit conflicts. DLC from the
discarded base is reassigned to the survivor; equivalent DLC is not deleted
automatically.

Delete is available for games and individual DLC. Deleting a base game cascades
to its DLC and clearly lists those DLC in the final confirmation. No second
confirmation is required.

Merge and delete share a temporary `CatalogOperation` mechanism:

- Operation type: merge or delete.
- Authenticated `User`.
- Independent operation ID.
- Pending, undone, expired, or completed state.
- Affected game IDs.
- Minimal exact snapshot of everything changed.
- Expiration of approximately 15 seconds.
- Undo survives page reload.
- Multiple operations are allowed when they affect different games.
- Operations overlapping the same game are blocked.
- Expired snapshots are removed.
- Permanent audit history is outside the MVP.

## 7. Metadata and RAWG

RAWG is a dedicated cross-cutting feature for catalog and wishlist entries.
Loading is normally on demand:

- Global catalog button opens a modal.
- Global wishlist button opens a modal.
- Detail pages have an individual load button.
- Manual catalog and wishlist forms suggest RAWG matches.
- Manual refresh warns before overwriting existing metadata.
- Existing metadata is treated in the UI as present or absent.
- RAWG snapshots are replaced, not historically retained.
- Steam's initial import automatically starts a separate enrichment process
  for games without metadata.
- Manual Steam synchronization does not automatically start RAWG enrichment.
- RAWG failure never fails or rolls back Steam import.

Initial metadata:

- Main and alternate background images.
- Genres.
- Tags/gameplay styles.
- Release date.
- Short description.
- Main, extra, and completionist playtime.
- Alternative names.
- Developers and publishers.
- Official website.
- RAWG updated date and local fetched date.
- Ratings and Metacritic as secondary context.
- RAWG URL.

Screenshots, videos, achievements, system requirements, franchises, series,
and stores are deferred.

RAWG attribution appears near RAWG data or images and in a
`Powered by / Data and content providers` section. The key remains server-side
and provider constraints are respected.

## 8. Wishlist and Prices

Wishlist entries are useful either as reminders or planned purchases.

### Local wishlist and acquisition

The first wishlist feature is provider-independent:

- Base-game and DLC entries are independent.
- Provider and external identifier are optional.
- Entries may exist without catalog `Game` records.
- Notes and local interest are stored locally.
- A base game can be acquired manually into the catalog.
- Wishlist RAWG metadata transfers to the new catalog game when available.
- The acquired base wishlist entry is removed.
- Wishlist DLC remains until individually acquired.
- The user decides whether associated DLC was purchased.

### Price enrichment and opportunity signals

Price enrichment is a separate feature:

- `targetPriceMxn` is optional.
- Source preference can be global or per-entry.
- Values are Steam, ITAD, or no preference.
- No preference selects the cheapest valid Mexican offer across Steam and ITAD.
- The selected source and store remain visible.
- Stale prices remain visible but cannot trigger strong purchase recommendations.
- A fresh valid offer at or below the target creates an opportunity signal.
- The seller page remains authoritative for regional activation.
- ITAD is optional, server-side, read-only enrichment.
- The integration uses `country=MX`, caching, rate-limit handling, and
  `429`/`Retry-After` behavior.
- No ITAD OAuth, Waitlist synchronization, notifications, webhooks, or automatic
  currency conversion is included.

Provider outages never erase the last valid data. The app retains the result,
marks it stale, displays its age, and allows manual refresh.

## 9. Compatibility Synthesis

Compatibility evidence covers:

- Bazzite desktop.
- Steam Deck.
- Windows fallback.

The feature may use ProtonDB, anti-cheat evidence, Steam Deck verification, and
other documented provider data. It produces a practical per-environment status
with provenance and freshness.

Personal compatibility overrides are separate from provider evidence and are
never overwritten by refreshes. Unknown or stale provider evidence remains
explicitly unknown or stale rather than being converted into a confident claim.

## 10. Recommendations

The recommendation engine has two distinct outputs:

- `play-next`: games already present in the catalog.
- `buy`: base games and eligible DLC entries in the wishlist.

A wishlist DLC cannot be recommended unless its base game is acquired.

Recommendations are deterministic and explainable. Each item stores visible
factors such as:

- Play state.
- Main-game and hidden flags.
- Priority and declared interest.
- Compatibility.
- Price and target-price status.
- Provider freshness.
- DLC eligibility.
- Calibration penalty.

Recommendations are generated explicitly by the user. Each execution creates a
`RecommendationRun`, and the dashboard displays the latest run.

Dismissing an item hides it only during the current run. A persistent dismissal
counter is maintained separately for play-next and buy recommendations. After
three cumulative dismissals of the same recommendation type, the adjusted
interest decreases by one point, with a floor of zero.

The user-entered interest remains manually editable. When automatic calibration
has changed it, the detail view explains that the value was adjusted because of
repeated recommendation dismissals. The technical counter remains an internal
implementation detail.

## 11. Today Dashboard

The dashboard is primarily a read-only composition view. It does not silently
run syncs or provider refreshes.

It displays:

- Main game.
- Games in progress.
- Latest play-next recommendation.
- Latest buy recommendation.
- The last five games recently played according to Steam sync data.
- Last-played date and accumulated playtime.
- The three best current offers among wishlist entries.
- Offer discount percentage, final MXN price, store, source, and freshness.
- Links to wishlist details and then to the external seller page.
- Provider freshness and available manual refresh actions.

The three wishlist offers are sorted primarily by discount percentage, with price
or target-price status used as a tie-breaker.

## 12. Visual Personalization

### Global visual foundation

The application shell supports:

- Light, dark, and system modes.
- Accessible contrast and readable overlays.
- Reduced-data and reduced-motion behavior where applicable.
- Stable local fallback visuals.
- Settings-controlled behavior.

### Wallhaven global background

Wallhaven controls the optional global application background:

- SFW candidates only.
- Cached selection.
- Desktop-oriented presentation.
- Attribution.
- Reduced-data behavior.
- Local fallback when unavailable.

Wallhaven does not determine functional theme colors or override accessibility.

### Per-game detail theme

Each game detail page may use its RAWG imagery and derived colors:

- Theme applies only to that detail page.
- Main RAWG image is preferred.
- Overlay and contrast protect text legibility.
- Missing or invalid imagery uses a deterministic fallback.
- The feature respects global theme and accessibility settings.

## 13. Settings, Export, and Operations

Settings includes:

- Google session management.
- Fixed environment display.
- Global Steam/ITAD preference.
- Theme and accessibility preferences.
- Wallhaven enablement and refresh controls.
- Reduced-data behavior.
- Manual provider refresh controls.
- JSON export.

Manual export is part of the MVP. Automatic encrypted off-site backups,
rotation, and advanced restoration are future work.

## 14. Tech

Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
Prisma, PostgreSQL/Supabase, Auth.js, Google authentication, Zod, Vitest, and
Vercel.

Deployment/CI is the final planned milestone, not a reason to block otherwise
complete product work if an additional MVP feature is discovered first.

## 15. Possible Improvements After the MVP

- Daily encrypted off-site backups.
- Backup rotation and automated restoration verification.
- 90-day summarized audit history.
- More advanced restore workflows.
- Additional providers or richer compatibility evidence.
- Notifications and webhooks.
- Multi-user support and roles.
- PWA/offline support.

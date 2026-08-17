# Backlog Odyssey — Product Requirements Document

## 1. Product summary

Backlog Odyssey is a private, single-user gaming library and decision assistant for one fixed gaming setup: Bazzite as the primary operating system, Steam Deck as the portable option, and Windows as the fallback. It combines a Steam-centered library, manually added games and ROMs, a local wishlist, price information from multiple stores, practical compatibility evidence, personal organization, and explainable recommendations.

The product helps its owner answer four separate questions:

1. What am I playing now?
2. What should I play next from games I can already access?
3. Is a base game or DLC on my wishlist worth buying now?
4. Should I use Bazzite, Steam Deck, or Windows for a particular game?

Recommendations for playing and recommendations for buying remain separate. A discount never makes a game a play-next candidate when it is not currently available to play.

The deployed application and its data are private. The source code may be published as source-available software under the PolyForm Noncommercial License 1.0.0. That license permits noncommercial use, modification, and distribution, but does not grant permission for commercial reuse. Publishing the code does not publish credentials, user data, cached provider responses, or third-party content, and does not grant rights to third-party data or images.

## 2. Problem statement

Gaming information is fragmented across Steam, price-comparison services, compatibility communities, metadata catalogs, and personal notes. Steam exposes ownership, playtime, and recent activity but does not fully represent personal priority, abandoned games, replay intent, ROMs, other platforms, or a cross-store wishlist.

Steam prices also cover only the Steam store. A personal wishlist benefits from regional offers across multiple covered stores, while Linux and Steam Deck users need practical compatibility guidance that distinguishes general Proton behavior, anti-cheat limitations, handheld experience, and a Windows fallback.

Backlog Odyssey consolidates these signals without becoming a launcher, storefront, public service, or detailed gameplay tracker.

## 3. MVP goals

- Maintain one searchable catalog and personal library centered on Steam.
- Import Steam games, total playtime, recent activity, and basic Steam metadata.
- Support manually added games, including ROMs and games from other platforms.
- Track a lightweight play state without sessions, percentage progress, or playthrough histories.
- Allow multiple games to be in progress and exactly one of them to be the main game.
- Record when a game was voluntarily abandoned and use that as a recommendation signal.
- Maintain a local wishlist that is authoritative for all buying recommendations.
- Use ITAD, when available, for regional multi-store prices, Steam App ID matching, and outbound offer links.
- Represent DLC as children of base games and consider DLC only for buying recommendations.
- Use compatibility evidence to recommend Bazzite, Steam Deck, or Windows without claiming certainty that a provider cannot supply.
- Provide persistent manual Collections and calculated system Collections.
- Detect possible duplicate catalog entries without automatically merging them.
- Produce transparent play-next and buy recommendations.
- Provide a desktop visual theme based on the main game and a dependable simple fallback.
- Work well at 2560×1440 and in mobile browsers.
- Keep local personal data usable when an optional provider is unavailable.

## 4. Non-goals

The MVP will not:

- Support multiple Backlog Odyssey users, public registration, roles, teams, or tenant isolation.
- Allow the configured operating-system and device profile to vary by user.
- Commercialize the application, display advertisements, or provide paid features.
- Launch, install, patch, or manage games.
- Replace Steam, Heroic, EmuDeck, ITAD, or another launcher or service.
- Sell games, provide checkout, or include grey-market key marketplaces.
- Guarantee that a key activates in Mexico; the seller remains authoritative.
- Synchronize the ITAD Waitlist or Collection.
- Use ITAD OAuth, access or refresh tokens, notification rules, notifications, or webhooks.
- Import or continuously synchronize Steam Collections.
- Import historic purchase dates or prices paid.
- Automatically discover ROMs or emulated games.
- Track gameplay sessions, completion percentage, achievements, detailed playthroughs, or replay history.
- Store Wallhaven image binaries.
- Provide an installed PWA or offline access.
- Use product analytics or behavioral telemetry.
- Use a black-box AI model as the initial recommendation engine.
- Provide social feeds, chat, public reviews, or multiplayer matchmaking.

## 5. User, access, and fixed environment

### 5.1 Single-user access

The application has one authorized owner. Auth.js provides Google sign-in and database-backed sessions. The exact permitted Google email is supplied through the server-only `ALLOWED_GOOGLE_EMAIL` environment variable.

Access rules:

- There is no registration flow.
- Google is the only sign-in provider.
- Every protected page, route handler, server action, and scheduled administrative action requires an authenticated session belonging to the allowed email.
- A successful Google authentication for any other email ends in access denied and creates no usable application account.
- The application stores no password. Google handles credential recovery.
- The owner can inspect active sessions, sign out, and revoke all application sessions.
- Changing the allowed email is an explicit deployment administration task, not an in-app user-management feature.

Authentication still protects a private deployment; the single-user scope removes roles, invitations, cross-user authorization, tenant filtering, and public account lifecycle requirements.

### 5.2 Fixed gaming profile

The MVP uses one fixed environment profile:

- Primary desktop OS: Bazzite.
- Portable option: Steam Deck.
- Fallback OS: Windows.
- Price country: Mexico (`MX`).
- Prices are displayed in the currency returned by the provider, normally MXN when available; the application does not convert prices.
- Time zone: UTC-6 (Central Time, Mexico). Used for scheduled refreshes ("daily"), feedback expiry ("30 days"), and timestamp displays.

These values live in the singleton `AppSettings` record, are seeded during setup, and are not editable through the MVP UI. The allowed email and all secrets remain deployment environment variables. The MVP does not provide profiles for additional users or devices.

## 6. Connected and external services

Every external integration is optional and isolated behind an adapter. Provider failures may remove or stale provider-derived information, but must not corrupt Collections, notes, play states, flags, local wishlist intent, personal ratings, or manual compatibility overrides.

### 6.1 Steam

Steam is a linked gaming service, not the Backlog Odyssey sign-in method.

The owner selects **Connect Steam**, completes Steam OpenID authentication, and links one SteamID64. Steam credentials are never collected or stored. Server-side calls use the registered Steam Web API key and respect Steam API terms, privacy requirements, and rate limits. [Steam Web API and OpenID](https://steamcommunity.com/dev)

Steam contributes:

- Steam App ID.
- Library availability.
- Total playtime.
- Last-played or recent-activity evidence when available.
- Basic Steam name and artwork identifiers.

Steam visibility settings may prevent library or recent-activity retrieval. This is displayed as a connection/import limitation, not treated as an empty library.

An exact existing Steam App ID updates the same Steam-backed catalog record. Title similarity alone never merges a Steam import with a manual or RAWG-backed record. Instead, both records remain and may be marked as possible duplicates.

Deleting a Steam-imported game deletes it and its dependent data from the active database. If it is returned by a later Steam synchronization, it is imported again as a new record. The application maintains no suppression or deletion tombstone.

Disconnecting Steam deletes the connection and Steam-derived availability, playtime, activity, and cached Steam metadata. Records with no remaining local relationship may disappear from the visible library. Local wishlist entries and manually maintained data remain only when their catalog record still has a non-Steam purpose.

### 6.2 RAWG

RAWG is an optional metadata source for genres, tags, release information, artwork, developers, publishers, platforms, and estimated playtime when available. All RAWG data and images require visible attribution and an active link wherever displayed. [RAWG API](https://rawg.io/apidocs)

A manually created entry may search RAWG and attach one RAWG ID for metadata. Doing so does not automatically attach a Steam App ID or ITAD Game ID. Manual entries, including ROMs, do not receive price tracking in the MVP.

If RAWG is unavailable, manual creation still works with a title and optional local fields. RAWG data is cacheable and replaceable.

**Match methods** for `ExternalGameId` are:

- `EXACT_STEAM_APP_ID`: Steam App ID matched exactly from Steam import; unique per namespace.
- `MANUAL_RAWG_SEARCH`: Manually selected RAWG ID via owner search.
- `MANUAL_ITAD_LOOKUP`: Steam App ID resolved to ITAD Game ID via official ITAD shop-ID endpoint.
- `INFERRED`: Future enrichment mechanism; currently unused in MVP.

### 6.3 ITAD price enrichment

Backlog Odyssey owns the wishlist. ITAD is a read-only, optional price and commercial-identity provider accessed with the already registered application API key. There is no ITAD account connection.

For wishlist entries that originate from a Steam-backed base game or Steam-backed DLC, Backlog Odyssey may:

1. Resolve the Steam App ID to an ITAD Game ID using the relevant ITAD shop-ID lookup.
2. Query current prices with `country=MX`.
3. Show the best current offer and other covered sellers.
4. Show regular price, discount, historical low, vouchers, DRM, platforms, timestamps, and expiry when returned.
5. Link through the unmodified offer or game URL supplied by ITAD for deeper review.

ITAD's price overview can compare selected games across covered shops and include historical lows and active bundles. Returned data and affiliate URLs must not be altered. The API key stays server-side, requests are cached, `429` responses honor `Retry-After`, and current provider limits are treated as changeable. [ITAD API](https://docs.isthereanydeal.com/)

Regional behavior:

- `MX` is sent to endpoints that accept a country.
- The application displays the exact returned currency and never performs hidden currency conversion.
- A card may say **Available for Mexico according to ITAD** and **DRM: Steam** when supported by the response.
- The application never claims that a Steam key is guaranteed to activate in Mexico.
- The seller's final product page and regional terms are the authority; every offer provides a review link before purchase.

Refresh behavior:

- The owner can select **Refresh prices**.
- A scheduled daily refresh may update active eligible wishlist entries.
- Cached price data displays its source and last-updated time.
- Stale data is labeled and is never presented as current.
- If ITAD is unavailable or revokes access, the local wishlist remains fully usable and buying recommendations that require current prices are suspended or labeled unavailable.

Out of scope for ITAD:

- OAuth and user tokens.
- Reading or editing the ITAD Waitlist.
- Two-way synchronization.
- ITAD notification rules, emails, notification history, and webhooks.
- Price tracking for manually created or RAWG-only entries.

The UI may offer **View offer in ITAD** and **Manage an alert in ITAD** links. Any alert created there is manual and remains outside Backlog Odyssey.

### 6.4 Compatibility providers

Compatibility is synthesized from separate evidence, not a strict source-priority list:

- ProtonDB: general Proton/Linux behavior.
- Are We Anti-Cheat Yet: anti-cheat and protected-mode evidence.
- Steam Deck Verified: Steam Deck-specific experience.
- Personal override: final displayed result for this installation.

ProtonDB is isolated behind a replaceable cached adapter because the commonly used API is not a conventional supported public contract. The UI displays source, freshness, and a link to the ProtonDB game page.

Are We Anti-Cheat Yet provides a community-maintained `games.json` dataset. The application caches the structured dataset rather than scraping individual pages. [Are We Anti-Cheat Yet](https://github.com/AreWeAntiCheatYet/AreWeAntiCheatYet)

Anti-cheat presence alone never determines the complete game result. A game may have a working single-player mode and an unsupported protected multiplayer mode.

### 6.5 Wallhaven

Wallhaven is an optional desktop wallpaper-discovery provider. Searches are SFW and use the API's tags, title queries, resolution, ratio, and pagination features. The application stores only candidate metadata and never stores image binaries. [Wallhaven API](https://wallhaven.cc/help/api)

Server-side calls use a Wallhaven API key registered by the owner and configured as a server-only environment variable. Requests respect rate limits; `429` responses honor `Retry-After` or fall back to the simple theme immediately. Cached search candidates are refreshed on schedule or when `Switch background` is selected; the client does not make direct Wallhaven requests.

Wallhaven content belongs to its respective owners. Every displayed wallpaper includes a source link, and removed or failed images fall back immediately. If use of the provider becomes unavailable or inappropriate, the product remains complete with its simple theme.

## 7. Catalog and game types

### 7.1 Base games and DLC

`Game` is a catalog record with one type:

- `BASE_GAME`
- `DLC`

A DLC must reference exactly one base game. A base game may have zero or more DLC records. A DLC cannot be the parent of another DLC in the MVP.

Only base games can have a play state, become the main game, receive Play soon or Replay candidate flags, or participate in play-next recommendations. DLC may have availability and a local wishlist entry, and may participate only in buying recommendations.

Bundles, packages, editions, demos, soundtracks, tools, and non-game software are not catalog types in the MVP. An external offer may mention a bundle, but the bundle is provider-derived price context rather than a playable catalog record.

### 7.2 Record origin and external identity

A catalog record has one creation origin:

- `STEAM_IMPORT`
- `MANUAL`

It may also contain provider-scoped external IDs such as `STEAM_APP`, `RAWG_GAME`, or `ITAD_GAME`. External IDs use a namespace so Steam apps cannot collide with packages or other provider identifiers.

Rules:

- A Steam-imported record requires a unique Steam App ID.
- A manual record may attach a RAWG Game ID for metadata.
- A manual record never gains Steam or ITAD identity automatically.
- ITAD identity is allowed only on Steam-backed base games and DLC eligible for the local wishlist.
- Deleting a record cascades to its local state, wishlist entry, Collection memberships, tags, provider snapshots, recommendation references, wallpaper state, and duplicate relationships.

### 7.3 Possible duplicates

Exact external IDs are deterministic identity. Similar titles, release years, or metadata are only duplicate evidence.

When a Steam import resembles an existing manual/RAWG record but lacks the same exact Steam App ID:

- Both records remain separate.
- The system creates a `PossibleDuplicate` relationship with its reason and confidence.
- Both entries display a duplicate-review indicator.
- The owner may dismiss the suggestion, delete either record, or manually merge them.
- No scheduled synchronization performs an automatic merge.

A manual merge selects the surviving record, moves compatible personal data and relationships, preserves non-conflicting external IDs, requires confirmation for conflicting values, and deletes the replaced record. A dismissed pair is not suggested again unless one record's identity materially changes.

## 8. Availability, play state, and flags

### 8.1 Availability

A base game may have one or more availability sources:

- `STEAM`
- `OTHER_PLATFORM`, with a display name
- `ROM`

No currently available copy is represented by the absence of an active availability source, not by a separate availability value.

The MVP does not distinguish purchase, gift, subscription, family sharing, refund, individual copies, or ROM-file location.

### 8.2 Play state

Every base-game library entry has exactly one lightweight play state:

- `NOT_STARTED`: no known prior play.
- `IN_PROGRESS`: intentionally considered started and still active.
- `PLAYED_BEFORE`: played previously but not currently in progress.
- `ABANDONED`: intentionally stopped and not currently intended to continue.

There is no completion state. Completing, pausing indefinitely, or otherwise finishing with a game can be represented as `PLAYED_BEFORE`; `ABANDONED` is reserved for the owner's deliberate negative signal.

Steam import rules:

- A newly imported record with positive Steam playtime (> 0) is initialized as `PLAYED_BEFORE`. A newly imported record with zero or unknown playtime is initialized as `NOT_STARTED`.
- Steam never automatically chooses `IN_PROGRESS`, `ABANDONED`, or the main game.
- Once the owner manually selects a play state, synchronization never overwrites it.
- A later zero or missing Steam playtime never reverts the state.

### 8.3 Main game

Multiple base games may be `IN_PROGRESS`. At most one is `isMainGame = true`.

- The main game must be `IN_PROGRESS` and have an active availability source.
- Setting another game as main clears the previous main flag in the same transaction.
- Moving the main game to another state clears its main flag.
- Main game is a dashboard, theme, and recommendation-context choice; it does not measure progress or launch the game.

### 8.4 Candidate flags

Flags are independent from play state:

- `playSoon`
- `replayCandidate`
- `hidden`

Rules:

- `replayCandidate` is valid only for `PLAYED_BEFORE` or `ABANDONED`.
- `hidden` removes the game from all play-next and buy recommendations until reversed.
- Hidden games remain searchable and appear in the calculated **Hidden** Collection.
- `ABANDONED` is a strong negative recommendation signal but not a permanent exclusion. Explicit Play soon or Replay candidate intent may outweigh it.

### 8.5 Personal fields

- Priority: unset, low, medium, or high.
- Interest: optional whole number from 1 to 5.
- Personal rating: optional whole number from 1 to 10, displayed as stars according to the mapping `stars = rating / 2`. A rating of 1 displays 0.5 stars, 2 displays 1 star, etc., up to 10 displaying 5 stars. No explicit 0-star option exists; an unset rating means no stars are displayed.
- Notes.
- Personal tags.
- Preferred environment: Bazzite, Steam Deck, Windows fallback, or no preference.
- Compatibility override: practical status plus an optional short reason.

Time commitment is provider catalog metadata when trustworthy and otherwise unknown. Suggested buckets are short (0–12 hours), medium (13–30 hours), and long (more than 30 hours). It is not required manual input in the MVP.

## 9. Local wishlist and deals

The Backlog Odyssey wishlist is the only wishlist authority.

A wishlist entry:

- Belongs to one base game or DLC.
- Stores local interest, optional target price, notes, and timestamps.
- Can exist whether or not the base game was played previously.
- Can coexist with ownership, but displays an already-available warning.
- Is deleted only by an explicit local action or deletion of its catalog record.

Price eligibility:

- Steam-backed base games and DLC may resolve an ITAD ID and receive price enrichment.
- Manual, RAWG-only, other-platform-only, and ROM entries do not receive ITAD price tracking.
- A DLC price card must display its base game and whether that base game is available.
- A DLC for an unavailable base game may still appear, but receives a strong buying penalty and clear warning.

Each eligible item may show:

- Best current covered-store price.
- Other covered sellers.
- Country queried and returned currency.
- Regular price and discount.
- Historical low.
- Voucher information.
- Store, DRM, and advertised platforms.
- Offer timestamp and expiry.
- Data freshness.
- Already-available warning.
- Base-game relationship for DLC.
- **View offer in ITAD** link.
- **Manage an alert in ITAD** link.
- **Verify activation for Mexico at the seller** warning for Steam-key offers.

## 10. Collections

### 10.1 Manual Collections

Manual Collections are persistent and support:

- User-defined name.
- Optional color and icon.
- Manual and bulk membership.
- Multiple Collections per base game.
- Filters in the library and play-next engine.

Names are case-insensitively unique. DLC does not participate in manual gameplay Collections in the MVP; it is navigated from the base game and wishlist.

### 10.2 System Collections

System Collections are calculated queries, not persisted membership rows:

- Main game.
- In progress.
- Not started.
- Played before.
- Abandoned.
- Play soon.
- Replay candidates.
- Hidden.
- Steam library.
- Other-platform games.
- ROMs.
- Bazzite ready.
- Steam Deck ready.
- Windows fallback recommended.
- One Collection for each detected genre.

System Collections are read-only. They may be hidden from navigation, but their membership cannot be edited directly.

## 11. Primary experiences

### 11.1 Today

The default dashboard contains:

- Featured main game.
- Other games in progress.
- Actions to set or clear the main game; no launcher action.
- Three explainable play-next recommendations.
- Recent Steam activity when available.
- Meaningful local-wishlist deals.
- Steam, ITAD price, metadata, and compatibility freshness.

### 11.2 Library

- Grid and compact table views.
- Search.
- Play-state tabs.
- Manual and system Collection filters.
- Filters for availability, genre, compatibility, environment, playtime, priority, personal tags, hidden state, and possible duplicates.
- Sorting by last played, total playtime, rating, priority, and title.
- Bulk Collection, flag, and play-state actions.
- Manual base-game creation.
- Possible-duplicate review.
- Hard-delete action with explicit confirmation.

### 11.3 Wishlist and deals

- Local base-game and DLC wishlist.
- Price eligibility status.
- Regional ITAD offers and freshness.
- Target-price and discount context.
- Separate buy recommendations.
- Direct ITAD review links.
- Clear unavailable-provider and regional-verification states.

### 11.4 Game detail

- Artwork and normalized metadata.
- Record origin and external IDs.
- Availability sources.
- Play state, main-game flag, rating, priority, interest, flags, tags, and notes.
- Steam playtime and last-played evidence.
- Collections.
- Genres, platforms, developer, publisher, and time commitment.
- ProtonDB, anti-cheat, and Steam Deck evidence with freshness.
- Practical Bazzite/Steam Deck/Windows guidance.
- Personal compatibility override.
- Local wishlist state and eligible price information.
- Linked DLC and DLC deal state.
- Possible-duplicate warning.
- Recommendation explanation.

### 11.5 Settings

- Connected services: Steam link status and disconnect action.
- Session management: inspect active authentication sessions and revoke all.
- Theme preference: Light, Dark, or System (default).
- Wallpaper preference and reduced-data preference for desktop.
- Refresh controls: manual ITAD price refresh and provider freshness status.
- Data export: on-demand JSON export of personal application data.

## 12. Compatibility behavior

### 12.1 Evidence and synthesis

Compatibility evidence is combined according to the fixed environment:

- Bazzite guidance uses general Proton/Linux evidence and surfaces Bazzite- or Fedora-specific evidence only when a source actually provides it.
- Steam Deck guidance uses Deck Verified as device-specific evidence and may supplement it with ProtonDB.
- Anti-cheat evidence can add a mode-specific caveat but does not replace the general result.
- A personal override controls the displayed practical result for this installation while retaining provider evidence underneath.

### 12.2 Practical statuses

For each game, compatibility is synthesized separately for each environment (Bazzite, Steam Deck, Windows). A single game may display different practical statuses depending on the target environment.

Possible statuses per environment:

- **Ready**: the game is expected to play without workarounds on this environment.
- **Ready with tinkering**: the game may require configuration, compatibility layers, or community patches to run on this environment.
- **Fallback recommended**: the game works better on an alternative environment (e.g., Bazzite and Steam Deck evidence suggest Windows fallback).
- **Required**: the game cannot run on the recommended environment and Windows is required.
- **Unknown**: no sufficient evidence is available; the owner may provide a personal override.

Windows-required games remain eligible for play-next unless hidden or filtered out. Recommendation cards always expose the Windows requirement.

A personal override controls the displayed practical result for this installation while retaining provider evidence underneath.

## 13. Recommendation engine

The MVP uses deterministic, rule-based, explainable scoring. Numeric weight editing is out of scope.

### 13.1 Play-next eligibility

A play-next candidate must:

- Be a `BASE_GAME`.
- Have at least one active Steam, other-platform, or ROM availability source.
- Not be hidden.
- Match active explicit filters.

DLC and unavailable wishlist-only games are never play-next candidates.

### 13.2 Play-next signals

Positive signals:

- Main-game or in-progress context.
- Play soon.
- Replay candidate.
- High priority or interest.
- Genre affinity from rated and previously played games.
- Preferred environment match.
- Strong compatibility evidence.
- Time-commitment alignment: when the owner has limited availability (indicated by play history), shorter games receive a bonus; conversely, availability for a longer session favors longer titles. Metadata comes from provider catalogs when available; missing data does not exclude the game.
- Long time since last played when replay is intended.

Negative signals and caveats:

- `ABANDONED` applies a strong penalty.
- A prior **Not now** response suppresses the game for 30 days.
- Recent genre repetition may apply a fatigue penalty.
- Tinkering, anti-cheat limitations, or Windows requirements are displayed and may reduce the score.
- Missing compatibility or time metadata reduces confidence but does not automatically exclude the game.

Hidden is the only permanent recommendation exclusion until manually reversed. Explicit Play soon or Replay candidate intent may counter an abandonment penalty.

### 13.3 Buy eligibility and signals

Buy recommendations are calculated separately for non-hidden local wishlist entries.

Price-based eligibility requires a Steam-backed base game or DLC with a resolved ITAD ID and sufficiently fresh price data. Data is considered sufficiently fresh if the last ITAD refresh was within the previous 24 hours and the offer has not expired. Items without current price data remain in the wishlist but do not receive a current deal score; stale or expired data is labeled as such.

Signals may include:

- Current discount.
- Current price versus historical low.
- Optional target price.
- User interest.
- Prior play and rating.
- Existing availability warning.
- Size of the not-started library as a moderate penalty.
- Base-game availability for DLC.
- Base-game `ABANDONED` state as a strong DLC purchase penalty.
- Regional or DRM caveats.

The play-next score never influences the buy score directly.

### 13.4 Feedback and explanations

Available feedback:

- **Play soon:** sets the `playSoon` flag.
- **Not now:** records a dismissal with a 30-day expiry; the game is suppressed from play-next recommendations until expiry or until the owner manually changes play state, priority, interest, rating, or preferred environment (which resets all prior feedback and recalculates scores).
- **Hide:** sets the `hidden` flag, excludes the entry from all recommendations, and places it in the Hidden system Collection.
- Changing play state, priority, interest, rating, or preferred environment updates future runs and implicitly resets a prior **Not now** feedback.

Each displayed recommendation includes its strongest positive reasons, meaningful negative signals, compatibility or regional caveats, data freshness, and score type (`PLAY_NEXT` or `BUY`). Raw arithmetic need not be exposed.

## 14. Dynamic visual theme

### 14.1 Featured game

The visual theme uses:

1. The main game, when set.
2. Otherwise, the most recently played in-progress Steam game (by last-played timestamp).
3. Otherwise, the most recently imported Steam base game (by import timestamp).
4. Otherwise, the simple fallback theme.

### 14.2 Wallpaper selection

Mobile always uses the simple fallback and makes no Wallhaven request.

On desktop, the client determines an estimated render target using viewport dimensions and device pixel ratio after page load. Browser zoom, display scaling, and multi-monitor behavior mean this is an estimate rather than a guaranteed physical monitor resolution.

Desktop flow:

1. Confirm desktop eligibility, wallpaper preference, and reduced-data preference.
2. Search an exact Wallhaven game tag when available, otherwise normalized title and aliases.
3. Restrict to SFW landscape candidates near the estimated aspect ratio.
4. Prefer a candidate equal to or below the estimated render target.
5. Never intentionally choose a higher candidate solely for quality.
6. Use the next cached candidate for **Switch background** and fetch another page only when needed.
7. Fall back on no confident match, provider error, rate limiting, removal, or image-load failure.

The server performs Wallhaven API searches. The desktop browser may load the selected remote image URL directly from Wallhaven; therefore not every image network request is server-side. No wallpaper binary enters application storage or backups.

### 14.3 Light and dark modes

Supported modes are Light, Dark, and System, with System as the default. The singleton preference is applied before first paint.

Primary content must meet WCAG AA contrast. Wallpaper colors never directly determine foreground text, and no information is represented through color alone.

## 15. Product-level data model

This is a product model rather than a Prisma schema. Implementation names may change while these responsibilities and constraints remain true.

| Area | Record | Responsibility |
|---|---|---|
| Authentication | `User`, `Account`, `Session` | Auth.js records for the one allowed Google identity. No password hash or roles. |
| Settings | `AppSettings` | Singleton theme, fixed environment (Bazzite/Deck/Windows), `MX` price country, UTC-6 time zone, wallpaper preference, and refresh settings. The allowed email and secrets remain environment configuration. |
| Connections | `SteamConnection` | One SteamID64, connection state, and last synchronization result. |
| Catalog | `Game` | Base game or DLC, creation origin, canonical display fields, optional parent base game, and timestamps. |
| Metadata | `GameMetadataSnapshot` | Rebuildable provider payload/reference, provenance, fetched time, expiry, and attribution. |
| Library | `LibraryEntry` | Base-game availability-independent personal state: play state, main flag, priority, interest, rating, notes, preferred environment, compatibility override, and candidate flags. |
| Availability | `GameAvailability` | Steam, named other platform, or ROM. Steam rows also hold imported playtime and last-played evidence. |
| Wishlist | `WishlistEntry` | Local wishlist authority for a base game or DLC, with interest, optional target price, notes, and timestamps. |
| Prices | `PriceRefresh`, `DealOffer` | Rebuildable ITAD refresh outcome and returned offers, including shop, regional request, returned currency, price, regular price, discount, historical low, voucher, DRM, platforms, timestamps, expiry, unmodified URL, and freshness. |
| DLC | `Game.parentGameId` | DLC-to-base-game relationship. DLC has no LibraryEntry play state. |
| Organization | `Collection`, `CollectionMembership`, `PersonalTag`, `GameTag` | Persistent manual Collections and tags. System Collections have no membership rows. |
| Compatibility | `CompatibilitySnapshot` | Provider evidence, normalized result, source URL/reference, fetched time, expiry, and freshness. |
| Duplicates | `PossibleDuplicate` | Symmetric game pair, evidence, confidence, status (`OPEN` or `DISMISSED`), and reviewed time. |
| Recommendations | `RecommendationRun`, `RecommendationItem`, `RecommendationFeedback` | Immutable run context plus ranked items, score breakdowns, displayed explanations, and Not now expiry. |
| Theme | `WallpaperState` | Candidate IDs, dimensions, URLs, order, selected index, estimated render target, and freshness; no binary. |
| Operations | `SyncRun` | Provider, timing, status, counts, and safe diagnostic summary. No per-user ownership is required. |

### 15.1 Relationships

```text
User ── Auth.js Account / Sessions

AppSettings ── singleton
SteamConnection ── singleton

Game (BASE_GAME) ──0..N── Game (DLC)
Game (BASE_GAME) ──0..1── LibraryEntry
Game (BASE_GAME or DLC) ──0..1── WishlistEntry ──1:N── DealOffer
Game (BASE_GAME) ──N:N── Collection / PersonalTag
Game ──N:N── PossibleDuplicate
RecommendationRun ──1:N── RecommendationItem ──N:1── Game
```

### 15.2 Constraints

- Exactly one deployable application owner is allowed by email.
- Unique external identity on `(namespace, externalId)`.
- A DLC requires a base-game parent; a base game has no parent; reject cycles and DLC parents.
- Only base games have LibraryEntry, play state, main flag, gameplay Collections, or play-next recommendations.
- At most one LibraryEntry is main; it must be `IN_PROGRESS` with active availability.
- Replay candidate requires `PLAYED_BEFORE` or `ABANDONED`.
- Priority is unset/low/medium/high; interest is 1–5; rating is 1–10 when present.
- One local WishlistEntry per game.
- ITAD identity and DealOffer are allowed only for Steam-backed wishlist entries.
- Collection and tag names are case-insensitively unique. Membership is unique per Collection and base game.
- PossibleDuplicate stores an ordered pair so the same pair cannot be created twice.
- Recommendation runs and items are immutable after display. Not now has an expiry; Hidden persists until reversed.
- Hard deletion cascades through every dependent application record. No deletion tombstone is created.

## 16. Synchronization and failure behavior

- Provider synchronization is explicit via **Refresh** actions or scheduled automatically.
- Manual Steam synchronization: the owner can select **Sync Steam now** from settings; automatic daily refreshes also occur.
- Manual ITAD price refresh: the owner can select **Refresh prices** from the wishlist or settings; automatic daily refreshes also occur for active eligible entries.
- Scheduled refreshes may update Steam data, active wishlist prices, RAWG metadata, compatibility evidence, and Wallhaven candidate metadata.
- Provider fields retain source and last-updated time.
- Provider data never overwrites manually selected play state, main game, flags, rating, priority, interest, notes, Collections, tags, or compatibility override.
- Similar identity creates PossibleDuplicate rather than automatic merge.
- A failed refresh preserves the last successful cached value until its display-expiry rule, then labels it unavailable or stale.
- A provider disconnection removes its credentials and provider-derived visibility; it does not attempt historical reconstruction.
- Hard deletion is immediate in the active database. Reimport from Steam is normal and requires no special handling.
- No behavioral analytics, tracking pixels, or product telemetry are emitted.

## 17. Technical architecture

### 17.1 Stack

- Next.js App Router
- React
- TypeScript
- Turbopack
- pnpm
- ESLint
- Tailwind CSS
- Accessible component library
- Prisma ORM
- PostgreSQL hosted by Supabase
- Auth.js with Google
- Zod
- Vitest
- Vercel
- Separate off-site backup storage

### 17.2 High-level flow

```text
Private responsive browser
          ↓
Google sign-in + allowed-email check
          ↓
Next.js on Vercel
    ├── Steam OpenID and library synchronization
    ├── RAWG metadata adapter
    ├── ITAD API-key price adapter (MX)
    ├── ProtonDB compatibility adapter
    ├── Anti-cheat dataset cache
    └── Wallhaven desktop search adapter
          ↓
Prisma
          ↓
Supabase PostgreSQL
          ↓
Rolling off-site personal backup
```

All API keys and provider calls containing credentials remain server-side. The selected Wallhaven image itself may load from its remote URL in the desktop browser.

### 17.3 Repository and secrets

- The code repository may be public as source-available software under the PolyForm Noncommercial License 1.0.0; it is not described as open source.
- `.env*`, provider keys, Google credentials, database URLs, backup credentials, exports, cached payloads, and user data are never committed.
- A committed `.env.example` documents variable names with placeholder values.
- Secret scanning and dependency updates are enabled where available.
- `THIRD_PARTY_NOTICES.md` documents provider attribution, applicable licenses, and terms before the first distributable release.
- Forks must register or supply their own provider credentials; the repository does not distribute the owner's keys.

### 17.4 Expected commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm prisma:migrate`
- `pnpm prisma:studio`

ESLint and automated tests run as independent CI checks.

## 18. Responsive web requirements

### Desktop

- Constrained content width at 2560×1440 and larger.
- Optional dense library table.
- Persistent navigation and filters where space permits.
- Multi-column cards.
- Side-by-side metadata and compatibility evidence.
- Optional estimated-resolution Wallhaven background.

### Mobile browser

- Bottom navigation.
- Single-column cards.
- Filters in a slide-up sheet.
- No hover-only action.
- Touch targets of at least 44×44 CSS pixels.
- Simple fallback background only.
- No Wallhaven search, preload, or wallpaper download.

## 19. Backup and recovery

Irreplaceable personal data includes play states, main-game choice, ratings, notes, priority, interest, tags, flags, Collections, wishlist intent, target prices, manual entries, duplicate decisions, and compatibility overrides.

Rebuildable data includes Steam playtime/activity, RAWG metadata, ITAD offers, compatibility snapshots, and Wallhaven candidates.

MVP policy:

- Create a daily logical backup of irreplaceable tables to storage outside Supabase.
- Retain the seven most recent successful daily backups, replacing the oldest after the next successful backup. This is disaster-recovery rotation, not application-level history or soft deletion.
- Encrypt backups and exclude Google, Steam, ITAD, RAWG, Wallhaven, database, and backup credentials.
- Provide an on-demand JSON export of personal application data.
- Keep schema and migrations in Git.
- Test restoration into a clean environment before the MVP is considered complete.
- A hard-deleted game is removed from the active database without a tombstone. Disaster-recovery backups may contain an earlier copy until rotated; restoring a backup restores the database state from that point in time.

Supabase Free projects do not provide the same automatic downloadable backup guarantees as paid plans, so the off-site logical export must be implemented explicitly. [Supabase backups](https://supabase.com/docs/guides/platform/backups)

## 20. MVP delivery gates

- Verify the allowed Google account and reject a different Google account across every protected server entry point.
- Validate Steam OpenID and owned/recent-game import with the owner's actual Steam visibility settings.
- Validate exact Steam App ID idempotency and manual/Steam possible-duplicate behavior.
- Confirm that a deleted Steam entry can be imported again without restoring old personal state.
- Validate manual RAWG enrichment without automatic Steam or ITAD linking.
- Validate ITAD Steam App ID lookup, `MX` price requests, multiple covered offers, unchanged URLs, caching, stale states, and provider-unavailable fallback.
- Validate that ITAD or another provider outage leaves the local wishlist and personal library usable.
- Validate base-game/DLC parent rules and prove that DLC never enters play-next.
- Validate Bazzite, Deck, anti-cheat, Windows fallback, and personal override synthesis.
- Validate Wallhaven desktop selection using an estimated render target and prove that mobile makes no Wallhaven request.
- Restore an encrypted off-site backup into a clean environment.
- Verify that no secrets or personal exports are tracked by Git before making the repository public.

## 21. MVP acceptance criteria

- Only the configured Google email can use the application.
- The owner can connect exactly one Steam account without sharing a Steam password.
- Steam synchronization is idempotent for exact Steam App IDs.
- A similar manual record and Steam import remain separate and are flagged as possible duplicates.
- The owner can dismiss, delete, or manually merge a possible duplicate pair.
- Hard deletion removes the record and dependent active-database rows; a later Steam sync may import it anew.
- A base game can be Not started, In progress, Played before, or Abandoned.
- Multiple games can be In progress, but exactly zero or one is the main game.
- Steam synchronization never overwrites a manually selected play state or main game.
- Abandoned influences recommendations, while Hidden excludes an entry until reversed.
- Hidden entries remain searchable and appear in the Hidden system Collection.
- DLC always links to a base game and never appears in play-next.
- A Steam-backed wishlist game or DLC can resolve an ITAD ID and display regional covered-store offers when available.
- ITAD requests use `MX`; returned currencies and URLs are preserved without conversion or modification.
- Every Steam-key offer tells the owner to verify Mexican activation on the seller's page.
- The local wishlist survives ITAD failure or removal of API access.
- Manual/RAWG-only entries receive no ITAD ID or price tracking.
- Play-next and buy rankings remain separate and explain their strongest signals and caveats.
- Windows-required games remain play-next candidates unless hidden or filtered out.
- Provider failures do not corrupt personal fields or Collections.
- Mobile clients never request or download a Wallhaven wallpaper.
- Light, dark, and system themes remain accessible with or without a wallpaper.
- An off-site backup restores irreplaceable data into a clean environment.
- The deployed application emits no product analytics or behavioral telemetry.

## 22. Success checks

Because this is a single-user product without telemetry, success is assessed through direct use and acceptance testing rather than aggregate analytics.

- The Steam library imports without duplicate Steam App IDs.
- The owner can mark a game In progress, Main, Played before, Abandoned, or Hidden in no more than two primary actions from its card or detail view.
- Selecting a play-next game from Today takes less than one minute in a manual usability test.
- Recommendation explanations are understandable without raw score arithmetic.
- A normal scheduled synchronization is no more than 24 hours stale when providers are available.
- ITAD offers display Mexico as the requested region and link to the original offer for verification.
- Provider outages degrade only the related enrichment.
- A restore drill recovers the personal library, wishlist, Collections, and manual decisions.

## 23. Principal risks

- Steam visibility settings can prevent owned-game or recent-activity import.
- Steam does not expose Collections or purchase history through the supported consumer flow.
- Cross-provider and manual identity matching can produce false duplicate candidates.
- ITAD regional availability does not guarantee that every Steam key activates in Mexico; the seller must be checked.
- ITAD, RAWG, ProtonDB, Wallhaven, or another provider may change, rate-limit, deny, or remove access.
- RAWG and Wallhaven content requires attribution and remains subject to third-party rights and removal.
- Community compatibility and anti-cheat data may be incomplete or stale.
- Browser display APIs cannot guarantee exact physical monitor resolution.
- A public source repository can accidentally expose secrets if repository hygiene fails.
- Hard deletion and a deliberately small history model make accidental deletions unrecoverable except from a recent operational backup.
- Too many manual fields can make maintaining the library feel like work.

The principal mitigation is to keep personal intent local, make every external provider optional, preserve provenance and freshness, avoid automatic identity merges, keep recommendations explainable, and allow the product to remain useful when enrichment disappears.

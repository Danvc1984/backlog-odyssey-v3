# Project Plan

## 1. Problem

Gaming information is fragmented across Steam, price comparison services,
compatibility communities, metadata catalogs, and personal decisions. The owner
needs one private assistant to decide what to play, what to buy in Mexico, and
which environment is most practical.

Backlog Odyssey consolidates ownership, manual entries, wishlist intent,
regional deals, compatibility evidence, metadata, and explainable
recommendations without becoming a launcher or storefront.

## 2. Users

A single private owner using a self-configured setup chosen at first login:

- One primary OS: Linux-based or Windows.
- An optional handheld running Linux (e.g. Steam Deck) or Windows
  (e.g. ROG Ally).
- A Windows fallback is optional: it exists only when the primary OS is
  Linux and the owner has a Windows machine available. The fallback OS is
  always Windows when one exists, and a Windows primary has no fallback.
- Mexico prices and UTC-6.

The MVP has one authorized Google account. The data model may retain explicit
user relations where cheap and useful, but multi-user accounts, roles, public
registration, and collaboration are outside the MVP.

## 3. MVP Features

- App shell and authentication.
- Manual catalog and searchable library.
- Reusable multi-source availability: built-in Steam and ROM sources plus
  user-created alternative stores, source-aware Library filtering, and soft
  play-next source tuning.
- Game detail, current play state, prior-completion history, compact personal
  fields, tags, and availability.
- One manual grouping model: personal tags automatically produce collection
  shelves and support multi-tag membership. Default system shelves (in progress,
  previously completed, backlog, handheld picks) and calculated IGDB
  series/franchise shelves remain distinct calculated views.
- Steam account linking, initial import, and independent manual synchronization.
- Duplicate detection, review, dismiss, merge, delete, and short-lived Undo.
- IGDB metadata, artwork, and playtime enrichment for catalog and wishlist entries.
- DLC model with explicit base-game ownership, IGDB metadata and artwork for
  catalog DLCs and DLC wishes, and dedicated DLC detail pages with a visible
  base-game link.
- DLCs stay out of the library grid and list; the library gains a Has-DLC
  filter chip and Collections later adds a Games-with-DLC system shelf.
- Persistent manual-review queue for unresolved wishlist Steam DLC only.
- Independent wishlist for base games and DLC linked to owned catalog games.
- Manual wishlist acquisition into the catalog with optional base-game play state update.
- ITAD/Steam price enrichment for wishlist entries.
- Optional MXN target prices, transparent valid-offer comparison, and purchase-opportunity signals.
- Manual Steam wishlist import with conservative local matching, review queues, and IGDB follow-up for new base-game wishes.
- First-login OS setup capturing the primary OS, an optional Windows
  fallback (offered only when the primary is Linux), and the handheld;
  the flow ends by offering the existing taste-setup as an optional next
  step (start now or not now), and an all-Windows setup is the trivial
  path with no compatibility explanation step.
- Compatibility evidence for Linux targets with a derived Windows fallback,
  skipped entirely on all-Windows setups; wishlist evidence presented
  separately when a wish has a confirmed Steam App ID. Compatibility
  display is gated per setup and per game: card tags render four distinct
  states on active Linux setups (evidence, unknown/not-checked, stale,
  absent - no hollow placeholders), and all-Windows setups render no
  compatibility UI anywhere. Changing the OS setup in Settings asks for
  confirmation and then immediately re-derives compatibility synthesis
  and synchronously regenerates recommendation runs.
- Ingestion-path interest defaults: Steam imports start at 2/5, manual
  entries at 3/5, and wishlist acquisition carries the wish's interest into
  the catalog.
- Deterministic explainable play-next and buy recommendations with a
  handheld play role when the setup has one, and DLC affinity weighting.
- Before recommendations are shown, Taste Setup requires at least ten library
  games. It samples library games randomly and records independent prior-play,
  stronger taste, and play-soon signals; recommendation surfaces stay hidden
  until setup is saved. Buy recommendations are omitted when the wishlist is
  empty.
- Recommendation runs with temporary dismissal and persistent calibration signals.
- Today dashboard with active-backlog progress, data-coverage prompts, daily-cached
  recent Steam activity (including unimported titles), latest explicit recommendations,
  wishlist offers, and provider-operation status.
- Global visual foundation, design tokens, and comprehensive full-app UI review.
- Optional Wallhaven background.
- Per-game detail themes and IGDB screenshots on game and wishlist detail.
- Dawn and Sunset palette families, Cinzel/Inter typography, official brand
  icons, and an Odyssey voice pass over expressive copy.
- A playful, adventurous desktop sign-in introduction: icon-led Backlog Odyssey
  branding, the tagline "Turn your gaming backlog into your next adventure",
  and a decorative, reduced-motion-aware static demo that cycles Half-Life 2,
  Cult of the Lamb, Elden Ring, Grand Theft Auto V, and NieR:Automata through adding a
  game to the backlog and receiving an explainable recommendation. The
  sign-in form remains primary and the demo remains available below it on mobile.
- Post-sign-in Welcome setup includes a supported market country and display
  currency choice, plus an optional Steam connection action that never blocks
  setup. Regional ITAD prices preserve their provider currency; external FX
  conversion is presentation-only, visibly estimated, and keeps the original
  provider amount available for comparison.
- Settings and manual JSON export with empty-schema restore.
- Simplified personal data and editing boundaries: no per-game availability
  display label or catalog/wishlist notes; reusable alternative-source
  definitions are managed only in Settings, while games select from saved
  sources.
- Library and Game Detail renewal before deployment: a hero with links to each
  actionable detail section; ordered game details, personal data, tags,
  platforms, DLC, compatibility, artwork, and delete sections; richer personal
  data controls with `Planned for my handheld`; combined title and IGDB
  maintenance; duplicate-review and merge-platform correctness; Library ProtonDB
  detail links; and accurate completed-game backlog progress.
- A pre-deployment mobile responsiveness pass: eliminate overflows, reduce
  oversized titles and buttons, make constrained sections scrollable, keep
  detail-page actions reachable, permit mobile-only collapsing of Library and
  Wishlist health strips, use grid-only Library and Wishlist browsing on small
  screens and grid cards in Collection detail, use offer-game artwork in the
  Today worthy-bargain panel, and enable the existing
  Wallhaven background on mobile when allowed by visual preferences.
- Deployment and CI readiness as the final planned milestone, after the mobile
  responsiveness pass, without making it an inflexible MVP gate.

The following are explicitly outside the MVP:

- Automatic Steam synchronization.
- Automatic daily encrypted off-site backups.
- Backup rotation and automated restoration infrastructure.
- 90-day audit history.
- Public registration, roles, social features, and collaboration.
- Launcher, storefront, ROM catalog, PWA, offline mode, notifications, webhooks,
  or automatic price conversion.
- Automatic full-library imports from non-Steam stores, including Epic Games
  Store, unless a supported account-library API becomes available.

## 4. Catalog and Wishlist Model

`Game` represents catalog entries only. Wishlist entries are independent and
do not create provisional `Game` records.

A wishlist entry represents either:
- An unowned base game (independent entry, optionally enriched with IGDB).
- An unowned DLC for an already-owned catalog base game (requires a relation to
  an existing catalog `Game`).

A wishlist entry may exist without a provider or external identifier. It may
store:

- Name.
- Base game or DLC type.
- Target base game ID (required if type is DLC).
- Local interest and an optional personal **Game experience / intention**.
- Optional external identifiers.
- Independent IGDB metadata snapshot (base games via their own identity;
  DLC wishes via their own IGDB identity matched from the owned base game's
  relations or their own Steam App ID).

`Game experience / intention` is one user-selected value per catalog or
wishlist game, initially one of: PC gaming, Multiplayer & co-op, Couch gaming,
or On the go. It describes the session the game best suits, not its provider
platform or compatibility. It is optional, editable, and deliberately
single-value for the MVP; unclassified games remain eligible with less
experience-fit evidence.

A library entry separates current status from prior completion. Current
`playState` uses `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, or `ABANDONED`.
The independent, user-editable `completedBefore` checkbox records that the owner
completed the game before the current playthrough. A replay can therefore be
`IN_PROGRESS` while `completedBefore` remains true. The existing `replay` flag
continues to mean "recommend this for another playthrough," not completion
history.

Any transition away from `COMPLETED` activates `completedBefore`. Entering
`IN_PROGRESS` from `COMPLETED`, either manually or through `Start playing`,
also clears `replay` because that intent has been consumed. The user may clear
`completedBefore` afterward to correct the record. Taste Setup's
`I've played this` changes only `completedBefore`.

Active-backlog progress derives only from the current state: `COMPLETED` counts
as complete, `NOT_STARTED` and `IN_PROGRESS` count as active backlog, and
`ABANDONED` is excluded. Prior completion never double-counts that metric.
Current and prior completion consolidate into one positive learning signal,
while a prior completion and a current abandonment remain distinct evidence.

The calculated completion shelf is named **Previously completed** and contains
games currently `COMPLETED` or marked `completedBefore`. It may intentionally
overlap with In Progress or Backlog. A currently `COMPLETED` game remains
eligible for Play Next when explicitly marked for replay. The project requires
no `PLAYED_BEFORE` migration or legacy import support because the database will
be rebuilt before staging.

Price target and provider offers belong to the later pricing feature, not the
initial local wishlist feature. Store preference remains intentionally excluded
from price comparison: when multiple valid offers exist, the app selects the
cheapest valid Mexican offer while showing the alternatives. Play-next source
preference is separate from seller/offer selection and applies only to owned
catalog games.

### Catalog availability and reusable sources

Availability answers where the owner can play a catalog game. It is separate
from immutable `Game.origin`, external identities, compatibility evidence, and
wishlist offer sellers. A game may have more than one availability, such as
Steam and Epic Games Store.

Steam and ROM remain built-in availability kinds. An `OTHER_PLATFORM`
availability must reference one reusable, single-user alternative-source
record. That record has a user-facing canonical name, normalized unique name,
optional known-source key, and archive state. It is never a free-text source
repeated on individual games, and availability has no per-game display-label
field.

Reusable alternative sources are created, renamed, and archived only in
Settings. When creating or editing a game, availability uses checkboxes for
Steam, ROM, and saved active alternative sources. Detail surfaces may assign or
remove saved sources but never modify the source definitions; they link to the
relevant Settings section when source administration is needed.

When a required source does not yet exist, the user follows the Settings link
and completes source administration as a separate flow; game forms do not
retain or restore an unfinished draft. `Change platform` remains a Game Detail
action and is not added to Library cards. The existing Library-card delete
action remains available with its confirmation and short-lived Undo.

The built-in known-source catalog is code-owned rather than a database enum so
custom sources remain possible. Its initial suggestions are Epic Games Store,
GOG, EA app, Ubisoft Connect, Battle.net, Xbox/Microsoft Store, itch.io,
Amazon Games, Humble Bundle, and Rockstar Games Launcher. It supplies canonical
labels, aliases, and icon metadata. Steam, ROM, and known alternatives use
their designated icons; a custom source uses a neutral fallback icon.

Alternative sources may be renamed or archived. Archiving removes a source from
new availability selection and new tuning choices, but preserves existing game
availability, presets, recommendation-run explanations, and historical data.
An archived source already assigned to a game remains visible with an
`Archived` marker and may be preserved or removed, but cannot be selected again
after removal. A referenced source is not permanently deleted; a later
destructive flow would first require explicit reassignment.

Per-game availability display labels are removed directly during the clean
database rebuild. Every surface uses the reusable source's canonical name; no
legacy export or import compatibility is required.

Game-detail availability values display accessible icon-decorated source chips.
Library source filtering includes Steam, ROM, all alternative sources, and each
saved alternative source individually.

When a wishlist item is acquired manually:

1. **For a base game:**
   - The user chooses the acquisition source.
   - A real manual `Game` is created immediately.
   - Wishlist metadata is copied into the game's IGDB snapshot.
   - The selected availability is added.
   - The wishlist entry is removed.
2. **For a DLC:**
   - The user marks the wishlist DLC as acquired.
   - A catalog `Game` (type `DLC`) is created linked to the referenced base game.
   - The wishlist DLC entry is removed.
   - The UI offers an optional one-click action to transition the base game's
     play state (e.g. set to `PLAN_TO_PLAY` or flag `replay: true`).

If a Steam App ID exists in wishlist data, the new manual game retains it so a
later Steam sync updates the existing game instead of creating a duplicate.
Duplicate detection remains a fallback for cases without reliable identity.

ROMs are excluded from wishlist and purchase recommendations.

### Tags, collections, and shelves

Personal tags are the sole manual grouping primitive. A game may have multiple
tags, and every tag, including an empty tag, automatically appears as a
collection shelf. The separate manual `Collection` model is removed during the
clean database rebuild. Calculated system shelves and IGDB series/franchise
shelves remain read-only and never become personal tags.

Game Detail retains quick tag creation, reuse, assignment, and removal.
Collections owns global administration through a `Manage tags` dialog in the
Tag shelves section. It lists every tag with its game count and supports create,
rename, merge, and delete. Names preserve user-entered capitalization but are
unique after trimming surrounding whitespace and ignoring case.

Renaming to an existing normalized name requires confirmation and merges the
tags by unioning memberships. Merge and deletion update active recommendation
presets, while historical recommendation runs retain the tag names captured
when they were created.

Tag shelves may be sorted alphabetically or by game count; alphabetical is the
default. Library filtering remains available. Tune exposes personal tags under
More filters, visually separate from IGDB metadata. Selected tags apply one
soft, capped, any-match boost regardless of how many selected tags a game
matches.

Calculated system shelves include in-progress, Previously completed, backlog,
handheld picks, and Games with DLC, alongside play-soon, replay-candidates,
favorites, hidden, and abandoned shelves. Calculated series/franchise shelves
continue to derive from IGDB collection and franchise evidence.

## 5. DLC and Unresolved Steam DLC

DLC catalog entries:

- Must point to one existing base game.
- Are created from the base-game detail fetch flow, the Create DLC dialog for
  manual games, or by acquiring a wishlist DLC.
- Carry no library entry and no play state, ever (owned or wishlisted), so
  they never influence play-state counting; backlog progress stays
  base-game only.
- Do not enter play-next recommendations directly.
- May be deleted individually.
- Are deleted through an explicit cascade when their base game is deleted.

DLC acquisition is manual and per game; Steam owned sync never creates or
implies DLC ownership because the owned-games API cannot report DLC
reliably. From a base game with a Steam App ID, the DLC section offers a
fetch-DLC-list action: Steam appdetails dlc IDs resolve to names through one
batched IGDB external_games query (falling back to appdetails or raw App
IDs), and the user picks owned DLCs from an ephemeral unchecked list.
Checked items are marked acquired as catalog DLCs with IGDB enrichment
queued from the exact Steam App ID; DLCs without an IGDB match are still
created unenriched with a visible no-match state. Unchecked items are never
persisted, and re-fetching re-offers them. Already-owned or wishlisted DLCs
appear disabled with badges. Manual games without a Steam App ID keep the
Create DLC dialog and IGDB name-match enrichment.

The unresolved-DLC queue becomes wishlist-import only (the owned-sync source
is retired and existing OWNED_SYNC rows are removed), keeping its manual
review actions:

- Link the DLC to an existing base game.
- Create the base game and DLC together from Steam in one confirmation.
- Discard temporarily.

Discarded wishlist entries remain stored and reappear as pending during the
next wishlist import if they are still unresolved.

### IGDB metadata for DLCs

Catalog DLCs and DLC wishes carry their own replaceable IGDB snapshots
(description, first release date, cover, artwork) instead of displaying only
the base game's data. Identity resolves from the base game's captured IGDB
relations (exact kind and normalized-name matches auto-apply; name variants
go to review) and, for Steam-sourced DLCs, from the exact Steam App ID
through IGDB external_games. Acquired DLCs enqueue enrichment from their
exact Steam App ID at acquisition; manual DLCs enrich through IGDB name
matching.

Each catalog DLC gets a dedicated detail page with its metadata and artwork
and a visible link to its base game, which remains required in the catalog.
The base game's DLC section presents cover cards linking to DLC pages with
IGDB match status and hosts the fetch-DLC-list action. DLCs never appear in
the library grid or list; the library gains a Has-DLC filter chip following
the handheld-filter pattern, and Collections adds a Games-with-DLC system
shelf in a later feature.

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
deduplicated, including semantically identical platform assignments created by
system-added and manually added Steam records. Unresolvable relations become
explicit conflicts. DLC from the discarded base is reassigned to the survivor;
equivalent DLC is not deleted automatically.

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

## 7. Metadata and IGDB

IGDB is the primary metadata, artwork, and playtime provider, fully replacing
RAWG as part of the IGDB-as-primary-provider feature. Catalog and wishlist
enrichment reuse this provider boundary. The transition is a clean restart: no
legacy RAWG snapshots are preserved; provider data rebuilds after a database
reset through the documented export, restore, and re-enrichment procedure.

- Global catalog button opens a modal.
- Detail pages have an individual load button.
- Manual catalog forms suggest IGDB matches.
- Manual refresh warns before overwriting existing metadata.
- Existing metadata is treated in the UI as present or absent.
- IGDB snapshots are replaced, not historically retained.
- A high-confidence automatic match or a user-selected match fixes the IGDB
  identity until the user changes it. Incompatible base-game/DLC candidates
  are never applied automatically; ambiguous candidates remain unmatched for
  manual review.
- Steam's initial import queues enrichment for every imported game.
- Manual Steam synchronization does not automatically start IGDB enrichment.
- IGDB failure never fails or rolls back Steam import.

Initial metadata:

- Cover artwork plus landscape artworks and screenshots for hero imagery.
- Genres, themes, and keywords.
- Release date (IGDB first release date).
- Summary description.
- Alternative names.
- Developers and publishers (IGDB involved companies).
- ESRB age rating when IGDB provides it; absent or incomplete ratings stay
  unknown and never imply a maturity classification.
- Official website.
- IGDB updated date and local fetched date.
- IGDB `aggregated_rating`, community `rating`, and `total_rating` are stored
  as distinct attributed fields with their sample counts. `total_rating` is
  the recommendation quality basis and `aggregated_rating` is its fallback;
  no separate Steam-rating provider is introduced.
- Collections, franchise, explicit DLC/expansion/remake relations, and game
  modes with multiplayer modes stored as series and structural evidence.

Videos, achievements, and system requirements remain deferred.

### Screenshots and artwork

Screenshots and artwork arrive with the IGDB enrichment pass alongside derived
palettes:

- Source: the IGDB game's `screenshots` and `artworks` references, captured
  in the same enrichment pass; up to six screenshots (image URL, width,
  height) persist in the replaceable IGDB snapshot. No binaries are stored.
- Compact/portrait spaces such as Library cards use the cover. Wide hero and
  background spaces choose the first available resource in this order:
  landscape artwork, screenshot, cover, then the existing deterministic
  metadata-missing fallback. Hero and card imagery use IGDB's named image
  sizes (for example `t_720p` and `t_screenshot_big`).
- Palette derivation extracts the dominant-color palette from stored artwork
  bytes exactly as before; re-enrichment re-derives it.
- Display is a dedicated carousel-style section near the bottom of the
  catalog game detail page and the wishlist detail page (base-game
  wishes), separate from the metadata block.
- Reduced-data mode renders the section as a token-only placeholder with
  zero image fetches; reduced motion keeps the carousel manual.
- Attribution follows the provider images rule.

IGDB attribution appears near IGDB data or images and in a
`Powered by / Data and content providers` section. Credentials remain
server-side and IGDB API and attribution constraints are respected.

### Playtime estimates

Dedicated playtime evidence replaces the RAWG duration number for duration
banding and estimates display:

- Sources: IGDB `game_time_to_beats` (hastily, normally, completely, and the
  sample count) as primary evidence, with SteamSpy median playtime fetched
  automatically as fallback only when IGDB has no row and a confirmed Steam
  App ID exists. RAWG `playtimeHours` is not a fallback:
  duration derivation and estimates display use the two providers only.
- Display mapping: the `hastily` average is the history-main estimate,
  `normally` is history-plus-extras, and `completely` is the completionist
  estimate. All available values and their source appear in a disclosure
  control; the selected duration profile determines the initially visible
  value. RAWG's separate extra line disappears.
- Identity keys off the confirmed Steam App ID through IGDB `external_games`;
  games without an App ID may resolve through a confirmed name search with
  visible provenance.
- Stored as replaceable, attributed evidence with provenance and a freshness
  window; failure preserves the last usable data and never blocks other
  enrichment.
- Display appears on game detail and wishlist detail, and the selected
  estimate also appears on Library and Wishlist cards. Games without provider
  rows show unknown duration, like any other missing provider evidence.
- Queueing semantics are a spec decision. Duration remains soft evidence in
  recommendations.

## 8. Asynchronous Enrichment and Provider Operations

Manual entries and Steam imports are saved immediately and provider work runs
asynchronously. The sequence is: save the record, run IGDB when available, then
queue compatibility after a successful IGDB result. Metadata refresh repeats it.
Initial Steam import queues every imported game. The UI shows individual states
and batch progress for Steam, IGDB, and compatibility. Provider work is persisted
in PostgreSQL, rate-limited, and processed in batches. Transient failures retry
up to three times with increasing delay; final failures remain visible and can be
manually retried. Failure never removes personal or prior valid provider data.

## 9. Wishlist, Prices, and Steam Import

Wishlist entries are useful either as reminders or planned purchases.

### Local wishlist and acquisition

The first wishlist feature is provider-independent:

- Base-game wishes are independent; DLC wishes link to owned catalog games.
- Provider and external identifier are optional.
- Local interest is stored locally; wishlist notes are not part of the model.
- Wishlist forms and a global wishlist action suggest/load IGDB metadata for base games.
- A base game can be acquired manually into the catalog.
- Wishlist IGDB metadata transfers to the new catalog game when available.
- The acquired base wishlist entry is removed.
- Acquiring a wishlist DLC creates the catalog DLC under the base game and offers
  an optional prompt to update the base game's play state (e.g. `PLAN_TO_PLAY` or `replay: true`);
  the acquired DLC itself carries no library entry or play state.

### Price enrichment and opportunity signals

Price enrichment is a separate feature:

- The Wishlist has one explicit global `Update prices` action. It queues all
  entries whose store identity has been confirmed and reports refreshed, failed,
  and identity-required entries.
- Individual price refresh or retry is out of scope initially.
- Daily scheduling is deferred to deployment. Vercel Cron will securely trigger
  the same persistent queue; it enqueues work and returns quickly instead of
  performing all provider calls in the request.
- Queue claims and scheduled runs are idempotent and mutually exclusive so a
  duplicate or overlapping trigger does not repeat provider work.
- `targetPriceMxn` is optional.
- Steam and ITAD are compared without global or per-entry source preference.
  The cheapest valid Mexican offer is selected; its store and source remain
  visible, alongside all other valid alternatives.
- Key-store offers may be selected when cheaper, but must prominently warn that
  regional activation in Mexico must be verified on the seller page.
- Every valid offer remains visible whether or not the entry has a target price.
  A fresh selected offer at or below the target creates an opportunity signal.
- An entry without a target price remains eligible for later buy recommendations
  based on local interest and offer quality, but has no target-hit signal.
- An offer is stale after 48 hours. Stale offers retain price, store, source, and
  age for comparison, but cannot create a strong opportunity signal.
- Transient provider failures retry at most three times with increasing delay.
  Final failures remain visible in the global result and can wait for the next
  global or scheduled refresh.
- Price refreshes never create or replace a recommendation run.
- The seller page remains authoritative for regional activation.
- ITAD is optional, server-side, read-only enrichment.
- The integration uses the selected supported ITAD `country` code, caching,
  rate-limit handling, and `429`/`Retry-After` behavior. Supported regions are
  Mexico, United States, Canada, Brazil, Colombia, and Argentina; no fallback
  market is offered for other regions.
- No ITAD OAuth, Waitlist synchronization, notifications, webhooks, or
  automatic purchasing is included. Display-currency conversion is allowed only
  as a user-selected, external-FX presentation layer; it never changes the
  regional ITAD result, provider amount, seller price, or purchase decision.
- For each entry, the cheapest 8-10 valid offers are persisted; the selected
  offer is the cheapest; alternatives render in an expandable view showing
  store, source, price, discount, and freshness.
- Historical low is display-only context next to the current price. It never
  creates or strengthens signals.
- `targetPriceMxn` edits inline on each wishlist row, plus the edit form.
- An active opportunity renders as a badge on the wishlist entry itself; no
  separate section exists in this feature.

### Regional price presentation

Welcome records one supported ITAD market country and one display currency.
The initial country catalogue is Mexico, United States, Canada, Brazil,
Colombia, and Argentina. Its display currencies are MXN, USD, CAD, BRL, COP,
and ARS.

ITAD receives the selected country code and its regional activation warnings
apply to the returned offers. Settings lets the owner change the supported market
country and display currency after Welcome, but warns that they must manually
refresh prices before offers reflect the new selection. Stored offers retain the
exact ITAD currency and amount. When the chosen display currency differs, Frankfurter v2 converts the
returned amount for display only. USD is the normal conversion basis when ITAD
returns USD, but a non-USD provider result remains its own
source currency and is never relabeled as USD. Converted values must be clearly
labeled as estimates, retain the original provider amount, and become
unavailable rather than guessed if an FX pair cannot be fetched. Cheapest-offer
selection, targets, discount calculation, and seller warnings use comparable
source/region amounts and must not compare guessed conversions.

### Price identity resolution

A wishlist entry becomes priceable only after its store identity is
confirmed. Identity has three paths, each recording provenance:

- **Steam wishlist import**: entries created by import carry their verified
  Steam App ID as confirmed identity.
- **Manual entry**: the wish form accepts a Steam store URL or raw App ID;
  the URL is parsed and stored as user-confirmed identity. This also serves
  as the override path.
- **IGDB suggestion**: IGDB enrichment resolves the wish's IGDB identity and
  captures the Steam App ID from `external_games` when present. A derived
  App ID from a fixed high-confidence or manual match is applied
  automatically, remains editable, and replaces the retired RAWG store-links
  path and the Steam `storesearch` fallback with an exact provider mapping.

Provenance travels with the identity so the price queue's "confirmed
identity" rule stays honest. ITAD mapping uses a cached
Steam-App-ID-to-ITAD-ID lookup; the mapping is stable and cached
indefinitely. Prices load in batched calls (`country=MX`, up to 200 games
per request). Keyshop-flag mechanics are validated during the feature spec.
Known caveat, accepted: the ITAD ToS asks private API users to make contact;
registration happens through their app-setup page.

### Manual Steam wishlist import

Steam wishlist import is a later, manual feature distinct from owned-library
synchronization:

- A visible Wishlist action starts the import; Settings may link to status
  later. It never runs automatically.
- A newly imported base-game entry with a reliable, previously unknown Steam
  App ID creates a wishlist entry automatically with interest `2`/`5`, then
  queues the existing wishlist IGDB enrichment flow.
  Existing local snapshots are never overwritten by import.
- Local matching reuses the feature 7a normalized-name matcher. Any
  candidate - exact names included - goes to persistent review; linking is
  **never automatic**. Linking stores the Steam App ID with provenance onto
  the local entry, so later imports skip it silently.
- Ignored review entries stay suppressed across imports until manually
  restored.
- An item already present in the owned catalog is omitted silently.
- Unresolved Steam DLC is a wishlist-import-only persistent queue (the
  owned-sync source is retired with existing rows removed). A Steam DLC
  whose base game is wished but not owned stays queued and resolves
  naturally on a later import after the base game is acquired.
- Steam title changes and removals do not modify local data; they surface
  only as non-authoritative sync status shown in a compact Wishlist-header
  chip backed by a server-side last-run summary.
- Each import ends in a persistent result panel: created, linked, queued
  reviews, ignored, and enrichment status. Idempotent by Steam App ID.

Provider outages never erase the last valid data. The app retains the result,
marks it stale, displays its age, and allows manual refresh.

### Wishlist detail page

Each wishlist entry gets a dedicated detail page at `/wishlist/[id]`, reached
by linking the card title in the wishlist list. It composes all available
wishlist data in one place:

- Name, base-game or DLC type, and the base-game link for DLC wishes.
- Full IGDB metadata snapshot when present: description, genres, release
  date, playtimes, artwork, and the IGDB source link.
- The IGDB screenshots carousel and derived-palette themed surfaces when a
  snapshot with artwork exists (base-game wishes; DLC wishes carry the
  owned base game's evidence instead).
- Steam identity and provenance, including the add/edit/remove controls and
  the automatically applied IGDB-derived identity.
- Offer block: selected offer, alternatives, target price, opportunity
  badge, and freshness.
- Local interest and the other retained personal fields.
- Edit, acquire into the catalog, and delete actions, composed as a focused
  action area and repeated selectively in the hero when useful.
- A read-only compatibility section (see Compatibility Synthesis) for base
  games with a confirmed Steam App ID.

Two per-entry actions exist on the detail page:

- **Compatibility refresh** for base-game wishes with a confirmed Steam App
  ID. Inline, quiet, fail-silent like the auto-trigger.
- **Fill-only IGDB enrichment**: automatic/batch enrichment runs only when no
  snapshot exists. A user-requested refresh or changed IGDB identity may
  replace the snapshot after an overwrite warning.

These two actions are the only per-entry surfaces; batch progress and error
details stay out of the wishlist.

## 10. Compatibility Synthesis

Compatibility evidence serves the Linux targets in the configured setup: the
primary OS when it is Linux, and a Linux handheld when one is configured.
ProtonDB and AWAY evidence keys off a Steam App ID and represents Linux
playability for any Linux device; the app does not maintain a separate
per-device Linux layer. Windows is derived from that evidence only when the
primary OS is Linux and a Windows fallback is configured - the fallback OS
is always Windows when one exists, and it is absent when the primary is
Windows or when the owner has no Windows machine. When no fallback exists,
evidence that would otherwise recommend the Windows fallback instead marks
the game as not practically playable on this setup. When the primary OS is
Windows and no Linux
handheld is configured, the entire compatibility flow is inactive: no
auto-queue, no sweeps, no per-game refresh affordances, no compatibility
sections or tags, and no compatibility factors in recommendations.

Compatibility display is gated per setup and per game, so it only appears
when it makes sense:

- On an active Linux setup, games with a confirmed Steam App ID (non-ROM,
  base game) show full compatibility UI: card tags and detail sections.
- Catalog games without a confirmed App ID get the manual "add Steam App ID"
  affordance on the detail page only; cards show no tag rather than a hollow
  placeholder.
- Wishlist entries without a confirmed App ID and DLC wishes show nothing.
- On an all-Windows setup, no compatibility UI renders anywhere, including
  hidden or disabled controls.

Card tags on active Linux setups use four distinct states: evidence (tier
and/or anti-cheat known), unknown / not yet checked, stale (past the 180-day
window, as its own state for sweep-coverage scannability), and absent (no
tag at all when identity or eligibility is missing). Detail pages keep their
richer freshness treatment regardless of card state.

Changing the OS setup (primary OS, fallback flag, or handheld) in Settings
asks for confirmation with a dialog describing the consequence, then
immediately re-derives compatibility synthesis and synchronously
regenerates recommendation runs under the new setup. The re-run uses normal
run semantics - a fresh run record, retained batches, and exposure
cooldowns still apply - replacing the previous tuned run.

All provider evidence keys off a Steam App ID. Catalog games without one get
a manual "add Steam App ID" affordance on the detail page, writing into the
existing `ExternalGameId` table with user provenance; evidence queues
automatically once present.

Games whose only availability source is ROM are fully exempt from the
pipeline: no identity entry, no queueing, no unknown warnings. Their
compatibility reads as **not applicable**, not unknown. Mixed availability
still receives Steam-based evidence.

Sources:

- ProtonDB is primary for Linux reports, with its tier and a single
  per-game ProtonDB link shown as evidence.
- Anti-cheat evidence comes from the AreWeAntiCheatYet crowdsourced dataset,
  cached like other providers and shown separately; absent data stays explicit
  unknown.
- Windows is derived from effective Linux evidence: a game ready without
  tinkering needs no fallback, tinkering or degraded Linux support recommends a
  fallback, and denied/broken anti-cheat, not-playable Linux evidence, or
  unknown Linux evidence requires it.

Mixed evidence shows all sources with attribution. Personal overrides apply
to the Linux evidence only while compatibility is active, take priority, are
never overwritten, and consequently affect the derived Windows fallback.

Wishlist entries with a confirmed Steam App ID (both `steamAppId` and
`steamAppIdProvenance` set) show the same ProtonDB and AWAY evidence with the
derived Windows fallback on their own detail page. Wishlist evidence lives in
parallel storage keyed by `wishlistEntryId`
(`WishlistCompatibilitySnapshot` and `WishlistEnvironmentCompatibility`),
never shared with the catalog: a bought game leaves the wishlist, so reuse
would buy nothing. Wishlist evidence is provider-derived only - no personal
compatibility override - and applies to base-game wishes with a confirmed
Steam App ID; DLC wishes are skipped because their Linux compatibility is
already carried by the owned base game.

Wishlist compatibility runs through its own jobs, separate from the catalog
queue. Any confirmed identity auto-queues evidence silently - Steam import,
manual URL/AppID paste, or IGDB suggest-and-confirm - as an inline call that
catches and hides provider errors. A quiet async manual sweep covers existing
confirmed-identity wishes: it confirms "sweep started", shows a completion
toast, and persists a PriceRefresh-style run record with overlap protection;
per-entry refresh on the detail page is inline and equally quiet. Absent
evidence shows a simple "compatibility details not found" note on the detail
page instead of batch progress or error surfaces.

Freshness uses a single **180-day window** across all evidence types. Stale
evidence keeps its values, shows its age, and produces a visible
recommendation warning - never a penalty. Refresh triggers are the post-IGDB
automatic queue and per-game manual refresh. A global compatibility sweep is
already available from Settings; feature 18 may expand or relabel those
controls. The deployment feature's daily cron enqueues a compatibility
freshness sweep for catalog and wishlist evidence older than the window,
alongside the price refresh, and the sweep is a no-op while compatibility is
inactive. Provider
endpoint stability (ProtonDB summary endpoint and AWAY dataset shape) validates
during the feature spec.

## 11. Recommendations

The recommendation engine has two distinct outputs:

- `play-next`: games already present in the catalog.
- `buy`: base games and eligible DLC entries in the wishlist.

Recommendations are explainable, private, and adaptive. A stable scoring
baseline remains visible, while an adaptive re-ranker uses provider metadata,
explicit preferences, and observed personal activity to diversify candidates
without becoming an opaque or externally hosted model. Each item stores visible
factors such as:

- Play state.
- Main-game and hidden flags.
- Priority and declared interest.
- Availability sources and any active play-next source tune.
- Game experience / intention and compatibility.
- Handheld-suitability personal flag on catalog and wishlist entries.
- IGDB genres, themes, keywords, release era, publisher, sequel relationship
  where confidently known, ESRB context when available, and `total_rating`
  with `aggregated_rating` fallback and sample-size confidence.
- IGDB/SteamSpy playtime estimates with attribution when present; RAWG
  playtime is retired from duration derivation and estimates display.
- Steam playtime and recency when available, with manually marked play history
  as the safe fallback from a new import onward.
- Price and target-price status.
- Provider freshness.
- DLC base-game affinity (ratings, completion status, replay flag of the owned base game).
- Calibration adjustment.
- Recent recommendation exposure, controlled rotation, and an explicit
  out-of-the-box or change-of-pace rationale.

**Eligibility**

- `play-next`: base games that are not hidden, are not the main game, and are
  either `NOT_STARTED` or explicitly replay-flagged after a prior completion or
  abandonment. `IN_PROGRESS` games appear separately on the dashboard. DLC
  never enters play-next. Hidden is an eligibility rule only: it prevents the
  game from becoming a displayed candidate, but does not erase explicit
  completion or abandonment history from the recommendation profile.
- `buy`: all wishlist base games and DLC wishes whose base game is owned.
  Entries without confirmed identity or offers stay eligible on interest
  alone, carrying an explicit "no pricing yet" warning. ROMs are excluded
  from purchase recommendations.

**Ranking semantics**

- Manual fields remain authoritative. **Interest** (`0-5`) is durable personal
  desire or expected enjoyment and is the core taste signal for play and buy.
  Interest defaults by ingestion path: Steam library and wishlist imports
  start at 2/5, manual entries start at 3/5, and acquiring a wishlist entry
  into the catalog carries its interest over, falling back to 3/5 when absent.
  **Priority** (`NONE`/`LOW`/`MEDIUM`/`HIGH`) is a catalog-only, short-term
  urgency signal for play-next; it never means the user likes a game more.
  Detail, quick-create, and bulk-edit surfaces explain retained personal fields
  with accessible information controls instead of permanent descriptions, and
  group compact controls on the same row where they remain readable.
- Play-next source tuning is a modest, inclusive boost—not a filter or a
  launch requirement. It can prefer Steam, ROMs, any alternative source, or
  selected alternative sources. A multi-source game matches every selected
  preferred source. Source matching cannot discard Steam or other eligible
  games merely because the preferred-source pool is small.
- Source tuning is stored in the existing play tune context and named presets,
  not as a separate global preference system. Each affected recommendation
  visibly explains its source boost and shows the matched source icon. Source
  tuning never affects buy recommendations, wishlist eligibility, seller
  ranking, or price comparison.
- Compatibility is a small practical-fit signal for the intended environment,
  not a hard gate, with two sanctioned exceptions. Confirmed fit may boost a
  recommendation; unknown, stale, or poor evidence surfaces caveats and can
  reduce practical fit, but does not declare a game unplayable or silently
  exclude it. On all-Windows setups compatibility is inactive and contributes
  no factors, floors, or caveats; environment fit derives from the configured
  devices instead. The first exception: on a Linux setup without a Windows
  fallback, evidence that would derive "fallback needed" (denied/broken
  anti-cheat, not-playable Linux, or unknown Linux evidence where a READY
  floor applies) hard-excludes the game from all play roles with a visible,
  explained reason. The second exception: that no-fallback exclusion does not
  apply to a game the owner flagged as handheld-suitable when the setup
  includes a Windows handheld - the game remains playable there and the
  explanation says so; non-flagged games keep the heavy practical-fit penalty
  instead. A play role left with no remaining candidate is absent from the
  run, consistent with the existing role rule. The same evidence class never
  hard-excludes from buy recommendations or wishlist discovery; there it
  applies a heavy practical-fit penalty plus a caveat, never exclusion.
- Buy offer quality: fresh-offer discount percentage earns points; proximity
  to the historical low breaks ties; stale offers contribute zero
  offer-quality points, consistent with the 48-hour rule.
- DLC base-game affinity is boost-only: an owned base rated >=4/5, completed,
  or replay-flagged grants one fixed boost tier named explicitly in the
  explanation ("base game X was completed"). Affinity never lowers a score.
- Publisher, release-era, quality, series, genre/tag, duration, and mature or
  casual context are soft evidence only. Sparse provider data, low rating counts,
  or uncertain series links lower confidence rather than fabricating preference.
- No alphabetical tiebreak decides what a person sees. Near-equal qualified
  candidates use stable, weighted rotation and short exposure cooldowns.

Tune this run is opt-in and presented as a distinctive, visually deliberate
control rather than a plain accordion. It starts collapsed with no active
filters, selected checkboxes, or implicit non-neutral choices. Its questions
are:

- **How much time?** Any, Under 6 hours, 6-20 hours, 20-50 hours, or 50+ hours.
- **How do you want to play?** Any, Solo, Online with others, or Couch co-op.
- **What feels right?** Familiar, Balanced, or Different.
- **Handheld** is a separate combinable toggle for Play Next only.

Genres, IGDB metadata tags, personal tags, sequel posture, era, maturity, and
play-next source preference remain available under More filters. Personal tags
are identified separately from provider metadata and may be selected as target
tags for a soft, capped, any-match boost. All of these controls default to no
selection. A selected known conflicting play mode is excluded. Missing play-mode
metadata may remain only as a lower-confidence fallback with a visible "Play
style unknown" caveat.

Familiar boosts games matching both learned history and manually preferred
genres/tags. If no familiar match exists, a normally ranked eligible game may
appear with a "No familiar match" caveat. Balanced leaves existing scoring
unchanged. Different strictly favors eligible games outside those familiar
signals; if none exists, the affected role is absent rather than falling back.

Tune choices remain local to a single browser tab, survive reloads in that tab,
and clear when that tab closes. They take effect only when the user explicitly
selects Update recommendations. Named presets persist as reusable shortcuts but
load only into the tab-local Tune state. Each generated run still retains its
applied context and explanations.

Each run retains its context, explanations, and qualified candidate batches.
Play Next keeps two general fit roles: **Best Fit** and
**You Might Also Enjoy**, plus Out of the Box and Change of Pace. When the
configured setup includes a handheld, Handheld is added as a fifth possible
role rather than replacing a Best Fit. It is the highest-ranked candidate that
is both play-eligible and marked handheld-suitable under the existing
environment-fit rules. A role without a qualified candidate is omitted
silently.

When the Handheld Tune toggle is selected, every Play Next role is strictly
limited to handheld-suitable games. Buy labels its second general fit pick
**You Might Also Enjoy** as well. Its existing normal and deal-saturation
composition remains otherwise unchanged: two general fit picks and one deal,
or one general fit and two deals under saturation. Deal picks must still clear
fit and quality floors; a discount never wins by itself.

An unhidden `ABANDONED` game explicitly marked as a replay candidate may be a
low-priority second-chance consideration for the Out of the Box role only when
stronger fit, compatibility, and tune signals do not point to another qualified
candidate. It receives a visible second-chance explanation and never reserves
or guarantees that role.

Across every recommendation surface, neutral `Show another`, separate dismiss
controls, and optional dismissal reasons are replaced by one action:
`Maybe some other time — show me another`. It records a dismissal and
immediately replaces the item from the retained candidate batch for the same
role without creating a new run. If no replacement exists, that role disappears
from the current presentation. Exposure cooldowns and retained batches continue
to prevent immediate repetition. Daily price refreshes do not create or replace
a run.

A persistent dismissal counter remains separate for play-next and buy
recommendations. After three cumulative dismissals of the same recommendation
type, adjusted interest decreases by one point, with a floor of zero.

The user-entered interest remains manually editable. When automatic calibration
has changed it, the detail view explains that the value was adjusted because of
repeated recommendation dismissals. The technical counter remains an internal
implementation detail. Starting a catalog recommendation is an explicit action:
it marks the game `IN_PROGRESS`; when no other game is in progress it also
makes it the main game, otherwise it asks before replacing the main game. When
starting from `COMPLETED`, it also activates `completedBefore` and clears the
consumed replay flag.

### Cold start, learning, and control

Recommendations remain hidden until Taste Setup is saved. Taste Setup becomes
available only when the library has at least ten base games; before that point,
it explains that more library games are needed instead of exposing generated
recommendations. It presents a random sample of owned games and lets the user
independently select `Played before`, `Recommend more like this`, and `Would
like to play soon`. `Played before` is preselected when `completedBefore` is
already true and, when selected, sets that field without changing the current
play state. `Recommend more like this` teaches the engine from the game's
metadata and personal details; selecting it together with `Played before` is a
strong interest signal. `Would like to play soon` sets `playSoon`. `Pick
another` swaps only that game for a fresh random library game and creates no
negative signal. Taste Setup no longer asks for preferred environment; game
experience remains the relevant personal fit field. Progressive one-tap prompts
after viewing, starting, dismissing, or completing games invite useful
personalization without requiring a bulk data chore.

Recommendation-owned data stays private in PostgreSQL and remains separate
from authoritative catalog fields and replaceable provider snapshots:

- `RecommendationRun` and its items retain context, visible results,
  explanation factors, and candidate batches for 12 months.
- Append-only recommendation events record meaningful exposure, taste-setup
  answers, starts, completions, abandonment, and dismissals.
- Explicit current-state transitions and the independent prior-completion flag
  remain profile evidence even when the game is hidden. Current and prior
  completion consolidate into one positive completion signal. A prior
  completion and a current `ABANDONED` state remain distinct positive and
  negative evidence. Existing event weights and recency decay remain unchanged;
  hidden games remain ineligible as candidates.
- A rebuildable derived profile aggregates preferences for genres, tags,
  experience, length, publisher, era, series, and maturity.
- User-editable preferences use semantic `Prefer`, `Neutral`, and `Avoid`
  overrides instead of exposing raw weights. Settings shows the learned profile,
  its evidence, and these controls.
- Presets hold named optional Tune-this-run contexts.

Events phase out by usefulness: exposure after 90 days; runs, starts, and
dismissals after 12 months; played, completed, abandoned, and taste-setup events
after 24 months. Derived preferences rebuild from the retained events and use
recency decay before deletion. `Restart recommendations` immediately deletes
all recommendation-owned runs, events, derived profiles, preferences, and
presets, while preserving the catalog, ownership, and personal catalog data.

After Taste Setup is saved, the `Update recommendations` action lives on the
Today dashboard header and empty state, and is reachable from the Library and
Wishlist headers.

## 12. Today Dashboard

The dashboard is the post-login front door and primarily a local composition
view. It recalculates local summaries when it loads. It never silently runs a
full Steam sync, imports games, or refreshes IGDB, pricing, or compatibility.

It displays:

- Main game.
- Games in progress.
- Active-backlog progress derived from current backlog/in-progress status and
  independent completion history. A replay may be both `IN_PROGRESS` and marked
  previously completed without being double-counted; `ABANDONED` games appear
  separately and are excluded from the denominator.
- Two independent, actionable coverage counts:
  - catalog base games without an IGDB metadata snapshot;
  - visible catalog games with an incomplete recommendation profile.
- A recommendation profile is incomplete when `interest` is absent, or when
  interest is present but neither priority other than `NONE` nor game
  experience/intention is present. Hidden games are excluded. Rating and the
  default play state do not satisfy this signal.
- Clickable coverage counts open accessible dialogs with up to ten affected
  game titles linking to their game details. The dialog can expand into a
  paginated list for additional games.
- After Taste Setup is saved, the latest play-next run's stored roles (Best
  Fit, You Might Also Enjoy, qualified Out of the Box, Change of Pace, and
  Handheld when configured and qualified) and, only when wishlist entries
  exist, the latest buy run's stored roles (fit and deal picks per the
  documented deal-saturation rule); these remain the latest explicitly
  generated runs.
- Up to five games recently played on Steam, showing last-played date and
  accumulated playtime. Recent activity may include games not yet imported into
  the catalog; those entries visibly suggest the existing manual library sync
  and never create or link catalog records automatically.
- Recent Steam activity refreshes at most once per 24 hours when Today loads,
  through a narrow activity query and a separately persisted cache. A fresh
  empty response displays "no recent Steam activity"; a failed refresh retains
  the last usable cache and reports freshness/error only in the activity
  section, not as a global sync operation.
- The three best current offers among wishlist entries, sorted primarily by
  discount percentage, then by price or target-price status.
- Offer discount percentage, final MXN price, store, source, freshness, links
  to wishlist details, and then to the external seller page.
- Provider freshness plus background-operation progress/failures and their
  existing manual refresh or retry actions.

Dashboard layout, visual hierarchy, theming, and charts are deliberately
deferred to the feature-14 prototype and visual-foundation work.

## 13. Visual Personalization and UI Tidy-up

### Global visual foundation & design system review

Direction is **dark-first**, derived from the reference material in
`blueprint/reference/`:

- Deep charcoal and navy surfaces in dark mode; warm off-white or blue-gray
  surfaces with navy/carbon text in light mode. Light mode is the same visual
  identity, not a literal color inversion.
- **Dual-accent semantic tokens**: cyan/teal for interactive elements,
  progress, and ready states; magenta/pink for opportunity signals, deals,
  and buy recommendations; amber for warnings, stale evidence, and mixed
  compatibility.
- Rounded cards, pill buttons, and badge chips as the component baseline on
  shadcn/ui tokens.
- Bold display typography reserved for page headers and hero moments.
- Technical monospace typography for small labels, source/provider evidence,
  freshness, and compact operational context.
- Desktop icon sidebar and mobile bottom navigation.
- `/prototype` runs before feature 14 to lock the look against the references
  in throwaway mockups.

Feature 14 ports the approved shared `prototypes/theme.css` token direction
into the application and treats the existing Today, Library, Wishlist, and
Game Detail mockups as its composition references. Wishlist Detail, Collections,
and Settings extend that same system during implementation rather than starting
another prototype cycle.

The application shell and existing components must support:

- Light, dark, and system modes.
- Accessible contrast, semantic color tokens, and readable overlays.
- Standardized card layouts, badge hierarchies, and sheet/modal behaviors across
  all views (Library, Game Detail, Wishlist, Dashboard, Settings).
- Full-app visual polish and component cleanup.
- Reduced-data and reduced-motion behavior where applicable.
- Stable local fallback visuals.
- Settings-controlled behavior.

Theme mode defaults to dark Sunset and may be overridden manually.
Reduced motion and reduced data also respect system preferences by default and
may be overridden manually from the visual/accessibility portion of Settings.
These controls use a non-migrating visual-preference mechanism. Reduced motion
disables carousel auto-advance and nonessential animation. Reduced data uses
token-only fallbacks instead of remote artwork. These visual preferences are
part of the feature-14 foundation; sessions, provider controls, queue
operations, diagnostics, and JSON export remain feature 18.

Existing IGDB artwork may appear in cards, carousels, and page moments only
behind readable contrast overlays. Missing artwork and reduced-data mode use
the deterministic abstract fallback system. Feature 14 does not derive or
persist per-game palettes; that server-side enrichment concern remains feature
17.

Feature 14 changes presentation and small interaction composition only. It does
not add providers, migrations, queue work, background work,
price/recommendation logic, persistent data mutations, or different catalog,
wishlist, compatibility, and provider-data boundaries.

### Today dashboard hierarchy

Today remains the post-login decision dashboard and retains the existing local
composition rules from section 12. It does not launch games or silently run a
sync, price refresh, enrichment, compatibility refresh, or recommendation run.

Its first viewport is divided into two equal, independently useful surfaces:

- **Currently playing** - a carousel led by the existing main game, followed
  by existing `IN_PROGRESS` games. Each slide can show artwork, current state,
  active-backlog context, playtime or recent activity where available, and
  links to the existing game detail. It never claims to resume or launch a
  game.
- **Featured offers** - a carousel over the existing fresh Today offer ranking:
  up to three selected valid offers, ordered by the current discount,
  target-hit, price, and stable-name rules. It shows returned currency, store,
  freshness, and links to the existing wishlist detail and seller without
  introducing a second offer-ranking contract.

Both carousels have visible manual navigation, position indicators, keyboard
access, slow and discreet auto-advance, and pause on hover or focus. Under
reduced motion they remain manual. When data is absent, their place is retained
by a contextual empty state such as selecting a main game, browsing Library,
or manually updating prices; these prompts never trigger hidden provider work.

**Play Next** and **Buy** each use a spotlight carousel. Every slide places game
art next to useful metadata and the recommendation reasoning. The three or four
strongest factors appear first; remaining factors and caveats are available
through an accessible disclosure. Missing roles produce fewer slides without
placeholders or omission messages.

`View details` is the primary action. Play Next retains `Start playing` as a
secondary action. Buy opens Wishlist Detail rather than sending the user
straight to a seller. In the Wishlist Detail hero, the provider name in the
selected-offer sentence links directly to the external offer.

The recommendation carousels advance every ten seconds, pause on hover, focus,
touch, manual navigation, or another interaction, and resume afterward. Reduced
motion disables automatic advancement. Recent Steam activity, data-health
coverage, provider freshness, and background operations remain lower-priority
supporting sections. All existing empty, fresh, stale-on-error, and operation
states stay explicit.

### Visual delivery order

The visual work is delivered in the build-plan order: feature 14 covers the
first five surfaces (14a through 14e) plus the final cross-app acceptance
(14f), each part independently reviewable and preserving the relevant existing
behavior before the next part begins:

- **14a - Theme tokens, modes, preferences, and app shell:** semantic tokens,
  dark/light/system parity, typography, surfaces, cards, responsive navigation,
  and non-migrating theme, reduced-motion, and reduced-data controls.
- **14b - Today decision dashboard:** existing data composed as Currently
  playing and Featured offers carousels, a dominant Play Next Best Fit, the
  remaining stored roles, and the existing Buy and operations context.
- **14c - Library browsing surfaces:** toolbar, filter chips, health strip,
  approved grid/list alternatives, deterministic cover gradients, and restyled
  enrichment, duplicate, empty, and catalog card surfaces.
- **14d - Wishlist browsing surfaces:** signal grid, focus/list alternatives,
  entry-card composition, offers, identity, staleness, target, and interest
  over unchanged queries and actions.
- **14e - Library and Wishlist header action rework:** homogenized header
  actions, operation statuses, and follow-up sections across both pages, plus
  ProtonDB compatibility tags on game cards in both views.
- **14f - Cross-app states, accessibility, and visual acceptance:** loading,
  empty, error, stale, operation, keyboard, focus, target, contrast,
  reduced-motion, reduced-data, mobile, and full-route acceptance review.

The remaining surfaces ship as feature 15:

- **15 - Detail, collection, and supporting route composition:** a Today
  re-pass to match the Library/Wishlist visual state, then game detail,
  wishlist detail, collections, and settings with their dialogs and forms,
  safe artwork overlays, and deterministic fallbacks.

The final acceptance pass covers each primary route and its main flows on
desktop and mobile, in dark, light, and system modes. It includes keyboard
access, focus visibility, target sizing, contrast, reduced-motion/reduced-data
behavior, loading, empty, error, stale, provider-freshness, and operation
states, alongside the existing automated checks. Feature 14 remains
presentation and interaction composition only: it does not add providers,
migrations, queues, background work, recommendation changes, price changes, or
new catalog, wishlist, compatibility, or provider-data boundaries.

### Pre-deployment mobile responsiveness

Before deployment, review the app's mobile layouts and correct every observed
case where text, actions, titles, buttons, or sections exceed the viewport.

- Detail-page More actions must stay fully reachable.
- Sections that cannot fit their available space need the appropriate scrolling
  behavior instead of clipping their content.
- Dense health strips in Library and Wishlist may collapse only on mobile.
- Library and Wishlist list views are simplified for narrow screens while
  preserving their existing information and actions.

### Personal-data composition

Game Detail combines the former Play state and Personal Profile sections into
one compact personal-data surface:

- **Journey:** current state, previously completed, main game, play soon,
  replay, and hidden.
- **Preferences:** interest, rating, priority, game experience, preferred
  environment, and handheld suitability.

Wishlist Detail groups interest, game experience, and handheld suitability
under **Personal fit**. Target price, identity, and offers remain purchase
information. Permanent helper paragraphs are replaced by accessible information
popovers usable by pointer, keyboard, and touch.

### Wallhaven global background

Wallhaven controls the optional global application background:

- SFW candidates only, gathered into a cached pool of roughly ten candidate
  URLs from a small configurable keyword set (default: gaming-art and
  landscape tags). `WallpaperState` stores URLs and selection, never
  binaries.
- Selection rotates deterministically once per day, with a manual shuffle
  action.
- Pool staleness triggers an on-use fetch through the persistent queue; no
  timed background jobs until deployment.
- Reduced-data mode disables the wallpaper system entirely: solid token
  background, zero image fetches.
- Attribution and local fallback when unavailable.

Wallhaven does not determine functional theme colors or override accessibility.

### Per-game detail theme

Each game detail page may use its IGDB imagery and derived colors. Theme
colors derive **server-side during IGDB enrichment**: a small dominant-color
palette (primary plus dark/muted variants) extracted from stored artwork,
persisted in the replaceable snapshot, and applied read-only by the page
under contrast overlays. Missing imagery or reduced-data mode uses the
deterministic fallback; re-enrichment re-derives the palette.

- Theme applies to the catalog game detail page; wishlist detail reuses
  the same themed treatment for base-game wishes.
- The feature respects global theme and accessibility settings.

### Theme families

The application expands from one identity to two palette families, each in
light and dark, giving four selectable palettes:

- **Dawn** - cyan and purple tones; light and dark variants. Dawn refines
  the existing feature-14 identity rather than replacing it.
- **Sunset** - warm orange and yellow tones; light and dark variants.

Rules:

- Each family owns its hue mapping for the semantic roles - interactive,
  deal/opportunity, warning, and danger. Roles stay stable app-wide; the
  family decides which colors fill them, contrast-validated per palette.
- Settings gains a family selector alongside the existing light/dark/system
  mode control; the system preference resolves light/dark within the
  selected family.
- Feature 14's token architecture, accessibility rules, reduced-motion and
  reduced-data behavior carry forward unchanged as the base.
- Typography pairs Cinzel (display) with Inter (body), with the final
  pairing confirmed at the prototype stage; technical monospace evidence
  labels are unchanged.
- `/prototype` runs before implementation to lock the four palettes against
  real surfaces, as it did for feature 14.
- Per-game detail themes compose as a decorative layer over whichever
  family is active.

### Odyssey voice

A text-theming pass replaces generic and placeholder copy on expressive
surfaces with a Homer's Odyssey voice - adventurous, mixing subtle allusion
with named mythology (gods, creatures, places):

- Expressive surfaces: page and section headers, empty states, buttons,
  dashboard moments, and dialogs.
- Operational text stays plain and factual: statuses, errors, provider
  evidence labels, freshness and ages, personal-field helper text, and
  price/compatibility caveats.
- Navigation and section names keep their identity (Library, Today,
  Wishlist); the voice lives in the copy, not the information architecture.
- The sweep covers the whole app in one dedicated pass so the voice is
  coherent instead of piecemeal.

### Icons

- Official brand icons replace the code-owned placeholder art for known
  availability sources (Steam, GOG, Epic Games Store, and the rest of the
  12e catalog); the neutral fallback icon for custom sources is unchanged.
- A general UI icon set swap is the theme's final step and waits for the
  owner's premium/custom icon choice; current icons remain the fallback
  until then.

## 14. Settings, Export, and Operations

Settings includes:

- Google session management.
- OS preferences set at onboarding: primary OS, handheld, and the derived
  fallback, editable afterward.
- Supported price-country and display-currency preferences set in Welcome and
  editable afterward; the current market and currency are visible with the
  presentation-only conversion notice.
- An optional Steam connection entry point that reuses the existing OpenID flow;
  connecting or skipping never changes onboarding completion.
- Steam wishlist-import status and review access.
- Vercel Cron status and diagnostics for the daily price refresh and
  compatibility sweep once deployment enables it.
- The theme and accessibility preference area introduced by feature 14,
  extended with the Dawn/Sunset family selector.
- Wallhaven enablement and refresh controls.
- Reduced-data behavior.
- A global duration profile (`history main`, `history + extras`, or
  `completionist`) selected in Welcome and editable in Settings. It controls
  the default duration shown across Library/Wishlist and the duration evidence
  used by recommendations.
- Manual provider refresh controls.
- Queue progress and retry controls.
- JSON export of irreplaceable data only.
- Manual import of that export into an empty schema only.

Manual export includes catalog and wishlist records, availability and
alternative sources, all external IDs regardless of provenance, current play
states, prior-completion history, interest, ratings, personal tags, settings
(including duration profile), manual overrides, and recommendation-related
personal decisions. Removed notes and per-game availability display labels are
not exported or restored. The new schema is introduced directly and older
export versions are rejected clearly rather than normalized, because the app
has not reached staging and the database will be rebuilt.
Rebuildable IGDB/SteamSpy, price, compatibility, provider-operation, and
recent-activity snapshots are excluded; Steam connections and credentials are
never exported.

Manual import restores the same personal data and only into an empty catalog
and wishlist: the action refuses with a clear explanation while any record
exists, validates the file against the export schema version with Zod, and
applies everything in one all-or-nothing transaction. Recommendation events,
derived profiles, preferences, presets, and dismissal counters restore with
their calibration behavior intact. Provider snapshots are never imported;
after a restore, IGDB, SteamSpy, price, and compatibility data rebuild only
through the existing manual enrichment actions, never auto-queued. The
documented provider transition then re-links/re-imports Steam so preserved IDs
update existing records rather than duplicate them. Automatic
encrypted off-site backups, rotation, and advanced restoration are future work.

## 15. Tech

Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
Prisma, PostgreSQL/Supabase, Auth.js, Google authentication, Zod, Vitest, and
Vercel.

The MVP uses a persistent PostgreSQL-backed queue for provider work. Price
refreshes are manually initiated until deployment; the deployment/readiness
feature configures Vercel Cron and `CRON_SECRET` to enqueue the daily work:
the price refresh plus a compatibility freshness sweep for catalog and
wishlist evidence older than the 180-day window.
The scheduler must tolerate duplicate invocations, avoid overlapping claims, and
leave retry history visible.

Deployment/CI is the final planned milestone, not a reason to block otherwise
complete product work if an additional MVP feature is discovered first. The
deployment feature configures Vercel Cron to run the daily work (price
refresh plus compatibility freshness sweep) at **06:00 UTC-6**.

## 16. Possible Improvements After the MVP

- Daily encrypted off-site backups.
- Backup rotation and automated restoration verification.
- 90-day summarized audit history.
- More advanced restore workflows.
- A managed queue or durable-workflow service, such as Inngest or QStash, if the
  persistent PostgreSQL queue is no longer sufficient.
- Additional providers or richer compatibility evidence.
- Notifications and webhooks.
- Multi-user support and roles.
- PWA/offline support.

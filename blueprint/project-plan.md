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
- Independent wishlist for base games and DLC linked to owned catalog games.
- Manual wishlist acquisition into the catalog with optional base-game play state update.
- ITAD/Steam price enrichment for wishlist entries.
- Optional MXN target prices, transparent valid-offer comparison, and purchase-opportunity signals.
- Manual Steam wishlist import with conservative local matching, review queues, and RAWG follow-up for new base-game wishes.
- Compatibility evidence for Bazzite and its Windows fallback, with wishlist
  evidence presented separately when a wish has a confirmed Steam App ID.
- Deterministic explainable play-next and buy recommendations with DLC affinity weighting.
- Recommendation runs with temporary dismissal and persistent calibration signals.
- Today dashboard with active-backlog progress, data-coverage prompts, daily-cached
  recent Steam activity (including unimported titles), latest explicit recommendations,
  wishlist offers, and provider-operation status.
- Global visual foundation, design tokens, and comprehensive full-app UI review.
- Optional Wallhaven background.
- Per-game detail themes based on RAWG metadata.
- Settings and manual JSON export.
- Deployment and CI readiness as the final planned milestone, without making it
  an inflexible MVP gate.

The following are explicitly outside the MVP:

- Automatic Steam synchronization.
- Automatic daily encrypted off-site backups.
- Backup rotation and automated restoration infrastructure.
- 90-day audit history.
- Public registration, roles, social features, and collaboration.
- Launcher, storefront, ROM catalog, PWA, offline mode, notifications, webhooks,
  or automatic price conversion.

## 4. Catalog and Wishlist Model

`Game` represents catalog entries only. Wishlist entries are independent and
do not create provisional `Game` records.

A wishlist entry represents either:
- An unowned base game (independent entry, optionally enriched with RAWG).
- An unowned DLC for an already-owned catalog base game (requires a relation to
  an existing catalog `Game`).

A wishlist entry may exist without a provider or external identifier. It may
store:

- Name.
- Base game or DLC type.
- Target base game ID (required if type is DLC).
- Notes, local interest, and an optional personal **Game experience / intention**.
- Optional external identifiers.
- Independent RAWG metadata snapshot (for base games).

`Game experience / intention` is one user-selected value per catalog or
wishlist game, initially one of: PC gaming, Multiplayer & co-op, Couch gaming,
or On the go. It describes the session the game best suits, not its provider
platform or compatibility. It is optional, editable, and deliberately
single-value for the MVP; unclassified games remain eligible with less
experience-fit evidence.

Price target and provider offers belong to the later pricing feature, not the
initial local wishlist feature. Source preference is intentionally excluded:
when multiple valid offers exist, the app selects the cheapest one while showing
the alternatives.

When a wishlist item is acquired manually:

1. **For a base game:**
   - The user chooses the acquisition source.
   - A real manual `Game` is created immediately.
   - Wishlist metadata is copied into the game's RAWG snapshot.
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

## 5. DLC and Unresolved Steam DLC

DLC catalog entries:

- Must point to one existing base game.
- Are created from a base-game detail flow, through a reviewed Steam-DLC flow,
  or by acquiring a wishlist DLC.
- Do not enter play-next recommendations directly.
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

RAWG initially enriches catalog entries on demand. Wishlist RAWG enrichment is
added with the local wishlist feature and reuses this provider boundary.

- Global catalog button opens a modal.
- Detail pages have an individual load button.
- Manual catalog forms suggest RAWG matches.
- Manual refresh warns before overwriting existing metadata.
- Existing metadata is treated in the UI as present or absent.
- RAWG snapshots are replaced, not historically retained.
- Steam's initial import queues enrichment for every imported game.
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
- ESRB rating when RAWG provides it; absent or incomplete ratings stay unknown
  and never imply a maturity classification.
- Official website.
- RAWG updated date and local fetched date.
- Ratings and Metacritic as secondary context.
- RAWG URL.

Screenshots, videos, achievements, system requirements, franchises, series,
and stores are deferred.

RAWG attribution appears near RAWG data or images and in a
`Powered by / Data and content providers` section. The key remains server-side
and provider constraints are respected.

## 8. Asynchronous Enrichment and Provider Operations

Manual entries and Steam imports are saved immediately and provider work runs
asynchronously. The sequence is: save the record, run RAWG when available, then
queue compatibility after a successful RAWG result. Metadata refresh repeats it.
Initial Steam import queues every imported game. The UI shows individual states
and batch progress for Steam, RAWG, and compatibility. Provider work is persisted
in PostgreSQL, rate-limited, and processed in batches. Transient failures retry
up to three times with increasing delay; final failures remain visible and can be
manually retried. Failure never removes personal or prior valid provider data.

## 9. Wishlist, Prices, and Steam Import

Wishlist entries are useful either as reminders or planned purchases.

### Local wishlist and acquisition

The first wishlist feature is provider-independent:

- Base-game wishes are independent; DLC wishes link to owned catalog games.
- Provider and external identifier are optional.
- Notes and local interest are stored locally.
- Wishlist forms and a global wishlist action suggest/load RAWG metadata for base games.
- A base game can be acquired manually into the catalog.
- Wishlist RAWG metadata transfers to the new catalog game when available.
- The acquired base wishlist entry is removed.
- Acquiring a wishlist DLC creates the catalog DLC under the base game and offers
  an optional prompt to update the base game's play state (e.g. `PLAN_TO_PLAY` or `replay: true`).

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
- The integration uses `country=MX`, caching, rate-limit handling, and
  `429`/`Retry-After` behavior.
- No ITAD OAuth, Waitlist synchronization, notifications, webhooks, automatic
  currency conversion, or automatic purchasing is included.
- For each entry, the cheapest 8-10 valid offers are persisted; the selected
  offer is the cheapest; alternatives render in an expandable view showing
  store, source, price, discount, and freshness.
- Historical low is display-only context next to the current price. It never
  creates or strengthens signals.
- `targetPriceMxn` edits inline on each wishlist row, plus the edit form.
- An active opportunity renders as a badge on the wishlist entry itself; no
  separate section exists in this feature.

### Price identity resolution

A wishlist entry becomes priceable only after its store identity is
confirmed. Identity has three paths, each recording provenance:

- **Steam wishlist import**: entries created by import carry their verified
  Steam App ID as confirmed identity.
- **Manual entry**: the wish form accepts a Steam store URL or raw App ID;
  the URL is parsed and stored as user-confirmed identity. This also serves
  as the override path.
- **RAWG suggestion**: wishlist RAWG enrichment additionally captures Steam
  store links. A derived App ID is stored only as a suggestion and requires
  one-click confirmation before the entry is priced. The wishlist RAWG
  snapshot contract therefore extends to store links; the catalog snapshot
  contract stays unchanged.

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
  App ID creates a wishlist entry automatically with interest `2`/`5` and
  empty notes, then queues the existing wishlist RAWG enrichment flow.
  Existing local snapshots are never overwritten by import.
- Local matching reuses the feature 7a normalized-name matcher. Any
  candidate - exact names included - goes to persistent review; linking is
  **never automatic**. Linking stores the Steam App ID with provenance onto
  the local entry, so later imports skip it silently.
- Ignored review entries stay suppressed across imports until manually
  restored.
- An item already present in the owned catalog is omitted silently.
- Unresolved Steam DLC from library sync and wishlist import share **one**
  persistent queue, discriminated by source (`owned-sync` /
  `wishlist-import`); each side keeps its own reappear rules. A Steam DLC
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
- Full RAWG metadata snapshot when present: description, genres, release
  date, playtimes, artwork, and the RAWG source link.
- Steam identity and provenance, including the add/edit/remove and
  RAWG-suggestion confirm affordances.
- Offer block: selected offer, alternatives, target price, opportunity
  badge, and freshness.
- Notes and local interest.
- Edit, acquire into the catalog, and delete actions.
- A read-only compatibility section (see Compatibility Synthesis) for base
  games with a confirmed Steam App ID.

Two per-entry actions exist on the detail page:

- **Compatibility refresh** for base-game wishes with a confirmed Steam App
  ID. Inline, quiet, fail-silent like the auto-trigger.
- **Fill-only RAWG enrichment**: enriches only when no snapshot exists yet,
  matching the wishlist auto-enrich behavior. Wishlist data is informational,
  so unlike the catalog there is no overwrite path - the button is hidden or
  disabled once a snapshot is present.

These two actions are the only per-entry surfaces; batch progress and error
details stay out of the wishlist.

## 10. Compatibility Synthesis

Compatibility evidence uses Bazzite as the primary environment and derives the
Windows fallback from it. It does not maintain a separate Steam Deck
compatibility layer.

All provider evidence keys off a Steam App ID. Catalog games without one get
a manual "add Steam App ID" affordance on the detail page, writing into the
existing `ExternalGameId` table with user provenance; evidence queues
automatically once present.

Games whose only availability source is ROM are fully exempt from the
pipeline: no identity entry, no queueing, no unknown warnings. Their
compatibility reads as **not applicable**, not unknown. Mixed availability
still receives Steam-based evidence.

Sources:

- ProtonDB is primary for Bazzite/Linux reports, with its tier and a single
  per-game ProtonDB link shown as evidence.
- Anti-cheat evidence comes from the AreWeAntiCheatYet crowdsourced dataset,
  cached like other providers and shown separately; absent data stays explicit
  unknown.
- Windows is derived from effective Bazzite evidence: a game ready without
  tinkering needs no fallback, tinkering or degraded Linux support recommends a
  fallback, and denied/broken anti-cheat, not-playable Bazzite evidence, or
  unknown Bazzite evidence requires it.

Mixed evidence shows all sources with attribution. Personal overrides apply to
Bazzite only, take priority, are never overwritten, and consequently affect
the derived Windows fallback.

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
manual URL/AppID paste, or RAWG suggest-and-confirm - as an inline call that
catches and hides provider errors. A quiet async manual sweep covers existing
confirmed-identity wishes: it confirms "sweep started", shows a completion
toast, and persists a PriceRefresh-style run record with overlap protection;
per-entry refresh on the detail page is inline and equally quiet. Absent
evidence shows a simple "compatibility details not found" note on the detail
page instead of batch progress or error surfaces.

Freshness uses a single **180-day window** across all evidence types. Stale
evidence keeps its values, shows its age, and produces a visible
recommendation warning - never a penalty. Refresh triggers are the post-RAWG
automatic queue and per-game manual refresh. A global sweep waits for
Settings' provider controls (feature 17); scheduled rescheduling waits for
deployment (feature 18). Provider endpoint stability (ProtonDB summary
endpoint and AWAY dataset shape) validates during the feature spec.

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
- Game experience / intention, intended environment, and compatibility.
- RAWG genres, tags, estimated playtime, release era, publisher, sequel
  relationship where confidently known, ESRB context when available, Metacritic,
  and community-rating confidence.
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
  either `NOT_STARTED` or replay-flagged `PLAYED_BEFORE`/`ABANDONED`.
  `IN_PROGRESS` games appear separately on the dashboard. DLC never enters
  play-next.
- `buy`: all wishlist base games and DLC wishes whose base game is owned.
  Entries without confirmed identity or offers stay eligible on interest
  alone, carrying an explicit "no pricing yet" warning. ROMs are excluded
  from purchase recommendations.

**Ranking semantics**

- Manual fields remain authoritative. **Interest** (`0-5`) is durable personal
  desire or expected enjoyment and is the core taste signal for play and buy.
  **Priority** (`NONE`/`LOW`/`MEDIUM`/`HIGH`) is a catalog-only, short-term
  urgency signal for play-next; it never means the user likes a game more.
  Detail, quick-create, and bulk-edit surfaces explain these and other personal
  fields with concise visible helper text.
- Compatibility is a small practical-fit signal for the intended environment,
  not a hard gate. Confirmed fit may boost a recommendation; unknown, stale,
  or poor evidence surfaces caveats and can reduce practical fit, but does not
  declare a game unplayable or silently exclude it.
- Buy offer quality: fresh-offer discount percentage earns points; proximity
  to the historical low breaks ties; stale offers contribute zero
  offer-quality points, consistent with the 48-hour rule.
- DLC base-game affinity is boost-only: an owned base rated >=4/5, completed,
  or replay-flagged grants one fixed boost tier named explicitly in the
  explanation ("base game X was completed"). Affinity never lowers a score.
- Publisher, release-era, quality, series, genre/tag, duration, and mature or
  casual context are soft evidence only. Sparse RAWG data, low rating counts,
  or uncertain series links lower confidence rather than fabricating preference.
- No alphabetical tiebreak decides what a person sees. Near-equal qualified
  candidates use stable, weighted rotation and short exposure cooldowns.

Recommendations are generated explicitly by the user. `Update recommendations`
works immediately with no form. `Tune this run` is opt-in and may set soft
preferences for game experience, desired length, genres/tags, sequel posture,
classic-to-newer era, and casual-to-mature context. A soft preference strongly
boosts matches and reserves representation when possible, but can relax with a
visible explanation if the qualified pool is thin. Named presets store these
optional contexts for reuse.

Each run retains its context, explanations, and qualified candidate batches.
The dashboard initially displays four play-next roles: two best-fit picks, one
qualified out-of-the-box pick that favors underrepresented genres, tags, or
experiences, and one change-of-pace pick different from recent play. It displays
three buy roles: two best-fit wishlist picks and one exceptional-deal pick. When
deal-saturation applies - at least three fresh offers discounted 80% or more
and at least 20% of eligible wishes qualify - Buy instead shows one best-fit and
two exceptional-deal picks. Deal picks must still clear fit and quality floors;
a discount never wins by itself.

Each role offers `Show another`, rotating a different item from its retained
batch without creating a new run. Showing or rotating an item records a light
exposure and applies a temporary cooldown; it is never a negative signal.
Daily price refreshes do not create or replace a run.

Dismissing an item hides it only during the current run. A persistent dismissal
counter is maintained separately for play-next and buy recommendations. After
three cumulative dismissals of the same recommendation type, the adjusted
interest decreases by one point, with a floor of zero.

The user-entered interest remains manually editable. When automatic calibration
has changed it, the detail view explains that the value was adjusted because of
repeated recommendation dismissals. The technical counter remains an internal
implementation detail. Starting a catalog recommendation is an explicit action:
it marks the game `IN_PROGRESS`; when no other game is in progress it also
makes it the main game, otherwise it asks before replacing the main game.

### Cold start, learning, and control

A recently imported library must remain useful before its personal fields are
filled. Cold-start recommendations diversify metadata-complete owned games by
genre, experience, length, era, platform fit, and broad quality signals, and
say explicitly that they are based on imported-library metadata. After import,
an optional taste setup presents five or six varied owned games. For each, the
user may mark `I've played this` (also setting `PLAYED_BEFORE`), `I like this`
(setting Interest to `5/5` unless a personal value already exists), skip it, or
swap it for another catalog game. Progressive one-tap prompts after viewing,
starting, dismissing, or completing games invite useful personalization without
requiring a bulk data chore.

Recommendation-owned data stays private in PostgreSQL and remains separate
from authoritative catalog fields and replaceable provider snapshots:

- `RecommendationRun` and its items retain context, visible results,
  explanation factors, and candidate batches for 12 months.
- Append-only recommendation events record meaningful exposure, rotation,
  taste-setup answers, starts, completions, abandonment, dismissals, and
  optional dismissal reasons.
- A rebuildable derived profile aggregates preferences for genres, tags,
  experience, length, publisher, era, series, environment, and maturity.
- User-editable preferences use semantic `Prefer`, `Neutral`, and `Avoid`
  overrides instead of exposing raw weights. Settings shows the learned profile,
  its evidence, and these controls.
- Presets hold named optional Tune-this-run contexts.

Events phase out by usefulness: exposure after 90 days; runs, starts,
dismissals, and optional reasons after 12 months; played, completed, abandoned,
and taste-setup events after 24 months. Derived preferences rebuild from the
retained events and use recency decay before deletion. `Restart recommendations`
immediately deletes all recommendation-owned runs, events, derived profiles,
preferences, and presets, while preserving the catalog, ownership, and personal
catalog data.

The `Update recommendations` action lives on the Today dashboard header and
empty state, and is reachable from the Library and Wishlist headers.

## 12. Today Dashboard

The dashboard is the post-login front door and primarily a local composition
view. It recalculates local summaries when it loads. It never silently runs a
full Steam sync, imports games, or refreshes RAWG, pricing, or compatibility.

It displays:

- Main game.
- Games in progress.
- Active-backlog progress as
  `PLAYED_BEFORE / (NOT_STARTED + IN_PROGRESS + PLAYED_BEFORE)`. `ABANDONED`
  games appear separately and are excluded from the denominator.
- Two independent, actionable coverage counts:
  - catalog base games without a RAWG metadata snapshot;
  - visible catalog games with an incomplete recommendation profile.
- A recommendation profile is incomplete when `interest` is absent, or when
  interest is present but none of priority other than `NONE`, preferred
  environment, or game experience/intention is present. Hidden games are
  excluded. Rating and the default play state do not satisfy this signal.
- Clickable coverage counts open accessible dialogs with up to ten affected
  game titles linking to their game details. The dialog can expand into a
  paginated list for additional games.
- Three latest play-next recommendations and three latest buy recommendations;
  these remain the latest explicitly generated runs.
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

- Deep charcoal and navy surfaces; dark mode default, light mode fully
  supported.
- **Dual-accent semantic tokens**: cyan/teal for interactive elements,
  progress, and ready states; magenta/pink for opportunity signals, deals,
  and buy recommendations; amber for warnings, stale evidence, and mixed
  compatibility.
- Rounded cards, pill buttons, and badge chips as the component baseline on
  shadcn/ui tokens.
- Bold display typography reserved for page headers and hero moments.
- Desktop icon sidebar and mobile bottom navigation.
- `/prototype` runs before feature 14 to lock the look against the references
  in throwaway mockups.

The application shell and existing components support:

- Light, dark, and system modes.
- Accessible contrast, semantic color tokens, and readable overlays.
- Standardized card layouts, badge hierarchies, and sheet/modal behaviors across
  all views (Library, Game Detail, Wishlist, Dashboard, Settings).
- Full-app visual polish and component cleanup.
- Reduced-data and reduced-motion behavior where applicable.
- Stable local fallback visuals.
- Settings-controlled behavior.

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

Each game detail page may use its RAWG imagery and derived colors. Theme
colors derive **server-side during RAWG enrichment**: a small dominant-color
palette (primary plus dark/muted variants) extracted from stored artwork,
persisted in the replaceable snapshot, and applied read-only by the page
under contrast overlays. Missing imagery or reduced-data mode uses the
deterministic fallback; re-enrichment re-derives the palette.

- Theme applies only to that detail page.
- The feature respects global theme and accessibility settings.

## 14. Settings, Export, and Operations

Settings includes:

- Google session management.
- Fixed environment display.
- Steam wishlist-import status and review access.
- Vercel Cron price-refresh status and diagnostics once deployment enables it.
- Theme and accessibility preferences.
- Wallhaven enablement and refresh controls.
- Reduced-data behavior.
- Manual provider refresh controls.
- Queue progress and retry controls.
- JSON export of irreplaceable data only.

Manual export includes catalog and wishlist records, availability, external IDs,
play states, notes, interest, ratings, tags, collections, settings, manual
overrides, and recommendation-related personal decisions. Rebuildable RAWG,
price, and compatibility snapshots are excluded. Automatic encrypted off-site
backups, rotation, and advanced restoration are future work.

## 15. Tech

Next.js App Router, React, TypeScript, pnpm, Tailwind CSS v4, shadcn/ui,
Prisma, PostgreSQL/Supabase, Auth.js, Google authentication, Zod, Vitest, and
Vercel.

The MVP uses a persistent PostgreSQL-backed queue for provider work. Price
refreshes are manually initiated until deployment; the deployment/readiness
feature configures Vercel Cron and `CRON_SECRET` to enqueue the same daily work.
The scheduler must tolerate duplicate invocations, avoid overlapping claims, and
leave retry history visible.

Deployment/CI is the final planned milestone, not a reason to block otherwise
complete product work if an additional MVP feature is discovered first. The
deployment feature configures Vercel Cron to run the daily price refresh at
**06:00 UTC-6**.

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

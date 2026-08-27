# Feature: Derived profile and preference overrides

**From build-plan:** feature 12c-c
**Status:** not started

## Goal

Give the recommender a visible taste layer built from the 12c-b event log: a
rebuildable `RecommendationProfile` aggregate (recency-decayed signals per
dimension) plus explicit `PREFER`/`NEUTRAL`/`AVOID` `RecommendationPreference`
overrides, shown in a Settings section with the profile's evidence and the
controls. With 8e shipped, all nine dimensions are derivable: `MATURITY` comes
from the ESRB rating in payload v2 and `SERIES` from the game-series sibling
list. This feature only builds and displays the taste layer; consuming it in
scoring is 12c-d's job, so run results do not change here.

## In scope

- `RecommendationProfile` singleton, `RecommendationPreference` model, shared
  `RecommendationDimension` and `RecommendationPreferenceAttitude` enums, migration.
- Profile lib: dimension extraction from RAWG metadata and personal fields,
  sentiment weights per event kind, exponential recency decay, payload types.
- `rebuildRecommendationProfile` lib function, rebuilt automatically inside
  `updateRecommendations` and on demand from Settings.
- Preference server actions: set (upsert) and remove.
- Settings "Recommendation profile" section: learned profile per dimension with
  evidence, rebuild button, preference add/remove controls, empty state.
- `restartRecommendations` extension: also deletes profile and preferences
  (completes the 12c-b load-bearing reset note).

## Out of scope

- Any change to eligibility, scoring, ranking, or run output (12c-d).
- Tune-this-run, presets, taste setup (12c-f), rotation and roles (12c-e),
  dismissal-counter calibration (12d).
- `TASTE_SETUP_ANSWER` emission (12c-f); its weights are contract-only here.
- Free-text preference values: controls offer values the profile already knows;
  no fuzzy matching is invented here.
- Metadata display on detail pages: 8e already shows ESRB and series in
  `MetadataSection`; Settings is the only new UI surface here.
- Automated metadata backfill: series and ESRB evidence exists where games were
  enriched after 8e; the user can backfill by running the existing catalog-wide
  enrichment action. Sparsity is expected and visible in evidence counts.

## Data / contracts (load-bearing)

### Shared dimension enum

Used as profile payload keys and as preference dimension. Values: `GENRE`,
`TAG`, `EXPERIENCE`, `DURATION`, `PUBLISHER`, `ERA`, `SERIES`, `ENVIRONMENT`,
`MATURITY`. Attitude enum: `PREFER`, `NEUTRAL`, `AVOID`.

### Dimension derivation per event target

An event contributes a dimension value only when the source data exists. Each
matching value gets one signal contribution per event (genres and tags add one
signal per genre/tag). Metadata reads use `parseRawgMetadataPayload` and guard
v1 rows: `esrbRating` and `seriesGames` keys are absent there
(`?? null` / `?? []`).

| Dimension    | Source for a game event                                | Source for a wish event                 | Values                                    |
| ------------ | ------------------------------------------------------ | --------------------------------------- | ----------------------------------------- |
| `GENRE`      | RAWG `MetadataSnapshot.payload.genres`                 | `WishlistMetadataSnapshot.payload.genres` | RAWG names verbatim                     |
| `TAG`        | payload `tags`                                         | payload `tags`                          | RAWG names verbatim                       |
| `PUBLISHER`  | payload `publishers[0]` only                           | payload `publishers[0]` only            | RAWG names verbatim                       |
| `DURATION`   | `playtimeHours` band                                   | `playtimeHours` band                    | `SHORT` <=5, `MEDIUM` 6-15, `LONG` 16-40, `VERY_LONG` >=41; null playtime = no signal |
| `ERA`        | release year band                                      | release year band                       | `PRE_2005` (<2005), `Y2005_2014`, `Y2015_2019`, `Y2020_PLUS`; null releaseDate = no signal |
| `EXPERIENCE` | `LibraryEntry.gameExperience`                          | `WishlistEntry.gameExperience`          | enum value                                |
| `ENVIRONMENT`| `LibraryEntry.preferredEnvironment`                    | none                                    | `BAZZITE`/`STEAM_DECK`/`WINDOWS`          |
| `MATURITY`   | payload `esrbRating.name` verbatim                     | payload `esrbRating.name` verbatim      | closed RAWG set (Everyone, Teen, Mature, ...); null = no signal |
| `SERIES`     | every `seriesGames` sibling name of the target         | every `seriesGames` sibling name of the target | RAWG game names verbatim           |

### SERIES sibling rule

An event on a target contributes one `SERIES` signal per entry of the target's
`seriesGames` list, keyed by the sibling's `name`, carrying the same weighted
contribution the event gives every other dimension value. The profile-level
meaning is franchise affinity: starting, finishing, or dismissing a game
weights the games it shares a series with. 12c-d computes a candidate's series
affinity by aggregating profile weights over the candidate's own `seriesGames`
names; `deriveSequelRelationship` from 8e stays available there for
direction-sensitive ranking and is not used by the rebuild. If RAWG includes a
target in its own series list, the target's own name gains weight; that is
harmless (a played game is rarely a candidate) and visible in support counts.

### Sentiment weights and decay

| Event kind           | Weight         | Note                                              |
| -------------------- | -------------- | ------------------------------------------------- |
| `COMPLETION`         | +2             | played it through: strongest positive             |
| `START`              | +1             | chose to play                                     |
| `DISMISSAL`          | -1.5           |                                                   |
| `ABANDONMENT`        | -1             |                                                   |
| `TASTE_SETUP_ANSWER` | `LIKED` +2, `PLAYED` +1, `SKIPPED` 0 | contract only; emitted in 12c-f |
| `EXPOSURE` / `ROTATION` | ignored     | display telemetry, never taste                    |

- Recency decay: exponential half-life of 180 days, `factor = 0.5 ** (ageDays / 180)`.
  Constant `PROFILE_DECAY_HALF_LIFE_DAYS = 180`.
- Each dimension value accumulates `weight` (decayed sum) and `support`
  (count of contributing events). Raw sums are stored; normalization happens
  at consumption time (12c-d).

### Payload shape (version 1)

```ts
interface ProfileDimensionSignal {
  weight: number;
  support: number;
  lastAt: string; // ISO timestamp of the newest contributing event
}

interface RecommendationProfilePayload {
  version: 1;
  windowStart: string | null; // oldest retained event considered
  windowEnd: string;          // rebuild time
  dimensions: Record<RecommendationDimension, Record<string, ProfileDimensionSignal>>;
  evidence: {
    eventsConsidered: number;                       // non-EXPOSURE/ROTATION events
    byKind: Partial<Record<RecommendationEventKind, number>>;
    unresolvedTargets: number;                      // target row missing, skipped
  };
}
```

All nine dimension keys are always present (possibly empty objects) so
consumers never special-case missing dimensions.

### Models

```prisma
enum RecommendationDimension {
  GENRE
  TAG
  EXPERIENCE
  DURATION
  PUBLISHER
  ERA
  SERIES
  ENVIRONMENT
  MATURITY
}

enum RecommendationPreferenceAttitude {
  PREFER
  NEUTRAL
  AVOID
}

model RecommendationProfile {
  id        Int      @id @default(1)
  version   Int      @default(1)
  payload   Json
  rebuiltAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model RecommendationPreference {
  id        String                            @id @default(cuid())
  dimension RecommendationDimension
  value     String
  attitude  RecommendationPreferenceAttitude
  createdAt DateTime                          @default(now())
  updatedAt DateTime                          @updatedAt

  @@unique([dimension, value])
}
```

Singleton row `id = 1`, upserted on rebuild (same pattern as `WallpaperState`).
No relations, so no cascade concerns.

### Preference semantics (contract for 12c-d)

- `PREFER` boosts candidates matching that dimension value, `AVOID` penalizes,
  `NEUTRAL` vetoes: the derived signal for that value is ignored entirely.
- Overrides are authoritative user choices: rebuilds never create, modify, or
  delete `RecommendationPreference` rows. No FK to profile values, so an
  override survives profile rebuilds and still applies later if candidate
  metadata matches its value.
- `Restart recommendations` deletes profile and preferences along with runs,
  feedback, and events.

### Rebuild contract

- Reads all retained `RecommendationEvent` rows (12c-b pruning already bounds
  this to 24 months), resolves each target's dimensions, applies weights and
  decay from `now`, and upserts the singleton.
- Malformed/missing metadata payload: the event still counts in evidence; it
  contributes only the dimensions it can resolve (personal fields can exist
  without RAWG metadata and vice versa).
- A game event whose `LibraryEntry` is missing resolves metadata dimensions
  only. Cascades make fully unresolvable targets rare; they count as
  `unresolvedTargets` and never crash the rebuild.
- Runs inside the existing `updateRecommendations` transaction (after event
  pruning, before runs are created), and standalone via a Settings action.
  No overlap protection: single user, one writer, cheap rebuild.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them.

- [x] **Step 1 - Schema and migration** - add the two enums and both models to
  `prisma/schema.prisma`; run `pnpm prisma:migrate`; regenerate the client.
  *Done when:* `pnpm prisma migrate status` reports up to date and
  `pnpm typecheck` is green.
- [x] **Step 2 - Profile math lib** - `src/lib/recommendations/profile.ts` with
  the payload types, `EVENT_SIGNAL_WEIGHTS`, `tasteSetupWeight(answer)`,
  `decayFactor(ageDays)`, `durationBand(hours)`, `eraBucket(releaseDate)`,
  and `profileDimensionKeys()` (ordered key list).
  *Done when:* unit tests cover band/bucket boundaries (5/6, 15/16, 40/41
  hours; 2004/2005, 2014/2015, 2019/2020 years), decay at 0 and 180 days and
  monotonic decrease, weights per kind/answer, and `pnpm test` is green.
- [x] **Step 3 - Rebuild function** - `rebuildRecommendationProfile(client, now)`
  in the same file: load events, resolve targets (games with `libraryEntry` +
  RAWG `MetadataSnapshot`; wishes with `WishlistMetadataSnapshot`), aggregate
  with decay including the `MATURITY` and `SERIES` sibling rules, upsert the
  singleton, return the payload.
  *Done when:* tests cover multi-event aggregation across dimensions (incl.
  maturity from v2 payloads and series siblings), decay by event age (fake
  timers), malformed payload and missing `LibraryEntry` falling back to
  resolvable dimensions only, v1 payload rows contributing no maturity/series
  signals, an unresolvable target counted as `unresolvedTargets`, zero events
  producing an empty but well-formed payload with `windowStart: null`, and the
  upsert keeping a single row.
- [x] **Step 4 - Wire into updateRecommendations** - call the rebuild inside
  the existing transaction after `pruneRecommendationEvents`; add
  `profile: { rebuiltAt, eventsConsidered }` to the run context and the
  returned result. Scoring output is unchanged.
  *Done when:* tests show the singleton refreshed by a run and the context
  carrying the summary; `pnpm test` green.
- [x] **Step 5 - Preference and rebuild actions** - in
  `src/actions/recommendations.ts`: `setRecommendationPreference`
  (Zod: dimension enum, non-empty value, attitude; upsert on
  `[dimension, value]`), `removeRecommendationPreference`
  (delete, idempotent when absent), and `rebuildRecommendationProfileAction`
  (rebuild, return payload + `rebuiltAt`). All follow the
  `{ success, data, error }` pattern with `requireUser()`.
  *Done when:* action contract tests cover upsert-overwrite, idempotent
  remove, validation rejection, and rebuild success; `pnpm test` green.
- [x] **Step 6 - Reset extension** - extend `restartRecommendations` to also
  delete `RecommendationProfile` and `RecommendationPreference`, returning
  their counts; update the `RestartRecommendationsSection` toast/description
  copy to mention the learned profile and preferences.
  *Done when:* tests show all five tables emptied and catalog/provider rows
  untouched; the Settings toast text reflects the new counts.
- [x] **Step 7 - Settings profile display** - server component section on
  `/settings` (above the restart section): rebuilt-at line, evidence summary
  (events considered, per-kind counts, unresolved targets), and per-dimension
  signal rows (dimension label, value, weight with direction, support count),
  top 8 values per dimension by absolute weight. Empty state when no events:
  "Not enough history yet. Play, finish, or dismiss games and the profile
  will build from that." A missing singleton row (fresh install, no rebuild
  yet) renders the same empty state. Includes a small client "Rebuild
  profile" button.
  *Done when:* a manual `/settings` walkthrough shows the learned profile
  matching the singleton payload, the empty state renders after a restart and
  when no row exists, and the build is green.
- [x] **Step 8 - Preference controls** - client control block in the same
  section: existing overrides listed with attitude badge and remove button;
  an add form with dimension select, value select (populated from the
  current profile's values for that dimension, disabled when empty), and
  attitude select; success/error toasts; list refreshes via `router.refresh()`.
  *Done when:* a manual walkthrough adds, changes (re-add same dimension+value
  with a different attitude), and removes an override with the rows verified
  in `pnpm prisma studio`; build green.

## Files / areas

- `prisma/schema.prisma` + new migration
- `src/lib/recommendations/profile.ts` (new) + `profile.test.ts` (new)
- `src/actions/recommendations.ts` (+ test): rebuild wiring, preference and
  rebuild actions, reset extension
- `src/app/(app)/settings/page.tsx`: mount the new section
- `src/components/recommendations/RecommendationProfileSection.tsx` (new,
  server) with small client children for rebuild and preference controls
- `src/components/recommendations/RestartRecommendationsSection.tsx`: copy

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `profile.ts`: dimension band/bucket boundaries, decay math, sentiment and
  taste-setup weights, aggregation, malformed-payload and missing-entry
  fallbacks, v1 payload tolerance, unresolved targets, empty-history payload,
  singleton upsert.
- `recommendations.ts`: rebuild inside the run transaction and context shape,
  preference upsert/remove/validation, reset deleting all five recommendation
  tables while preserving catalog rows.
- UI steps (7 and 8) ride on the running app plus the build: profile display
  against a seeded singleton, empty state after restart, preference add /
  change / remove flow.

## Notes for the AI

- Single-user app: no per-user scoping; `requireUser()` at every action entry;
  Zod-validate all new inputs; follow `{ success, data, error }`.
- The profile is recommendation-owned and private. Never read or write catalog
  personal fields from it; the rebuild only reads events, snapshots, and the
  personal fields named in the derivation table.
- v1 metadata rows (pre-8e) lack the `esrbRating` and `seriesGames` keys;
  read them with `?? null` / `?? []` even though the v2 type makes them look
  non-optional.
- Payload `version` is load-bearing: 12c-d reads it. Bump it only with a
  migration-level reason and keep v1 readers safe.
- Keep `EVENT_RETENTION_DAYS` and all 12c-b event code untouched; the rebuild
  is a pure consumer of the log.
- No new routes, no cron, no queue: the rebuild is inline and cheap. Do not add
  caching or staleness logic; `rebuiltAt` is information, not a gate.
- Values in the preference UI come only from the current profile, so the value
  strings stay canonical (RAWG names, enum values, band keys). Do not add
  free-text input.
- Branch: `feature/recommendation-profile-preference-overrides`.

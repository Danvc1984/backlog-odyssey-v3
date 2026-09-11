# Feature: Playtime evidence and duration wiring

**From build-plan:** 23c, third sub-feature of 23 (IGDB as primary metadata,
artwork, and playtime provider)
**Status:** verified
**Branch:** `feature/igdb-playtime-evidence`

## Goal

Give every catalog game dedicated, attributed duration evidence — IGDB
`game_time_to_beats` as primary, automatic SteamSpy median as fallback — and
wire the owner's selected duration profile through the app: the expandable
duration disclosure on game detail, the estimate on Library and collections
cards, the DURATION recommendation dimension, Tune length matching, and
`durationBand`. RAWG playtime is used nowhere.

## Design reference

None. This feature composes existing, approved surfaces (the game-detail
metadata section's disclosure pattern, the Library card stats row, Settings
sections, the Welcome form) in the established Dawn/Sunset design system; it
introduces no new visual target.

## In scope

- Schema: a replaceable `PlaytimeEvidence` row per catalog game (new
  `PlaytimeProvider` enum `IGDB | STEAMSPY`, typed JSON payload, `sourceUrl`,
  `fetchedAt`) and `AppSettings.durationProfile`
  (`HASTILY | NORMALLY | COMPLETELY`, default `NORMALLY`), with a migration.
- IGDB client extension: `game_time_to_beats` as a new `requestIgdb` endpoint
  (`fields game_id,count,hastily,normally,completely; where game_id = <igdbId>;
  limit 1;`), one extra request per enrichment job inside the existing 4 req/s
  limiter.
- New SteamSpy client: `request=appdetails` returning the parsed
  `median_forever` (minutes); no auth; 10-second timeout; single best-effort
  attempt.
- Enrichment job integration: after a successful IGDB snapshot persist, fetch
  time-to-beats by the matched IGDB game id; when IGDB has no usable row and a
  confirmed Steam App ID exists, fall back to the SteamSpy median. Evidence is
  replaceable (delete + create, one row per game). Failures are non-blocking:
  the job still succeeds and existing evidence is preserved.
- Catalog-wide IGDB batch eligibility widened to games lacking an IGDB
  snapshot **or** lacking `PlaytimeEvidence`, so one batch run backfills
  duration for games enriched before this feature. Start-result counts keep
  the four-key shape with the third key renamed to
  `skippedFullyEnriched` (panel copy updated to match).
- Queueing decision (resolves the project-plan open question): duration
  evidence is fetched inline inside the existing IGDB enrichment job — no
  separate queue, sweep, or cron. It refreshes on every IGDB re-enrichment
  (individual overwrite refresh, catalog-wide batch, post-import queue) and
  displays its `fetchedAt` age like other provider evidence; no expiry-driven
  requeue.
- Duration-profile preference: `updateDurationProfile` action (validate +
  persist, no compatibility re-derivation, no run regeneration — engine
  effects apply at the next run), a Settings card in the Recommendations
  section, a Welcome form field carried through `updateOsSetup` (optional
  `durationProfile` on the setup schema), and export/import schema support
  (`appSettingsSchema` + legacy-document normalization defaulting to
  `NORMALLY`).
- Duration resolution helper: IGDB seconds mapped by profile (`hastily` =
  main-story, `normally` = main + extras, `completely` = completionist) to
  hours; SteamSpy median minutes to hours (profile-independent); band via the
  existing `durationBand`.
- Display: game detail duration disclosure (a compact selected-profile estimate
  visible first, all available values + sample count + source + fetched-at behind it,
  "Duration unknown" when a snapshot exists without evidence), Library and
  collections card estimates, and removal of the RAWG "Playtime" line from
  `RawgMetadataSection` (wishlist detail) so RAWG playtime is used nowhere.
- Engine wiring: DURATION band values on candidates, Tune `length` criterion,
  DURATION participation in derived taste and preference overrides (the two
  existing skips removed), DURATION factor labels, and profile-rebuild DURATION
  signals from playtime evidence.

## Out of scope

- Wishlist duration surfaces (card chip, detail block) and buy-side DURATION
  values: wishlist IGDB snapshots arrive in 23d and RAWG playtime is banned,
  so nothing can render there yet; 23d reuses the shared helpers from this
  feature. Buy-engine tune `length` matching therefore stays inert for
  wishlist entries in this feature.
- Wishlist IGDB enrichment, identity suggestions, store-link retirement, and
  acquisition metadata transfer (23d).
- Recommendation engine re-keying of the other dimensions, RAWG client/code
  removal, stale-snapshot retry presentation, and the documented clean restart
  (23e). The dead RAWG `libraryCardMetadataView` keeps its `playtimeHours`
  until 23e deletes it (it has no active UI path).
- `MetadataSnapshot` payload changes: the locked IGDB payload v1 contract is
  not widened; duration lives in `PlaytimeEvidence`.
- EnrichmentJob state machine changes: no new stages; duration rides
  `PERSISTING`.
- Steam playtime/recency as a duration source (it remains its own availability
  display context).
- Synchronous re-derivation when the duration profile changes.

## Build loop

Build one small step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, and `pnpm lint` must pass before a step is
   accepted; `pnpm build` at the display and engine-wiring steps.

## Build steps

- [x] **Step 1 - Schema and provider clients** - Add the `PlaytimeProvider`
  enum (`IGDB`, `STEAMSPY`), the `PlaytimeEvidence` model (`gameId` unique,
  `provider`, `payload Json`, `sourceUrl String?`, `fetchedAt`), the
  `DurationProfile` enum (`HASTILY`, `NORMALLY`, `COMPLETELY`), and
  `AppSettings.durationProfile` (default `NORMALLY`) with one migration; add
  the `playtimeEvidence` relation on `Game`. Extend `requestIgdb`'s endpoint
  union with `game_time_to_beats` and add `fetchIgdbGameTimeToBeats(igdbId)`
  returning a typed `{ count, hastilySeconds, normallySeconds,
  completelySeconds } | null` (null when the endpoint returns no row; values
  ≤ 0 parsed as null). Add `src/lib/steamspy-api.ts` fetching
  `request=appdetails` and returning `{ medianForeverMinutes } | null` (≤ 0 →
  null), with the shared timeout handling. *Done when:* the migration applies;
  Vitest proves the IGDB t2b parse (typed fields, tolerant nulls, no-row null)
  and the SteamSpy parse (minutes, tolerant, error mapping) with mocked fetch;
  `pnpm typecheck`, `pnpm lint`, `pnpm test` are green with no runtime change.

- [x] **Step 2 - Duration resolution library** - Create
  `src/lib/playtime-evidence.ts`: tolerant payload parsers for both provider
  shapes and `resolveDurationEstimate(row, profile)` returning
  `{ hours, band, source: "IGDB_TIME_TO_BEATS" | "STEAMSPY_MEDIAN", sampleCount | null } | null`.
  IGDB rows select the profile's seconds (`HASTILY`→`hastily`, `NORMALLY`→
  `normally`, `COMPLETELY`→`completely`) and fall back in the order selected,
  `normally`, `hastily`, `completely` when the selected value is absent;
  SteamSpy rows ignore the profile. Hours convert from seconds / minutes;
  `band` comes from the existing `durationBand`. *Done when:* Vitest covers
  profile selection, the IGDB fallback order, SteamSpy profile-independence,
  null for missing rows and all-null values, and the band mapping.

- [x] **Step 3 - Enrichment job integration and batch backfill** - In
  `runIgdbEnrichmentJob`, resolve the confirmed Steam App ID as the
  `STEAM_APP` `ExternalGameId` (falling back to the STEAM availability row the
  IGDB match already uses), then after `persistIgdbSnapshot` succeeds: fetch
  t2b for the matched IGDB id and on a usable row replace `PlaytimeEvidence`
  with an IGDB row (sourceUrl `https://www.igdb.com/games/{slug}`); otherwise,
  only when a confirmed App ID exists, fetch SteamSpy and on a usable median
  replace with a STEAMSPY row (sourceUrl `https://steamspy.com/app/{appId}`);
  replace = delete existing row + create, mirroring the snapshot pattern. All
  duration failures are caught and non-blocking (no job failure, no stage
  change). Extend the IGDB catalog batch eligibility to games without a
  snapshot or without `PlaytimeEvidence`, renaming the counts key to
  `skippedFullyEnriched` and updating any copy that says "existing metadata".
  *Done when:* Vitest proves t2b persistence, the fallback-only-when-no-IGDB-row
  rule (including an IGDB row superseding an existing SteamSpy row), no
  SteamSpy call without a confirmed App ID, non-blocking failures, and the new
  batch eligibility (with-metadata-without-evidence games are queued);
  existing job/queue tests still pass.

- [x] **Step 4 - Duration-profile preference** - Add `updateDurationProfile`
  to `src/actions/settings.ts` (Zod-validated enum, upsert, `{ success, data,
  error }`, no compatibility re-derivation and no run regeneration). Extend
  `osSetupSchema` with an optional `durationProfile` so the Welcome form can
  send it through `updateOsSetup` (absent values must not overwrite an
  existing setting). Add a `DurationProfileCard` to the Settings
  Recommendations section (three options labeled Main story / Main + extras /
  Completionist with factual help naming the IGDB sources). Add the same
  three-option field to `WelcomeSetupForm`. Extend `appSettingsSchema` in
  `export-schema.ts` with `durationProfile`, default it to `NORMALLY` in the
  legacy-document normalization, and make `import-restore.ts` persist it.
  *Done when:* Vitest proves the action's validation and persistence (and that
  it triggers no compatibility or pipeline work), the export roundtrip with
  `durationProfile`, legacy imports defaulting to `NORMALLY`, and
  `osSetupSchema` accepting both shapes; the Welcome and Settings controls are
  verified in the browser.

- [x] **Step 5 - Game detail duration disclosure and RAWG playtime removal** -
  Load `playtimeEvidence` on the game detail page and read
  `durationProfile` from settings; compute a duration view and render it in
  `MetadataSection` as a compact disclosure: the selected-profile estimate
  visible first (e.g. "~12h 30m (24 reports)"), all available estimates plus
  sample count and source link
  behind the expandable control, and a factual "Duration unknown" line when a
  snapshot exists without evidence. Remove the "Playtime" field from
  `RawgMetadataSection` (wishlist detail keeps its other RAWG fields until
  23d). *Done when:* the browser shows the disclosure for an IGDB row, a
  SteamSpy row, and the unknown case; no RAWG playtime renders anywhere;
  `pnpm build` passes.

- [x] **Step 6 - Library and collections card estimates** - Add
  `playtimeEvidence` to the game selects on `/library` and
  `/collections/[id]`, read `durationProfile` on those pages, and pass the
  resolved hours into `igdbLibraryCardMetadataView` so `playtimeHours` carries
  the selected estimate (the existing `formatPlaytime` renders it; cards
  without evidence simply omit the stat). *Done when:* Library and collections
  cards show the profile-selected estimate where evidence exists and nothing
  where it does not; `pnpm build` passes and the browser check shows both
  cards.

- [x] **Step 7 - Recommendation wiring** - Add `playtimeEvidence` to
  `loadCandidates` and to the profile rebuild's game include (wishlist targets
  keep no duration until 23d); extend `resolveCandidateDimensionValues` with an
  optional `durationHours` that sets
  `values.DURATION = [durationBand(hours)]`; thread the profile-resolved hours
  through `runRecommendationPipeline` (settings select gains
  `durationProfile`) for play candidates and pass null for wishlist entries,
  including the buy-side `resolveCandidateDimensionValues` call and the
  play-tune inputs (`tuneInput` gains and forwards `durationHours`).
  Add the `length` criterion to `matchTuneCriteria` via
  `durationBand(candidate.durationHours) === tune.length` (extend
  `TuneCandidateInput`), remove both `DURATION` skips in `rerank.ts`, and add
  DURATION value labels to `play-factor-labels.ts` (e.g. "short games",
  "very long games"). Duration stays soft evidence: taste clamps and caps
  apply unchanged, and no eligibility rule uses it. *Done when:* Vitest proves
  DURATION dimension values on candidates, profile-rebuild DURATION signals
  from playtime evidence, tune length matching and thin-pool counting, and
  DURATION derived/override contributions; `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, and `pnpm build` pass, and a manual run regeneration shows a
  duration factor when applicable.

- [x] **Step 8 - Independent-review repairs** - Keep the IGDB request timeout
  active until the fetch settles and preserve duration estimates on valid IGDB
  cards whose summary is null. Keep the approved compact duration copy on game
  detail. *Done when:* focused timeout/card tests pass and a fresh independent
  review accepts the complete checkpoint.

## Files / areas

- `prisma/schema.prisma` - `PlaytimeProvider`, `PlaytimeEvidence`,
  `DurationProfile`, `AppSettings.durationProfile`, `Game.playtimeEvidence`.
- `src/lib/igdb-api.ts` - `game_time_to_beats` endpoint + t2b fetch.
- `src/lib/steamspy-api.ts` (new) - SteamSpy appdetails client.
- `src/lib/playtime-evidence.ts` (new) - payload types, tolerant parsers,
  `resolveDurationEstimate`.
- `src/lib/igdb-enrichment.ts` / `src/lib/igdb-job-runner.ts` - evidence
  persistence and job integration.
- `src/actions/igdb-batch-enrichment.ts` - backfill eligibility + counts.
- `src/actions/settings.ts`, `src/lib/os-setup.ts` - preference action and
  schema passthrough.
- `src/components/settings/DurationProfileCard.tsx` (new),
  `src/app/(app)/settings/page.tsx` - Settings control.
- `src/components/onboarding/WelcomeSetupForm.tsx` - Welcome capture.
- `src/lib/export-schema.ts`, `src/lib/import-restore.ts` - export/import.
- `src/components/games/MetadataSection.tsx`, `src/app/(app)/games/[id]/page.tsx`,
  `src/components/games/RawgMetadataSection.tsx` - detail disclosure and RAWG
  playtime removal.
- `src/lib/card-metadata-view.ts`, `src/app/(app)/library/page.tsx`,
  `src/app/(app)/collections/[id]/page.tsx` - card estimates.
- `src/lib/recommendations/pipeline-helpers.ts`, `run-pipeline.ts`,
  `profile.ts`, `tune.ts`, `rerank.ts`, `play-factor-labels.ts` - engine
  wiring.

## Data / contracts

- `PlaytimeEvidence` (one replaceable row per catalog game, unique `gameId`):
  - IGDB row payload: `{ count: number | null, hastilySeconds: number | null,
    normallySeconds: number | null, completelySeconds: number | null }`;
    `provider: "IGDB"`, `sourceUrl` the IGDB game page, `fetchedAt` the fetch
    time. All values are seconds; values ≤ 0 are stored as null.
  - STEAMSPY row payload: `{ appId: string, medianForeverMinutes: number }`;
    `provider: "STEAMSPY"`, `sourceUrl` the SteamSpy app page, `fetchedAt`.
    Created only when the median is > 0.
  - Lifecycle: created inside the IGDB enrichment job, replaced (delete +
    create) on every re-enrichment; the IGDB row supersedes an existing
    SteamSpy row once t2b data appears; failures leave prior data untouched.
- `AppSettings.durationProfile`: `HASTILY | NORMALLY | COMPLETELY`, default
  `NORMALLY`; changing it never re-derives compatibility or runs.
- `resolveDurationEstimate(row, profile)`: IGDB rows pick the profile's value
  with fallback order selected → `normally` → `hastily` → `completely`;
  SteamSpy rows are profile-independent; missing row or all-null values yield
  null. Result carries `hours`, `band` (`durationBand`), `source`, and the
  IGDB sample count when present.
- DURATION dimension: values are the band keys `SHORT`, `MEDIUM`, `LONG`,
  `VERY_LONG` — the same strings as `TuneContext.length` and the existing
  preference controls. Participation is soft evidence only (existing taste
  clamp `RERANK_TASTE_CLAMP`, total cap, and support scaling; PREFER/AVOID
  override points unchanged); no eligibility rule or hard exclusion uses it.
  Catalog candidates derive it from `PlaytimeEvidence`; wishlist entries have
  none until 23d, so their DURATION values (and buy-side Tune `length`
  matching) stay absent this feature.
- EnrichmentJob: unchanged stages and status machine; duration work happens
  inside `PERSISTING` and never fails the job.
- Steam App ID for the fallback: `ExternalGameId` namespace `STEAM_APP` first,
  else the STEAM availability row — the "confirmed" identity notion.
- Load-bearing for later features: `PlaytimeEvidence` + `resolveDurationEstimate`
  + `durationProfile` are the contracts 23d reuses for wishlist duration
  display; the DURATION dimension values and Tune `length` criterion are what
  23e's engine re-derivation consumes; the four-key batch counts shape is
  preserved (third key renamed to `skippedFullyEnriched`).

## Testing

- Vitest (gate is on) per step: t2b and SteamSpy client parsing; duration
  resolution rules; job persistence rules (replace, fallback, non-blocking);
  batch eligibility; preference action and schema; export roundtrip and legacy
  default; DURATION dimension values, profile-rebuild signals, tune length
  matching, and rerank contributions. Fetch and Prisma are mocked; no live
  provider calls.
- Browser walkthroughs (no Playwright): Welcome shows and saves the duration
  field; Settings card switches the profile; game detail shows the disclosure
  for IGDB and SteamSpy rows and "unknown" without; Library and collections
  cards show the selected estimate; changing the profile flips displayed
  estimates without re-deriving anything; a regenerated run can show a
  duration factor.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` every step; `pnpm build` at the
  display and engine steps.

## Notes for the AI

- Server-only modules (`import "server-only"`) for provider clients and the
  evidence library; `"use server"` actions return `{ success, data, error }`
  and call `requireUser()` first.
- Match existing conventions: tolerant parsing of provider JSON (missing or
  malformed fields become nulls, never throws), delete + create replacement
  for replaceable evidence inside a transaction, mocked `fetch`/`prisma` in
  Vitest, no code comments.
- Single-user app: no per-user filtering exists; keep queries shaped like the
  surrounding code.
- Do not widen the `IgdbMetadataPayload` v1 contract or the `EnrichmentJob`
  stage enum; do not read RAWG playtime anywhere.
- Evidence copy stays factual (provider, sample count, fetched-at); the
  Odyssey voice is not used on statuses, evidence labels, or field help.
- The rate limiter is shared: the t2b fetch adds one request per job and must
  go through `requestIgdb`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":18967,"specSha256":"448deb1f3c2f27d5d5fe49d3640dd913194dd1cc5ad9da04a0eade0665b5b5ba","branch":"refs/heads/feature/igdb-playtime-evidence","head":"b944e52160d8965a61eaa647bfcd4fbc5128fa64","baseRef":"refs/heads/main","baseCommit":"ec91562fee0802938281e037e18a782ec1e802c0","sourceTree":"4e722beea0b818e3072ac66d5e6eae7aad4825be","absentOptional":[]} -->

## Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

_No findings recorded. `/audit` appends findings here when it finds them._

### 23c/F-01 [P1] closed - IGDB duration requests do not retain the timeout

**File:** src/lib/igdb-api.ts:76
**Found:** 2026-09-11 by /audit (scope: current; lens: performance, quality)
**Why it matters:** `fetchIgdb` returns the fetch promise from the rate-limiter callback and clears the abort timer in `finally` before that promise settles. The new `game_time_to_beats` path therefore can wait indefinitely on a stalled IGDB request, blocking the enrichment job or a catalog batch instead of honoring the specified 10-second timeout.
**Suggested fix:** Await the fetch inside the timed region, or route the request through a shared helper that keeps the abort timer active until the full request promise settles.
**Resolution:** Closed 2026-09-11 by /audit (scope: current; lens: all): re-examined the repair in `src/lib/igdb-api.ts`; awaiting `fetchFn` inside the timed region keeps the abort timer active until the fetch settles. The fake-timer regression test passes in the full suite (`pnpm test`: 139 files, 1348 tests).

### 23c/F-02 [P1] closed - IGDB cards drop duration when summary is absent

**File:** src/lib/card-metadata-view.ts:37
**Found:** 2026-09-11 by /audit (scope: current; lens: quality, tests)
**Why it matters:** `parseIgdbGameToPayload` intentionally permits a missing IGDB summary, but `parseIgdbCardPayload` rejects any snapshot whose summary is not a string. For a valid IGDB snapshot with playtime evidence and no summary, the shared Library/Collections card view becomes `null`, so the selected duration estimate is omitted and the card falls back to the no-metadata presentation.
**Suggested fix:** Accept nullable summary values while validating the structural fields required by the card, and add a regression test covering a valid payload with `summary: null` plus a duration estimate.
**Resolution:** Closed 2026-09-11 by /audit (scope: current; lens: all): re-examined the nullable-summary guard and its regression test; a valid IGDB payload with `summary: null` preserves the duration estimate. The test passes in the full suite (`pnpm test`: 139 files, 1348 tests).

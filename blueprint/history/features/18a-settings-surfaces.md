# Feature: Settings surfaces

**From build-plan:** 18a
**Status:** complete

## Goal

Consolidate the missing operational surfaces on `/settings`: a Google session
area, a read-only fixed-environment display, wishlist-import status with
review access, user-facing Wallhaven controls, the global price refresh next
to the existing provider sweeps, and an enrichment queue overview with a
retry for failed jobs. Export and import stay out (18b, 18c); nothing here
changes product rules, queues, or provider pipelines.

## Design reference

No mockup exists (19a owns the next prototype round). Settings already
follows the shared `SectionCard` system styled by feature 15; every new
surface reuses that pattern, `StatusPill`, and the existing button styles.
No new visual design is introduced.

## In scope

- `SessionCard`: signed-in Google email, "Connected" pill, sign out (reusing
  the layout's server-action pattern)
- `EnvironmentCard`: read-only display of the fixed environment fields from
  `AppSettings` (desktop OS, portable device, fallback OS, price country,
  time zone) with schema defaults when the row is missing
- `WishlistImportStatusCard`: open-review and ignored counts plus a link to
  the existing review section on `/wishlist#wishlist-import-reviews`
- Wallhaven controls inside the existing Appearance wallpaper row: a
  "Shuffle now" button calling the existing `shuffleWallpaper` action and a
  status caption (pool cached at, last error) from `WallpaperState`
- `PriceStatusCard`: the existing `PriceRefreshPanel` button plus the latest
  `PriceRefresh` run summary (status, counts, finished at)
- `EnrichmentQueueCard`: per-provider counts of `QUEUED`/`RUNNING`/
  `RETRY_WAIT` jobs, a FAILED list (game, provider, error, link to game
  detail), and a per-item retry server action that requeues a failed job
  with a fresh attempt budget and dispatches it to the existing claim-guarded
  runners
- Page wiring: settings queries for the new reads

## Out of scope

- Export (18b) and import/restore (18c)
- Editing environment fields; the plan says fixed environment display, so
  every value is read-only
- A persisted wishlist-import run record: today's import reports results via
  toast and the wishlist sync chip only, and adding storage is a schema
  change beyond 18a; the status card covers counts and review access
- Steam session management beyond display and sign out (one fixed Google
  account)
- Cron scheduling, `steamDailySyncEnabled`, and `itadDailyRefresh`
  (feature 20 consumes those flags untouched)
- A PriceRefresh retry list: the global "Update prices" action re-runs
  everything and already reports failed counts, so it is the retry
- Any change to batch runners, sweep actions, snapshot payloads, or the
  EnrichmentJob lifecycle beyond requeueing FAILED rows

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Session and environment cards** - create
  `src/components/settings/SessionCard.tsx` (server): accepts
  `{ email: string | null; signOutAction: () => Promise<void> }`, shows the
  email with a "Connected" `StatusPill` and a sign-out button using the same
  server-action form pattern as `AppNav`. Create
  `src/components/settings/EnvironmentCard.tsx` (server): read-only rows for
  desktopOs, portableDevice, fallbackOs, priceCountry, and timeZone with
  human labels ("Bazzite", "Steam Deck", "Windows", "MX",
  "America/Mexico_City"), falling back to those defaults when the settings
  row is missing. Wire both into `/settings` (the page calls `requireUser`
  for the email and defines the sign-out action inline like the layout).
  *Done when:* with `pnpm dev`, Settings shows the signed-in Google email
  (or a "Signed in" fallback line when the session has no email), sign out
  ends the session and returns to the landing page, and the
  environment rows match the database values; a missing `AppSettings` row
  renders the defaults instead of an error.

- [x] **Step 2 - Wishlist import status card** - create
  `src/components/settings/WishlistImportStatusCard.tsx` (server): counts
  `WishlistImportReview` rows with `status: "OPEN"` and all
  `WishlistImportIgnore` rows, renders both counts with a `StatusPill`
  ("Needs review" when reviews exist, "Clear" otherwise), and links to
  `/wishlist#wishlist-import-reviews` labeled "Review matches on Wishlist".
  Zero reviews shows the link with an empty-state line instead of a badge.
  *Done when:* the counts match the database; the link navigates and the
  browser scrolls to the review section when one exists; an empty queue
  shows the clear state.

- [x] **Step 3 - Wallhaven controls** - extend the wallpaper `SettingRow` in
  `AppearanceSection` with a "Shuffle now" button that calls the existing
  `shuffleWallpaper` action, toasts success or failure, and refreshes the
  router; add a status caption under the row fed by new props
  `{ poolCachedAt: Date | null; lastError: string | null }` (rendered as
  "Pool updated {date}" or the error text). `/settings` queries
  `WallpaperState` and passes the values.
  *Done when:* Shuffle now visibly changes the desktop wallpaper and the
  caption shows the cached date; with an empty pool or a last error the
  caption states it; the existing enable toggle behaves exactly as before.

- [x] **Step 4 - Price refresh card** - create
  `src/components/settings/PriceStatusCard.tsx` (server): a `SectionCard`
  (eyebrow "Provider maintenance", title "Prices") showing the latest
  `PriceRefresh` run (status pill, counts, requested/finished timestamps)
  above the existing `PriceRefreshPanel` button. Export the panel's
  `readCounts` helper and reuse it for tolerant count parsing.
  *Done when:* clicking "Update prices" from Settings runs the global
  refresh and the summary line reflects the new run after the automatic
  refresh; a history with no runs shows "No price refresh yet".

- [x] **Step 5 - Enrichment retry action** - create
  `src/actions/enrichment-retry.ts` with `retryEnrichmentJob(jobId: string)`:
  guarded by `requireUser`, it loads the job, rejects anything whose status
  is not `FAILED` with the `{ success, data, error }` pattern, then updates
  it to `QUEUED` with `attempt: 0`, `nextAttemptAt: null`, and
  `lastErrorCode`/`lastErrorMessage` cleared, keeping `stage` and any matched
  RAWG candidate data so the job resumes rather than rematches. Resetting the
  attempt is required: the runners' claim guard only starts jobs with
  `attempt < maxAttempts`, and FAILED jobs are terminal exactly because they
  exhausted three attempts. After requeueing, dispatch by provider to the
  existing runners and await the terminal status: RAWG jobs to
  `runRawgEnrichmentJob`, PROTONDB and AWAY jobs to `runCompatJob`; any other
  provider returns a "retry not available" error. Ship
  `enrichment-retry.test.ts` covering the happy path (requeue fields plus the
  runner called), a non-FAILED job rejection, the auth guard, and the
  unsupported-provider error.
  *Done when:* a failed job is requeued and processed by the invoked runner,
  leaving `FAILED` (the counts and error fields update accordingly); a
  QUEUED, RUNNING, or RETRY_WAIT job id is rejected without any write; tests,
  typecheck, and build are green.

- [x] **Step 6 - Enrichment queue card** - create
  `src/components/settings/EnrichmentQueueCard.tsx`: a server card (eyebrow
  "Provider maintenance", title "Enrichment queue") grouping `EnrichmentJob`
  counts by provider for `QUEUED`/`RUNNING`/`RETRY_WAIT`, listing FAILED jobs
  newest first (game name, provider, error text, link to the game detail
  page) capped at ten rows, and a client `Retry` button per row that calls
  the retry action, toasts the outcome, and refreshes the router. The retry
  button renders only for RAWG, PROTONDB, and AWAY jobs. Hide the list when
  nothing failed and show an all-clear line when the queue is empty. Wire the
  card into `/settings`.
  *Done when:* the counts match the database; retrying a failed job from the
  card completes and the list updates after the refresh; an empty queue shows
  the all-clear state.

- [x] **Step 7 - Acceptance** - run `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. Walk Settings in dark, light, and system modes on desktop
  and mobile: sign out and back in, check environment values against the
  database, run a price refresh, shuffle the wallpaper with reduced data on
  and off, and retry a failed enrichment job end to end. Confirm the
  existing Steam, sweep, recommendation, sources, and DLC cards are
  untouched.
  *Done when:* every new surface behaves as specified, pre-existing cards
  render exactly as before, and all three checks are green.

## Files / areas

- `src/app/(app)/settings/page.tsx` - session call, new queries, section
  wiring
- `src/components/settings/SessionCard.tsx` (new, server)
- `src/components/settings/EnvironmentCard.tsx` (new, server)
- `src/components/settings/WishlistImportStatusCard.tsx` (new, server)
- `src/components/settings/PriceStatusCard.tsx` (new, server)
- `src/components/settings/EnrichmentQueueCard.tsx` (new, server) plus a
  small client retry button inside the same folder
- `src/components/settings/AppearanceSection.tsx` - shuffle button and
  status caption
- `src/components/wishlist/PriceRefreshPanel.tsx` - export `readCounts` only
- `src/actions/enrichment-retry.ts` (new) +
  `src/actions/enrichment-retry.test.ts`
- No schema, migration, or pipeline changes

## Data / contracts

- Read-only consumption: `AppSettings` (desktopOs, portableDevice,
  fallbackOs, priceCountry, timeZone), `WishlistImportReview` (OPEN),
  `WishlistImportIgnore`, `WallpaperState` (cachedAt, lastError),
  `PriceRefresh` (latest run), `EnrichmentJob` (status/provider grouping)
- Load-bearing, lock now: `retryEnrichmentJob` accepts FAILED jobs only,
  requeues with `attempt: 0` and `nextAttemptAt: null` (a fresh attempt
  budget), preserves `stage`/`candidatePayload`/`selectedRawgId`, clears only
  the error fields, and dispatches RAWG to `runRawgEnrichmentJob` and
  PROTONDB/AWAY to `runCompatJob`. The runners stay the sole executors and
  their claim guards stay authoritative; feature 20's cron sweeps must keep
  working against jobs this action requeues, and per-game detail panels must
  treat the job as a normal queued job afterward.
- `readCounts` becomes a shared export from `PriceRefreshPanel` so the
  settings summary and the wishlist toast parse `PriceRefresh.counts`
  identically.
  Implementation note: `readCounts` actually landed in the neutral module
  `src/lib/price-counts.ts` (it cannot live in the `"use client"`
  `PriceRefreshPanel` and be imported by a server component); both the
  panel and the settings summary import from there, preserving the shared
  parsing contract.
- No new provider calls, no new stored shapes, no route changes

## Testing

- Vitest covers `retryEnrichmentJob` (happy path, non-FAILED rejection,
  auth guard) per the test gate; the `readCounts` export is already covered
  indirectly and gains no new logic
- Everything else is server reads and UI: per-step browser evidence plus the
  build; shuffle and price refresh behaviors are verified live through the
  running app (Steps 3, 4, and 6)

## Notes for the AI

- All new cards are server components; only the retry button (and the
  existing panels) are client boundaries. Keep queries on the page and pass
  plain data down.
- Reuse `requireUser`, the `{ success, data, error }` action pattern, and
  `friendlyActionError`; follow the layout's inline sign-out server action
  for the session card.
- The environment card must never offer editing: the fields are fixed
  context by design.
- When grouping jobs, order providers deterministically (RAWG, PROTONDB,
  ARE_WE_ANTICHEAT_YET) and cap the FAILED list display (newest first) so
  the card stays scannable; the full history remains in the database.
- Providers outside the retry dispatch table get no retry button; never
  extend the action to statuses or providers the runners do not own.
- Do not touch `steamDailySyncEnabled` or `itadDailyRefresh`; feature 20
  owns them.
- Single-user app: no per-user scoping. No comments except non-obvious
  decisions; no em dashes in generated content.
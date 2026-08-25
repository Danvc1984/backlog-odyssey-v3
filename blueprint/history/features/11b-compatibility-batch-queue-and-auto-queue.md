# Feature: Compatibility batch queue and auto-queue

**From build-plan:** feature 11b (sub-item of 11)
**Status:** complete

## Goal

Make compatibility evidence population automatic instead of per-game manual: after
a catalog game's RAWG enrichment succeeds, queue and run its ProtonDB + AWAY
compatibility refresh with no extra clicks; and add a global compatibility sweep
from Settings that refreshes every eligible catalog game with live batch progress
and overlap protection.

## In scope

- Post-RAWG auto-queue: when a catalog game's RAWG enrichment job succeeds, create
  (or reuse) its PROTONDB `EnrichmentJob` and run it inline, best-effort. Evidence
  appears without a manual per-game refresh.
- Global compatibility sweep from Settings: one action that queues every eligible
  catalog game into a `PROTONDB` `SyncRun` batch and drives it via polling.
- Batch progress UI: a Settings panel with live status, progress bar, per-status
  counts, and a failed-games list linking to game detail.
- Overlap protection: never start a second sweep while one is `RUNNING`; skip games
  with an already-active PROTONDB job; idempotent job upsert on the existing
  `[gameId, provider]` unique constraint.

## Out of scope

- Per-game manual refresh and the compatibility display itself (built in 11a).
- Wishlist compatibility detail (11c) - this feature is catalog games only.
- Any change to the compatibility API clients, synthesis, or persistence logic.
- Recommendation engine and Today dashboard integration (features 12, 13).
- A background scheduler or Vercel Cron for the sweep (still manual; deployment
  cron is feature 18).
- Changing the 180-day freshness window or retry policy (already set in 11a).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Compat batch summary logic** - `src/lib/compat-batch.ts` with
  `CompatBatchCounts` (`{ total, queued, running, retryWaiting, succeeded, failed }`),
  `emptyCompatBatchCounts()`, `summarizeCompatBatchJobs()`, `compatBatchStatus()`
  (`RUNNING` when any queued/running/retryWaiting, `FAILED` when total 0, `PARTIAL`
  when failed > 0, else `SUCCESS`), `compatBatchProgress()`, and
  `compatBatchSummary()`. No `AWAITING_MATCH` (compat never awaits match).
  *Done when:* unit tests cover every status branch, the total 0 case, and progress
  rounding.

- [x] **Step 2 - Compatibility eligibility and inline queue** - `src/lib/compat-queue.ts`
  with `isCompatEligible(game)` (must have a `STEAM_APP` `ExternalGameId`; not ROM-only,
  i.e. not (has `ROM` availability and no `STEAM` availability); catalog game with a
  `libraryEntry`) and `queueCompatibilityForGame(gameId)`. The queue function skips
  when ineligible or when an active PROTONDB job exists, otherwise upserts the
  `[gameId, provider = "PROTONDB"]` job in the same shape `refreshGameCompatibility`
  uses (status `QUEUED`, stage `MATCHING`, `maxAttempts = COMPAT_JOB_MAX_ATTEMPTS`)
  and runs it via `runCompatJob`. Add `isActiveCompatJobStatus` to
  `src/lib/compat-job.ts` and reuse it here.
  *Done when:* unit tests cover no-Steam-identity, ROM-only, active-job skip, and the
  queue-then-run success path.

- [x] **Step 3 - Compat batch runner** - `src/lib/compat-batch-runner.ts` mirroring
  `rawg-batch-runner.ts`: `getCompatBatchStatus(batchId)`,
  `getLatestCompatBatchStatus()`, and `runCompatBatch(batchId)`. `runCompatBatch`
  selects up to 5 ready jobs (`syncRunId = batch.id`, provider `PROTONDB`, status
  `QUEUED` or due `RETRY_WAIT`) and runs each via `runCompatJob`, then refreshes the
  batch summary and finished-at. `CompatBatchView` carries `failedGames`
  (`[{ id, name }]` for `FAILED` jobs). No awaiting-match follow-ups.
  *Done when:* unit tests cover batch read, running ready jobs, summary refresh, and
  the latest-status fallback chain (active -> partial-with-failures -> latest).

- [x] **Step 4 - Sweep action and batch API route** -
  `src/actions/compat-batch-enrichment.ts` exports `startCompatibilitySweep` that,
  inside a transaction: returns `ACTIVE_BATCH` when a `RUNNING` `PROTONDB` `SyncRun`
  exists; otherwise finds eligible base games (type `BASE_GAME`, `libraryEntry`
  present, has `STEAM_APP` identity, not ROM-only, no active PROTONDB job), creates a
  `PROTONDB` `SyncRun` with initial counts, and upserts each eligible game's PROTONDB
  job with `syncRunId`. Mirrors `startRawgCatalogEnrichment`, including the P2002
  overlap catch. Add `src/app/api/enrichment/compat/batches/[batchId]/route.ts` with
  `GET` (status) and `POST` (run) guarded by `requireUser`.
  *Done when:* action tests cover the eligible/queued/skipped counts, the
  active-batch guard, and the no-eligible case without creating an empty batch;
  route tests cover GET/POST success
  and 404.

- [x] **Step 5 - Post-RAWG auto-queue hook** - In `src/lib/rawg-job-runner.ts`,
  after `persistRawgMatch` returns success, call `queueCompatibilityForGame(job.game.id)`
  inside its own `try/catch` so a compatibility failure never fails the RAWG job.
  Update `rawg-job-runner.test.ts` to mock `@/lib/compat-queue`.
  *Done when:* tests confirm the hook runs on a successful persist, skips ineligible
  games, and a thrown compat error still lets the RAWG job reach `SUCCEEDED`.

- [x] **Step 6 - Settings sweep panel** - `src/components/games/CompatibilitySweepPanel.tsx`
  mirroring `RawgBatchEnrichmentPanel` (no match-review section): a "Sweep
  compatibility" button when idle, and when a batch is present a live status line,
  progress bar, per-status counts, and a failed-games list linking to `/games/[id]`.
  Failed games with a saved Bazzite override are omitted, and each remaining
  failed-game row can be dismissed with an `X`; the failed-games block disappears
  when no rows remain.
  Polls the batch route (GET then POST while `RUNNING`) every 2s and toasts the
  terminal result. `src/app/(app)/settings/page.tsx` loads
  `getLatestCompatBatchStatus()` and renders the panel above the connected-services
  section. *Done when:* a sweep from Settings queues and runs eligible games with a
  visible progress bar and counts, failed games link out, and the panel returns to
  idle after finishing (verified live in the browser).

## Files / areas

**New files:**
- `src/lib/compat-batch.ts` + `compat-batch.test.ts`
- `src/lib/compat-queue.ts` + `compat-queue.test.ts`
- `src/lib/compat-batch-runner.ts` + `compat-batch-runner.test.ts`
- `src/actions/compat-batch-enrichment.ts` + `compat-batch-enrichment.test.ts`
- `src/app/api/enrichment/compat/batches/[batchId]/route.ts` + `route.test.ts`
- `src/components/games/CompatibilitySweepPanel.tsx`

**Modified files:**
- `src/lib/compat-job.ts` - add `isActiveCompatJobStatus`
- `src/lib/rawg-job-runner.ts` - post-RAWG auto-queue hook (+ test update)
- `src/app/(app)/settings/page.tsx` - load latest batch + render panel

## Data / contracts

No schema changes. Reuses existing models.

**SyncRun** - batch umbrella with `provider = "PROTONDB"`, `status`, `counts`
(`CompatBatchCounts` JSON), `finishedAt`.

**EnrichmentJob** - one row per `[gameId, provider = "PROTONDB"]`, `syncRunId`
linking sweep jobs to the batch (nullable for inline/auto-queued jobs). Status
enum already supports `QUEUED/RUNNING/RETRY_WAIT/SUCCEEDED/FAILED`.

**CompatBatchCounts (load-bearing contract, mirrors RAWG counts minus awaitingMatch):**
```ts
{ total: number; queued: number; running: number; retryWaiting: number; succeeded: number; failed: number }
```

**CompatBatchView (load-bearing contract):**
```ts
{
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  counts: CompatBatchCounts;
  progress: number;
  isTerminal: boolean;
  finishedAt: string | null;
  failedGames: Array<{ id: string; name: string }>;
}
```

**Sweep eligibility (load-bearing contract):** catalog base game (`type:
"BASE_GAME"`, `libraryEntry` present) with a `STEAM_APP` `ExternalGameId`, not
ROM-only (availability has `ROM` and no `STEAM`), and no active PROTONDB
`EnrichmentJob` (`QUEUED`/`RUNNING`/`RETRY_WAIT`). A sweep re-runs every eligible
game regardless of existing snapshot freshness (a sweep is an explicit full
refresh; per-game refresh stays the targeted re-check).

**Sweep action result:** `{ kind: "ACTIVE_BATCH", batchId, status }` or
`{ kind: "BATCH", batchId, status, counts: { eligible, queued, skippedActiveWork, skippedIneligible } }`.

## Testing

- **Step 1** - unit tests for `summarizeCompatBatchJobs`/`compatBatchStatus`/
  `compatBatchProgress` across all statuses including `total: 0`.
- **Step 2** - unit tests for `isCompatEligible` (no identity, ROM-only, eligible)
  and `queueCompatibilityForGame` (skip paths + queue-and-run). Mock `prisma`,
  `runCompatJob`, and `server-only`.
- **Step 3** - unit tests for `runCompatBatch`/`getCompatBatchStatus`/
  `getLatestCompatBatchStatus` with mocked `prisma` and `runCompatJob`.
- **Step 4** - unit tests for `startCompatibilitySweep` (counts, active-batch
  guard, P2002 overlap recovery, no-eligible) and the route handlers (success, 404).
- **Step 5** - extend `rawg-job-runner.test.ts`: auto-queue on success, skip
  ineligible, compat failure does not fail RAWG. Add `vi.mock("@/lib/compat-queue")`.
- **Step 6** - no component unit test (per coding-standards.md: UI rides on
  screenshot + build); verify live in the browser.

## Notes for the AI

- **Server-only.** `compat-queue.ts`, `compat-batch-runner.ts`, and the action/route
  import `server-only` (or `"use server"`). Never expose provider responses client-side.
- **Mirror the RAWG batch pattern.** The sweep reuses the exact polling architecture
  of `rawg-batch-runner.ts`, `rawg-batch-enrichment.ts`, and the RAWG batch route;
  compat has no `AWAITING_MATCH`, so drop that bucket and the pending-review UI.
- **Reuse `runCompatJob`.** Do not reimplement the claim/retry/persist logic; the
  batch runner and queue call `runCompatJob(jobId)` from `compat-job-runner.ts`.
- **Job shape.** The queued PROTONDB job shape must match `refreshGameCompatibility`
  (`status QUEUED`, `stage MATCHING`, `maxAttempts = COMPAT_JOB_MAX_ATTEMPTS`,
  `progress 0`). `queueCompatibilityForGame` may duplicate this small shape rather
  than refactor the already-tested 11a action; `startCompatibilitySweep` enqueues
  with `syncRunId` set.
- **Do not fail RAWG on compat failure.** The post-RAWG hook is best-effort and
  wrapped in `try/catch`.
- **Overlap protection.** The active-batch check runs inside the sweep transaction;
  the job upsert on `[gameId, provider]` and the `isActiveCompatJobStatus` skip are
  the backstops. Catch P2002 like `startRawgCatalogEnrichment` does.
- **Concurrency.** Batch runs up to 5 jobs per `POST`, matching the RAWG batch.
- **Single-user auth.** Every action and route starts with `requireUser()`; no
  per-user query scoping (see coding-standards.md).

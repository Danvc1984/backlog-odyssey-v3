# Feature: Single-game asynchronous RAWG enrichment

**From build-plan:** feature 8b
**Status:** not started - review required

## Goal

Let the owner start or refresh RAWG enrichment from one game detail page without
blocking the page request: create a durable per-game job, show progress and
provider outcomes, require confirmation before replacing existing RAWG metadata,
and retry transient failures without changing authoritative catalog data.

## In scope

- A persistent `EnrichmentJob` record for the current RAWG job of one catalog game.
- An authenticated detail-page action that starts, reuses, retries, or confirms
  replacement of a RAWG job without creating duplicate active work.
- A bounded server-side job runner with RAWG matching, safe persistence through
  the Feature 8a helper, retry classification, exponential backoff, and terminal
  outcomes.
- A persisted ambiguous-match review state with candidate selection on the game
  detail page, using the explicit `selectedRawgId` contract from Feature 8a.
- An explicit owner action to adopt the title from a persisted RAWG snapshot when
  a manually entered catalog name needs correction.
- Detail-page progress, retry, match-selection, success, and failure states that
  survive reloads and do not hide the last valid snapshot.
- Authenticated status and run endpoints for the page to poll and resume queued
  work while the detail page is open.

## Out of scope

- Catalog-wide enqueueing, batch progress, partial-failure summaries, and library
  actions. Feature 8c owns those concerns.
- Post-import enqueueing. Feature 8d owns that trigger.
- A deployment scheduler, separate worker service, or always-on background
  process. This feature resumes retry work from the open detail page; later
  operations can add durable batch processing and scheduling.
- Wishlist enrichment, compatibility evidence, price data, dynamic themes, or
  provider execution other than RAWG.
- Automatic replacement of an existing RAWG snapshot without an explicit owner
  confirmation.
- RAWG match suggestions in manual catalog forms. This feature only handles the
  detail-page review flow.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); the user reads and understands it.
4. The user approves, then chooses whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` makes the feature-level commit.

Never accept a step that has not been read. If a diff is too large to review,
split the step before continuing.

## Build steps

- [x] **Step 1 - Lock the durable job contract** - Add the Prisma
  `EnrichmentJob` model and migration, its status/stage fields, the one-current-
  job-per-game/provider constraint, and typed job-state helpers. *Done when:*
  `prisma migrate status` reports the migration in sync; the generated client
  exposes the job contract; unit tests cover valid transitions for queued,
  running, retry-wait, awaiting-match, succeeded, and failed states; and an
  active job cannot be duplicated for the same game and RAWG provider.

- [x] **Step 2 - Add authenticated enqueue, overwrite, and match-review actions**
  - Add the detail-page Server Actions that validate the game and job IDs, call
  `requireUser()`, return an explicit overwrite warning when a RAWG snapshot
  already exists, reuse an active job, and allow a confirmed retry or refresh.
  - Persist ambiguous RAWG candidates and add a selection action that accepts
  only one of the candidates belonging to that job. *Done when:* action tests
  prove unauthenticated access is rejected, overwrite warnings do not mutate
  data, duplicate clicks reuse one job, invalid candidate IDs are rejected, and
  all action results use the existing `{ success, data, error }` convention.

- [x] **Step 3 - Implement the bounded RAWG job runner and endpoints** - Add a
  server-only runner plus authenticated `GET` status and `POST` run handlers for
  one job. Claim queued work safely, call `matchRawgGame` with the catalog title
  and Steam App ID when available, persist only matched results through
  `persistRawgMatch`, store ambiguous candidates for review, and classify
  transient versus terminal failures. *Done when:* tests prove one claimant can
  own a job, matched work reaches the existing persistence helper, no-match and
  identity-conflict outcomes preserve the prior snapshot, network and retryable
  HTTP failures schedule at most three attempts with increasing delay, and
  configuration, malformed-response, non-retryable HTTP, or exhausted failures
  become safe terminal state.

- [x] **Step 4 - Add the detail-page control and live progress states** - Add a
  client panel beside the existing RAWG metadata section with load/refresh
  actions, explicit overwrite confirmation, queued/running progress, retry-wait
  countdown, ambiguous candidate selection, success, and retryable/terminal
  failure states. Let the owner cancel an ambiguous review and explicitly adopt
  a persisted RAWG title into the catalog name. Persist and paginate additional
  RAWG candidate pages from the server without trusting client-supplied titles.
  Poll the authenticated status endpoint, resume due work while the page is
  open, refresh the server-rendered metadata after success, and keep the
  previous snapshot visible during replacement or failure. *Done when:*
  browser inspection proves an empty game can start enrichment, an existing
  snapshot requires confirmation, progress survives reload, an ambiguous result
  offers only persisted candidates, a successful run shows the new metadata, and
  failed refresh leaves the previous metadata visible; the page remains usable
  with no API key or missing optional values.

## Files / areas

- `prisma/schema.prisma` - `EnrichmentJob` model, enums, game relation, and
  current-job uniqueness.
- `prisma/migrations/*_add_enrichment_jobs/migration.sql` - durable job schema.
- `src/lib/rawg-job.ts` - job states, retry policy, safe transitions, and runner
  orchestration.
- `src/lib/rawg-job.test.ts` - transition, claim, retry, and outcome coverage.
- `src/actions/rawg-enrichment.ts` - authenticated enqueue, retry, and candidate
  selection actions.
- `src/actions/rawg-enrichment.test.ts` - action validation, overwrite, and
  deduplication coverage.
- `src/app/api/enrichment/rawg/[jobId]/route.ts` - authenticated status and
  bounded run handlers.
- `src/components/games/RawgEnrichmentPanel.tsx` - client control, polling, and
  progress or review states.
- `src/app/(app)/games/[id]/page.tsx` - load the current job and render the panel
  alongside the existing RAWG metadata section.
- `src/lib/rawg-types.ts` and `src/lib/rawg-enrichment.ts` - extend only where
  the 8b job contract needs a typed retry or candidate boundary; preserve the 8a
  match and persistence contracts.

## Data / contracts

- `EnrichmentJob` is one replaceable current-work record per
  `(gameId, provider)`, with `provider = RAWG` for this feature. It stores
  `status`, `stage`, `attempt`, `maxAttempts` (3), integer `progress`,
  `nextAttemptAt`, `candidatePayload`, `selectedRawgId`, safe `lastErrorCode`,
  `lastErrorMessage`, `startedAt`, `finishedAt`, and timestamps. It has no job
  history and does not replace `MetadataSnapshot` history, which is already
  replaceable by contract.
- Statuses are `QUEUED`, `RUNNING`, `RETRY_WAIT`, `AWAITING_MATCH`, `SUCCEEDED`,
  and `FAILED`. Stages are `MATCHING`, `PERSISTING`, `RETRYING`, `COMPLETE`, and
  `FAILED`. Progress is server-owned and uses stable milestones: queued 0,
  matching 25, persisting 75, complete 100. Awaiting-match and terminal failure
  retain the last meaningful progress value.
- Enqueue is idempotent for an active job. A RAWG snapshot without explicit
  confirmation returns `OVERWRITE_REQUIRED` and does not create or reset a job.
  Confirmation is required for refreshes even when the previous job failed.
- `AMBIGUOUS` stores the typed candidate list in the job, moves to
  `AWAITING_MATCH`, and does not alter identities or metadata. Candidate selection
  validates membership, stores the selected RAWG ID, returns the job to `QUEUED`,
  and reruns matching through the 8a `selectedRawgId` path. The server can append
  later RAWG search pages to the persisted candidate set; a selected ID is fetched
  directly only after that membership validation. The owner can cancel an awaiting
  review, which records terminal `FAILED` state with `CANCELLED` diagnostics and
  never changes metadata or identities.
- A RAWG title never changes `Game.name` automatically. The detail page offers an
  explicit owner action only when a valid persisted RAWG snapshot title differs
  from the current catalog name.
- Retry policy is bounded to three attempts. Network failures and HTTP 429 or
  5xx responses are retryable with increasing delays; configuration failures,
  malformed responses, HTTP 4xx responses other than 429, no-match outcomes,
  RAWG identity conflicts, and persistence failures are terminal. An exhausted
  retry becomes `FAILED` with a safe message and no provider secret.
- The current valid RAWG snapshot is never deleted before a new match has been
  successfully persisted. Failed or ambiguous refreshes leave the previous
  snapshot and its attribution visible.
- `GET` returns only the job state needed by the current detail page, including
  safe candidates and error text. `POST` runs one bounded claim/attempt and never
  accepts provider credentials or a client-supplied game title.
- All protected actions and route handlers call `requireUser()`. The RAWG key,
  provider calls, matching, and persistence remain server-only.

## Testing

- Unit-test job transition and retry policy with Vitest fake timers, including
  claim races, duplicate enqueue, retry cutoff, and safe terminal errors.
- Mock Prisma, `requireUser`, `matchRawgGame`, and `persistRawgMatch`; do not call
  RAWG or a real database from the unit suite.
- Action tests cover invalid IDs, auth failure, overwrite confirmation,
  active-job reuse, candidate membership, cancellation, explicit RAWG-title
  adoption, paged candidate persistence, and the `{ success, data, error }`
  result shape.
- Route and runner tests cover status filtering, one-at-a-time claims, exact
  Steam App ID forwarding, selected candidate forwarding, no-match behavior,
  snapshot preservation, and retry scheduling.
- Run `pnpm prisma:migrate` in implementation only after reviewing the migration,
  then `pnpm prisma migrate status` or the project script equivalent before
  acceptance. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`
  after each accepted step as required by the project workflow.
- Use live browser evidence on `/games/[id]` for empty-state load, overwrite
  confirmation, progress/reload behavior, match review, success, and failure
  preservation. Use a local mocked provider or controlled fixture; never require
  a live RAWG request for the manual review.

## Notes for the AI

- Preserve the existing server-component detail-page pattern and Tailwind styling.
  The interactive panel is the only new client component.
- Use Zod for every action and route input. Do not trust a client-supplied user,
  title, provider, or candidate that is not present in the persisted job.
- Keep the runner bounded to one job attempt per `POST`. The open detail page
  schedules due retry attempts; do not invent a scheduler or a background worker
  service in this feature.
- Do not overwrite `Game.name`, availability, personal fields, Steam identity,
  non-RAWG snapshots, or the prior RAWG snapshot until the new match is ready.
  The only name exception is the explicit owner action that adopts a valid,
  persisted RAWG title.
- The generated Prisma client and migration must stay in sync. Run the real
  migration command against the configured database, not an implicit default
  database URL.
- Do not commit, merge, or mark the build-plan item complete during this spec or
  implementation loop. `/complete` owns archive, checkbox, and merge work.

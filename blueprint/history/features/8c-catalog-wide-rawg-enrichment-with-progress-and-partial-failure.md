# Feature: Catalog-wide RAWG enrichment with progress and partial failure

**From build-plan:** feature 8c
**Status:** not started - review required

## Goal

Let the owner start one durable RAWG enrichment batch from the library for all
eligible catalog base games, see reload-safe aggregate progress and outcomes,
and safely continue bounded per-game retries without blocking the library page
or overwriting existing metadata.

## In scope

- An authenticated library-level action that creates one RAWG batch and enqueues
  only eligible base-library games in a bounded, idempotent transaction.
- Durable association between a batch `SyncRun` and its target `EnrichmentJob`s,
  plus a stable aggregate view for queued, running, retrying, succeeded,
  failed, and awaiting-match work.
- A bounded server-side batch runner endpoint that claims and processes at most
  one due job per request through the existing single-game RAWG runner.
- A library client panel with start, in-progress, retry-wait, complete, and
  partial-failure states. It polls the authenticated batch endpoint while open
  and refreshes the server-rendered library when the batch settles.
- Clear aggregate reporting for succeeded, no-match or terminal failures,
  pending manual match reviews, and skipped games, without exposing provider
  diagnostics or credentials.

## Out of scope

- Post-import enqueueing, including changes to Steam import or sync. Feature 8d
  owns that trigger.
- Automatic enrichment after an import, a scheduler, worker service, cron job,
  or background execution when no owner page is open.
- Automatic title adoption, automatic RAWG candidate selection, or a batch
  control that overwrites an existing RAWG snapshot. Those remain explicit
  single-game actions from 8b.
- Wishlist RAWG enrichment, DLC queue work, compatibility, pricing, dynamic
  themes, or provider work other than RAWG.
- Retaining a permanent history of individual enrichment attempts. `SyncRun`
  stores one batch summary; `EnrichmentJob` remains the current-work record
  defined by 8b.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files, with the observable done-when.
4. The user reviews and approves the step before implementation continues.
5. `pnpm test`, `pnpm typecheck`, and the documented build check must pass
   before a step is accepted. The library control also needs live browser
   evidence.

Never accept a step that has not been read. If a diff is too large to review,
split the step before continuing.

## Build steps

- [x] **Step 1 - Lock batch membership and aggregate contracts** - Extend the
  existing `SyncRun` and `EnrichmentJob` boundary so a RAWG batch has stable
  target membership, safe typed counts, and one active batch at a time; add a
  reviewed migration for the nullable batch association, its index, and a
  PostgreSQL partial unique index that permits only one `RUNNING` RAWG batch.
  *Done when:* Vitest proves aggregate counts classify every RAWG job state, an
  `AWAITING_MATCH` job makes the final outcome partial rather than successful,
  and a completed batch keeps its recorded counts even when later individual
  enrichment changes a job.

- [x] **Step 2 - Enqueue an eligible catalog batch safely** - Add a validated,
  authenticated Server Action that finds eligible base games with a
  `LibraryEntry`, creates or reuses the active RAWG `SyncRun`, and creates or
  resets only their non-active jobs with the batch association. *Done when:*
  action tests prove unauthenticated and invalid input are rejected, duplicate
  clicks reuse the same active batch, active per-game jobs are not duplicated,
  games with a RAWG snapshot are skipped without an overwrite, and the response
  reports eligible, queued, skipped-existing-metadata, and skipped-active-work
  counts using `{ success, data, error }`.

- [x] **Step 3 - Run and report one batch item at a time** - Add authenticated
  status and run handlers for a batch. The run handler selects one queued or
  due-retry member, delegates only to `runRawgEnrichmentJob`, recomputes the
  persisted `SyncRun` summary, and marks the batch `SUCCESS`, `PARTIAL`, or
  `FAILED` only once no member can progress without owner input. *Done when:*
  runner and route tests prove concurrent callers cannot process the same job,
  each request runs at most one job, retry-wait work is not claimed early,
  no-match and ambiguous outcomes preserve prior metadata, and a mix of success,
  failure, and awaiting-match jobs produces a durable partial summary.

- [x] **Step 4 - Add the library batch control and observable progress** - Add
  a focused client panel to `/library` with an explicit start action, queued and
  completed counts, progress, retry-wait feedback, a partial-outcome explanation,
  and links to game detail pages for manual match review. Poll only while the
  active batch can advance, invoke the bounded runner as work becomes due, and
  clear completed or empty batch detail after reload while keeping a compact
  manual start control. *Done when:* browser
  inspection shows an empty-eligible state, a batch start, reload-safe progress,
  successful completion, and a partial result that identifies follow-up work;
  the library remains usable when RAWG is unconfigured or a game fails.

## Files / areas

- `prisma/schema.prisma` and a reviewed migration - attach current RAWG jobs to
  the existing `SyncRun` batch record without changing the one-job-per-game and
  provider constraint.
- `src/lib/rawg-batch.ts` and `src/lib/rawg-batch.test.ts` - typed eligibility,
  summary, terminal-status, and persisted-count helpers.
- `src/actions/rawg-enrichment.ts` and its tests, or a focused
  `src/actions/rawg-batch-enrichment.ts` pair - authenticated batch enqueue
  action following the existing action result convention.
- `src/lib/rawg-job-runner.ts` and tests - reuse the established per-job runner;
  add the smallest batch selection and summary hook needed for 8c.
- `src/app/api/enrichment/rawg/batches/[batchId]/route.ts` and route tests -
  authenticated status and one-item run boundary.
- `src/components/games/RawgBatchEnrichmentPanel.tsx` - client polling and
  aggregate batch UI.
- `src/app/(app)/library/page.tsx` - server-load the active or latest RAWG batch
  view and render the panel beside the library controls.

## Data / contracts

- Reuse `SyncRun` as the durable RAWG batch record, as its existing contract is
  provider-operation timing, outcome counts, and safe diagnostics. For this
  feature `provider = RAWG`; `RUNNING` means at least one member can progress,
  `SUCCESS` means every member succeeded, `PARTIAL` means at least one member
  failed or awaits owner match selection after all runnable work settles, and
  `FAILED` is reserved for a batch that could enqueue or run no member.
- Add a nullable, indexed `syncRunId` batch association to `EnrichmentJob`.
  It identifies membership while a batch is active. At finalization,
  `SyncRun.counts` persists the typed aggregate so later individual refreshes
  cannot rewrite the finished batch result. The association never creates job
  history or permits two RAWG jobs for a game.
- A game is eligible only when it is a `BASE_GAME` with a `LibraryEntry`, has no
  RAWG `MetadataSnapshot`, and does not have an active RAWG job. Existing RAWG
  metadata is always skipped, never overwritten by a catalog action. Existing
  failed jobs without a snapshot may be reset and retried; active jobs are
  skipped and counted separately. DLC is deferred until Feature 9 defines its
  ownership and queue flow.
- A single active RAWG `SyncRun` is idempotent. Repeated start requests return
  its view rather than expanding or duplicating its target set. The reviewed
  partial unique index enforces this across concurrent requests. A new batch
  may start only after the prior batch reaches a terminal summary.
- The batch endpoint accepts only a server-validated batch ID. It never accepts
  a game ID, title, provider, provider key, candidate, or client-defined job
  state. Every Server Action and handler calls `requireUser()`.
- A batch request processes at most one due job. It relies on the 8b claim and
  retry policy (maximum three attempts) and does not invent parallel workers.
  `AWAITING_MATCH` is visible manual follow-up, not a failure that the batch can
  auto-resolve.
- RAWG persistence remains exclusively in `persistRawgMatch`. Batch code must
  not alter `Game.name`, availability, personal fields, Steam identities,
  non-RAWG snapshots, or a valid prior RAWG snapshot.

## Testing

- Add Vitest coverage for eligibility, status aggregation, terminal summary
  rules, persisted-count immutability, one-active-batch deduplication, and
  response shape.
- Mock Prisma, `requireUser`, and `runRawgEnrichmentJob`. Do not contact RAWG or
  a real database in the unit suite. Use fake timers for retry-due boundaries.
- Test route authorization, malformed and missing batch IDs, one-at-a-time
  claiming, early retry rejection, and safe partial-failure diagnostics.
- The client panel is an integration surface. Verify it in a live browser with
  controlled local jobs for no eligible games, active progress, reload,
  completed success, retry wait, and partial failure or match review. No live
  RAWG key is required for this review.
- For each accepted logic-bearing step, run `pnpm test`; also run
  `pnpm typecheck`, `pnpm lint`, and `pnpm build`. If Turbopack is blocked by the
  sandbox, use `pnpm exec next build --webpack` and report that fallback
  separately.

## Notes for the AI

- This is the 8c slice only. Do not modify Steam import or sync; 8d explicitly
  owns post-import enqueueing.
- Keep server components as the default. The new batch panel may be a client
  component because it polls and starts bounded work. Match the existing
  `RawgEnrichmentPanel` interaction and Tailwind patterns rather than creating
  a second queue system.
- Keep the per-game `EnrichmentJob` state machine and `runRawgEnrichmentJob`
  as the source of truth for provider execution. Batch code coordinates,
  summarizes, and presents it; it must not duplicate RAWG matching, retry, or
  persistence logic.
- `project-overview.md` still labels 8a as active, but the live build plan,
  archived 8a/8b specs, and `main` history establish 8c as the current target.
  Do not edit the user-owned plan or overview in this feature-spec pass.
- Do not commit, merge, check off the build-plan item, or start implementation.
  `/complete` owns archive, checklist, and merge work after review.

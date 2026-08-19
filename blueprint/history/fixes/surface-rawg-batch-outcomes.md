# Fix: Surface RAWG batch failures and terminal outcomes

**Type:** Fix
**Status:** review required

## The problem

Catalog-wide RAWG enrichment persists individual `FAILED` jobs, but Library only
exposes games awaiting a match decision. Once a batch becomes terminal without
awaiting matches, the panel removes it from view and emits no final feedback.
The owner cannot identify failed games or distinguish a completed partial or
failed batch from a silent stop.

## The fix

Keep the latest terminal RAWG batch visible in Library, expose safe failed-job
names and detail links alongside match-review items, and show one clear final
toast for success, partial completion, or failure. Preserve the existing job
state, retry behavior, batch selection, and action controls.

## Out of scope

- Parallel job execution, concurrency limits, rate-limit handling, or any RAWG
  request-volume change. Those belong to a later performance fix.
- Retrying, cancelling, or editing failed jobs from Library.
- New schema or migration, RAWG request changes, or changes to individual game
  enrichment controls.

## Build steps

- [x] **Step 1 - Expose durable failure detail in the batch view** - Extend the
  RAWG batch server view with safe failed-game identifiers and names, then keep
  the latest terminal batch with failures or review work available to Library
  instead of letting a newer empty batch hide it.
  *Done when:* runner tests prove a partial or failed terminal batch includes
  failed games and remains available after reload, while persisted terminal
  counts stay immutable.

- [x] **Step 2 - Render terminal results and feedback in Library** - Show failed
  games with links next to match-review items and retain a terminal batch only
  while it has a follow-up action. Emit one terminal toast for success, partial,
  or failed completion, without duplicate polling notifications or a false
  success state. Empty terminal results close the panel automatically. *Done
  when:* browser inspection of the existing failed batch identifies its games
  and terminal state, while a terminal batch with no failed or review games is
  absent from Library.

## Verify

- Add focused Vitest coverage for the extended batch view and terminal-batch
  selection.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and
  `pnpm exec next build --webpack`.
- In `/library`, confirm the current failed batch remains visible after reload,
  exposes the failed games, and does not restart RAWG work automatically.

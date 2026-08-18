# Fix: Deduplicate and prioritize catalog operation toasts

**Type:** Fix
**Fixes:** N/A

## The problem

Merge and delete currently emit an action success toast directly from their
dialogs and a separate persistent Undo toast through `CatalogOperationToast`.
The `ActiveOperationsWatcher` can also rediscover pending operations after a
refresh. These paths do not share one notification ownership/category model, so
the user can see repeated or confusing success feedback and cannot tell which
message is the operation result versus the Undo control.

All notifications currently render through one Sonner stack. The desired order
is deterministic:

1. Default informational/success/error toasts at the bottom.
2. Catalog action-result toasts above the default group.
3. Pending Undo toasts at the top of the vertical notification group.

The attached screenshot is a visual reference for this hierarchy. It is not an
additional source of product requirements.

## The fix

- Introduce one app-owned toast categorization and deduplication boundary for
  default, catalog-action, and catalog-Undo notifications.
- Give each semantic notification a stable ID and one owner. A successful merge
  or delete may produce one action-result toast and one Undo toast, but the same
  operation must never produce either category twice when the action, router
  refresh, Strict Mode effect, or active-operation hydration runs.
- Make the active-operation watcher hydrate only missing Undo notifications and
  update/reuse an existing operation toast instead of creating another one.
- Render the three categories in explicit vertical lanes or an equivalent
  priority-aware viewport so default toasts remain lowest, action results sit
  above them, and Undo stays highest. Preserve the existing responsive behavior,
  close buttons, timers, and accessible action buttons.
- Keep unrelated toast messages working and preserve the existing merge/delete
  behavior, operation persistence, Undo action, and router refresh.

## Build steps

- [x] **Step 1 - Centralize toast ownership, deduplication, and visual priority** -
  Update the shared Sonner integration and catalog operation toast helpers, then
  update merge/delete and active-operation hydration to use the shared categories
  and stable IDs. Configure the notification viewport so default, action, and
  Undo messages render in that order without overlap. *Done when:* one successful
  merge and one successful delete each show at most one action-result toast and
  one Undo toast; a refresh or watcher hydration does not add duplicates; the
  screenshot-equivalent layout places default lowest, action above it, and Undo
  highest; closing or expiring a toast removes only its own notification; and
  clicking Undo still restores the operation and shows one final result.

## Files / areas

- `src/components/ui/sonner.tsx` - shared Sonner instances/configuration and
  category-aware rendering.
- `src/components/games/CatalogOperationToast.tsx` - stable operation-toast
  ownership, deduplication, lifecycle, and Undo result handling.
- `src/components/games/ActiveOperationsWatcher.tsx` - hydration that reuses
  existing pending Undo notifications.
- `src/components/games/MergeGamesDialog.tsx` - emit the shared catalog-action
  notification exactly once after a successful merge.
- `src/components/games/DeleteGameDialog.tsx` - emit the shared catalog-action
  notification exactly once after a successful delete.
- `src/app/layout.tsx` and/or `src/app/(app)/layout.tsx` - mount the shared
  notification viewport exactly once if the chosen implementation requires it.
- Existing components that use direct `sonner` calls may need only a shared
  helper import if the category boundary requires it; do not change their user
  messages unnecessarily.

## Verify

- Add focused unit tests for the toast registry/manager: stable IDs, duplicate
  action suppression, duplicate Undo suppression, watcher hydration reuse,
  independent merge/delete operation IDs, expiry cleanup, and Undo result
  cleanup.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `git diff --check`.
- Browser-check a successful merge and delete, a router refresh while the Undo
  window is active, a full page reload while an operation is pending, Undo within
  the window, expiry, and an unrelated default toast.
- Confirm visually that the notification hierarchy is default bottom, catalog
  action middle, and Undo top, with no duplicate cards or overlapping close
  buttons at desktop and narrow viewport widths.

## Notes for the AI

- This is a bug fix, not a new catalog feature. Do not change merge/delete
  transaction logic, operation snapshots, expiry duration, or database schema.
- Keep `requireUser()` and server-action behavior untouched. The issue is in the
  client notification ownership/rendering paths.
- Prefer stable semantic IDs derived from `operationId` and notification kind;
  do not use random IDs or rely on render count.
- Do not solve the visual order by timing one toast artificially. The category
  priority must remain correct when several notifications already exist.
- Preserve the existing `{ success, data, error }` contracts and the current
  15-second server-authoritative Undo behavior.

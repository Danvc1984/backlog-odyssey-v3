# Fix: friendly server-action error messages

**Type:** Fix
**Fixes:** F-23

## Summary

Server actions now distinguish user-facing domain failures from unexpected
internal errors. `ActionError` preserves approved friendly messages, while
`friendlyActionError` logs unexpected errors server-side and returns the
unchanged action fallback. Raw error ternaries were replaced across the action
modules, and user-facing throws were converted across actions and supporting
library code. Run-record diagnostic details remain untouched.

## Build steps

1. Add `src/lib/action-error.ts` with `ActionError` and helper unit tests.
   **Complete.**
2. Convert user-facing throws and action error catches, preserving error shapes,
   batch-specific handling, diagnostics, and existing friendly messages.
   **Complete.**

## Verification

- `pnpm test` — 100 files, 1035 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed.
- Source scan found no remaining raw `instanceof Error ? ...message` returns
  under `src/actions`.
- Manual confirmation verified the friendly rule message and provider-error
  fallback in the running app.

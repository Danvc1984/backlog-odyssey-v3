# Fix: standards cleanup batch

**Type:** Fix
**Fixes:** F-29, F-30, F-31, F-32, F-33

## The problem

Five small, independent drifts from the coding standards:

- F-29 - unused imports and bindings, a duplicate `ABANDONED_RUN_MS` export,
  and an unnecessary client directive on `SourceIcon`.
- F-30 - the no-owned-games Steam sync failure returned non-null `data`.
- F-31 - four cards used inline styles for line clamping.
- F-32 - wishlist create/update accepted any non-empty Steam App ID string.
- F-33 - generated recommendation copy used an em dash separator.

## The fix

- Removed unused bindings, centralized `ABANDONED_RUN_MS` in
  `price-refresh.ts`, and removed the unnecessary `SourceIcon` directive.
- Changed the Steam sync failure result to `data: null`, retaining counts on
  the persisted FAILED `SyncRun` row.
- Replaced inline clamp styles with Tailwind `line-clamp-2` and `line-clamp-3`
  classes.
- Applied the identity flow's `/^\d{1,10}$/` validation to wishlist create and
  update schemas, with rejection tests.
- Changed the recommendation separator to `": "` and updated four assertions.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` - 99 files, 1032 tests passing.
- `pnpm build`
- `git diff --check`

Both build steps were reviewed and approved on `fix/standards-cleanup-batch`.

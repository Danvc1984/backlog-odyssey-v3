# Fix: Today page payload and query trims

**Type:** Fix
**Fixes:** F-20, F-21

## The problem

Today loaded the full visible base-game catalog and RAWG payloads to choose one
spotlight, rebuilt genre/tag suggestions on every render, and awaited
independent data sources serially.

## The fix

The hero query now loads only visible main or in-progress base games. Genre/tag
suggestions use a ten-minute authenticated memo that does not cache failures.
Independent Today data sources load in one `Promise.all` wave, followed by a
second wave only for catalog rows that depend on recent Steam activity.

## Verification

- `pnpm typecheck` passed.
- `pnpm test` passed: 98 files, 1014 tests.
- `pnpm lint` passed with five pre-existing warnings.
- `pnpm build` passed with Next.js 16.3.0 Turbopack.
- `git diff --check` passed.
- Manual `/today` verification confirmed the spotlight, offers, Play Next/Buy
  sections, tune suggestions, and recommendation generation.

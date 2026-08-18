# Fix: Clear lint errors in test doubles and collection dialogs

**Type:** Fix
**Fixes:** F-04

## The problem

`pnpm lint` reported 20 errors from explicit `any` casts in partial Prisma test
doubles and unescaped quote characters in two collection dialog descriptions.

## The fix

- Replaced the explicit `any` casts with typed partial Prisma mocks using narrow
  `unknown` cast boundaries.
- Typed the mocked transaction callback in `game-detail.test.ts`.
- Escaped the JSX quotes without changing the rendered copy.

## Verify

- `pnpm lint` passed with 0 errors and 1 pre-existing warning in `TagsSection.tsx`.
- `pnpm typecheck` passed.
- `pnpm test` passed: 82 tests.
- `pnpm exec next build --webpack` passed.

## Findings

### clear-lint-errors/F-04 [P2] closed - Lint gate fails on test fixtures and JSX text

**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** `pnpm lint` exited with 20 errors. The test fixtures used explicit `any` despite the TypeScript standard forbidding it, and two UI components contained unescaped quote characters rejected by the configured React lint rules.
**Resolution:** Replaced explicit `any` casts with narrow `unknown`-typed Prisma test doubles and escaped the JSX quotes. `pnpm lint` passes with 0 errors (1 pre-existing warning in `TagsSection.tsx`). Closed by `/audit` re-review 2026-08-17 (scope: current). Original defect confirmed gone, no new issue introduced.

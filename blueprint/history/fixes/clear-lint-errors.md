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

# Fix: Guard the exposed `resolveManualSteamAppId` Server Action

**Type:** Fix
**Fixes:** F-03

## The problem

`src/actions/wishlist-identity.ts` exports `resolveManualSteamAppId` from a
`"use server"` file without a `requireUser()` call, so Next.js exposes it as a
POSTable HTTP endpoint. It was the only exported action of 52 across 16 action
files without an auth guard. An anonymous caller could probe arbitrary Steam
AppIDs and receive the name of any conflicting wishlist entry
(`identityConflictMessage` includes `conflict.name`), turning private catalog
data into an oracle.

## The fix

Added `await requireUser()` as the first statement of `resolveManualSteamAppId`,
matching every other exported action in the file. Both in-repo callers
(`src/actions/wishlist.ts:100,179`) already run behind their own guards inside
try blocks, so signed-in behavior is unchanged; only the anonymous HTTP path is
closed. A rejection test pins the guard: when auth fails, the call propagates
the error before any prisma query. Relocating the helper into `src/lib/` was
considered and deferred as a larger refactor.

## Verify

- `pnpm test src/actions/wishlist-identity.test.ts`: 17/17 passed, including
  the new unauthenticated-rejection case.
- `pnpm test` (full suite): 40 files, 405/405 passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed with 0 errors (2 pre-existing warnings tracked as F-10).
- `pnpm build` passed (Next.js production build).

## Findings

### guard-resolve-manual-steam-appid/F-03 [P1] closed - Exported Server Action `resolveManualSteamAppId` runs without an auth guard

**Found:** 2026-08-21 by /audit (scope: full; lens: security)
**Why it matters:** The `"use server"` file exposes every exported async function as a POSTable endpoint. This was the only exported action of 52 across 16 action files without a `requireUser()` call, letting an anonymous caller probe Steam AppIDs and read conflicting wishlist entry names back.
**Resolution:** Guard added as first statement of the action on this fix; rejection test added; all five exports in the file now guarded. Closed by `/audit` re-review 2026-08-21 (scope: current): no new throw path for legitimate flows, full suite green.

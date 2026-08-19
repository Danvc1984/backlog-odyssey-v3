# Fix: Steam validation and test-gate findings

**Type:** Fix

**Fixes:** `F-05`, `F-07`, `F-10`

## The problem

Three open P2 audit findings remained in the Steam and test paths:

- `src/lib/placeholder.test.ts` only asserted arithmetic and provided no product coverage.
- `verifySteamOpenIdResponse` accepted a substring instead of requiring an exact valid OpenID response field.
- `syncSteamPlaytime` attempted to update a `SyncRun` after a transaction rollback, which could throw a second error and hide the original failure.

## The fix

- Replaced the placeholder test with focused `normalizeName` coverage for accented characters and punctuation.
- Replaced OpenID substring matching with exact `is_valid:true` field parsing and added malformed and embedded-field regressions.
- Made failed `SyncRun` recovery best-effort after transaction rollback and added a regression test preserving the original action error.
- Added the missing `tags` dependency to `TagsSection`'s `handleAdd` callback, resolving the ESLint warning.

## Verification

- `pnpm test`: 14 test files, 202 tests passing.
- `pnpm lint`: passed without warnings or errors.
- `pnpm typecheck`: passed.
- `git diff --check`: passed.
- `/audit` re-reviewed the repaired paths and closed all three findings.

## Findings

### steam-validation-test-gate/F-05 [P2] closed - Placeholder test adds no product coverage

**File:** `src/lib/placeholder.test.ts:3-6`
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** The suite reported 82 passing tests, but this file only asserted `1 + 1 === 2`; it could keep the test gate looking populated without protecting application behavior.
**Suggested fix:** Replace it with a focused test for uncovered logic or remove it once meaningful coverage exists.
**Resolution:** Replaced the placeholder with focused `normalizeName` coverage for accented characters and punctuation; audit re-reviewed the changed test set and full suite passed.

### steam-validation-test-gate/F-07 [P2] closed - Steam OpenID validation accepts a substring match

**File:** `src/lib/steam-openid.ts:48-49`
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** Checking `text.includes("is_valid:true")` was weaker than parsing an exact response field and could match that substring inside another field such as `not_is_valid:true`.
**Suggested fix:** Parse response lines/fields and require the exact `is_valid:true` field.
**Resolution:** Replaced substring matching with exact `is_valid:true` field parsing and added false, embedded-field, and malformed-response tests; audit re-reviewed the parser and callback boundary with no regression found.

### steam-validation-test-gate/F-10 [P2] closed - Sync catch block throws on rolled-back transaction

**File:** `src/actions/steam-sync.ts:120-133`
**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** If a DB error aborted mid-transaction, Prisma rolled back the created run, but the catch block still attempted to update it, masking the original error.
**Suggested fix:** Guard catch-block recovery and add a test for a mid-transaction failure.
**Resolution:** Guarded best-effort `SyncRun` recovery so rollback failures preserve the original action error; audit re-reviewed the recovery path and regression test, with the action contract preserved.

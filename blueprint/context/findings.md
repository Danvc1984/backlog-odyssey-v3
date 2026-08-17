# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-04 [P2] open - Lint gate fails on test fixtures and JSX text

**File:** `src/actions/collections.test.ts:23`, `src/actions/game-detail.test.ts:16`, `src/actions/steam.test.ts:17`, `src/lib/system-collections.test.ts:44`, `src/components/games/CollectionDetailActions.tsx:146`, `src/components/games/CreateCollectionDialog.tsx:76`
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** `pnpm lint` exits with 20 errors. The test fixtures use explicit `any` despite the TypeScript standard forbidding it, and two UI components contain unescaped quote characters rejected by the configured React lint rules.
**Suggested fix:** Replace fixture casts with typed Prisma test doubles and escape the rendered quote characters with JSX entities or equivalent text.
**Resolution:**

### F-05 [P2] open - Placeholder test adds no product coverage

**File:** `src/lib/placeholder.test.ts:3-6`
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** The suite reports 82 passing tests, but this file only asserts `1 + 1 === 2`; it can keep the test gate looking populated without protecting any application behavior.
**Suggested fix:** Replace it with a focused test for uncovered logic or remove it once meaningful coverage exists.
**Resolution:**

### F-06 [P2] fixed - Steam sync reads settings before authenticating

**File:** `src/app/api/steam/sync/route.ts:6-20`
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** An unauthenticated POST can cause a database read and learn whether daily Steam sync is disabled before `requireUser()` runs. This violates the project rule that every protected server entry point authenticates before accessing application data and unnecessarily exposes a public resource path.
**Suggested fix:** Call `requireUser()` before the `appSettings` query. Keep any future scheduled-job authentication as a separate explicit mechanism rather than relying on this user route.
**Resolution:** Moved `requireUser()` before the `AppSettings` query in the Steam sync route. `/audit` must re-review before closure.

### F-07 [P2] open - Steam OpenID validation accepts a substring match

**File:** `src/lib/steam-openid.ts:48-49`
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** Checking `text.includes("is_valid:true")` is weaker than parsing an exact response field and can match that substring inside another field such as `not_is_valid:true`. Authentication callback validation should accept only an explicitly valid response.
**Suggested fix:** Parse response lines/fields and require the exact `is_valid:true` field, ideally also validating the returned namespace and claimed identifier against the request.
**Resolution:**

### F-08 [P2] fixed - SyncRun left in RUNNING status if process crashes after transaction

**File:** `src/actions/steam-sync.ts:72-112`
**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** The `syncRun.update()` that sets SUCCESS or PARTIAL (lines 108-112) runs outside the `$transaction` block (lines 72-106). If the process crashes or the update call fails after the transaction commits, the SyncRun row remains in RUNNING status permanently with no recovery path. The SyncRun create (line 48) also sits outside the transaction, so a crash between create and the transaction start leaves an orphaned RUNNING row.
**Suggested fix:** Move the SyncRun status update inside the transaction so the counts and final status commit atomically with the availability updates. Alternatively, add a cleanup query at the start of `syncSteamPlaytime()` that marks any stale RUNNING SyncRuns as FAILED before creating a new one.
**Resolution:** Implemented in `syncSteamPlaytime.ts`: SyncRun creation and terminal status updates now share the availability transaction. `/audit` must re-review before closure.

### F-09 [P3] fixed - Disconnect button not disabled during sync

**File:** `src/components/steam/SteamConnectionCard.tsx:114`
**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** The Disconnect button's `disabled` prop is `submitting || importing` but does not include `syncing`. A user can click Disconnect while a sync is in flight, which could cause the sync's `requireUser()` call or DB writes to fail mid-operation and leave a partial SyncRun.
**Suggested fix:** Add `syncing` to the Disconnect button's disabled condition: `disabled={submitting || importing || syncing}`.
**Resolution:** Added `syncing` to the Disconnect button disabled condition. `/audit` must re-review before closure.

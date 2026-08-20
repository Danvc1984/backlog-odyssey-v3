# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] open - Steam store API details lookup uses unbounded concurrency

**File:** src/lib/steam-api.ts:123
**Found:** 2026-08-20 by /audit (scope: current; lens: performance)
**Why it matters:** In `fetchOwnedGameDetails`, `Promise.all(appids.map(...))` triggers simultaneous outbound HTTP requests to `store.steampowered.com/api/appdetails` for every owned game in the user's library without concurrency bounding. For accounts with hundreds of games, this risks hitting Steam rate limits (HTTP 429), timeouts, or dropped DLC classifications.
**Suggested fix:** Bound concurrency (e.g. using a chunked pool or batch size of 5-10 requests) or throttle requests so large libraries do not flood the Steam Store API concurrently.
**Resolution:**

### F-02 [P3] open - Missing test coverage for happy-path Steam DLC import when base game is present

**File:** src/actions/steam-import.test.ts:190
**Found:** 2026-08-20 by /audit (scope: current; lens: tests)
**Why it matters:** `src/actions/steam-import.test.ts` tests the fallback path where a Steam DLC has no base game and is routed to `UnresolvedSteamDlc`, but does not have a test asserting that a Steam DLC whose base game is present is successfully created as a `Game` with `type: DLC` and attached `baseGameId`.
**Suggested fix:** Add a unit test in `src/actions/steam-import.test.ts` mocking a base game in `externalGameId` and asserting DLC creation with correct relation linking.
**Resolution:**

# Fix: compat-job-runner test coverage and fake-timer hygiene

**Type:** Fix
**Fixes:** F-27, F-28

## The problem

- **F-27** - `src/lib/compat-job-runner.test.ts` has 3 tests covering a 220-line
  runner whose retry state machine is exactly where wrong-answer bugs live.
  Untested branches: attempt exhaustion with a retryable error
  (`job.attempt >= job.maxAttempts` must go terminal FAILED, not RETRY_WAIT),
  non-retryable errors (HTTP 4xx, MALFORMED_RESPONSE) going straight to
  terminal, claim loss (`updateMany` returning `count: 0` must return current
  status and make no provider calls), `PERSISTENCE_FAILED` when the
  persistence transaction throws, and the first-provider-error-wins rule when
  AWAY fails while ProtonDB succeeds. The claim filter's
  `attempt < maxAttempts` and hidden-game guard are also never asserted.
- **F-28** - in `src/actions/recommendations.test.ts`, the cooldown test starts
  fake timers (`vi.useFakeTimers()` + `vi.setSystemTime(...)`) and restores
  them as the last statement of the test (`vi.useRealTimers()`), not in an
  `afterEach`. Any assertion failure before that line leaks frozen timers into
  the rest of the file, turning one failure into cascading confusing
  failures. `src/lib/itad-retry.test.ts` shows the correct `afterEach`
  pattern.

## The fix

- Add the missing branch tests to `src/lib/compat-job-runner.test.ts`,
  mirroring the style of `src/lib/rawg-job-runner.test.ts` (10 tests) and the
  existing fixtures/mocks in that file:
  1. Retryable NETWORK/5xx error at `attempt == maxAttempts` lands terminal
     `FAILED` with the error code, not RETRY_WAIT.
  2. Non-retryable errors (HTTP 404, MALFORMED_RESPONSE) go terminal without
     retry scheduling (`nextAttemptAt: null`).
  3. Claim loss: `updateMany` resolves `count: 0`, result is the current job
     status via `findFirst`, no provider calls, no transaction.
  4. Persistence failure: transaction rejects, result is terminal
     `PERSISTENCE_FAILED`.
  5. AWAY error while ProtonDB succeeds fails the job with the AWAY error
     (first provider error wins) and persists nothing.
  6. Claim where-clause asserts the hidden-game OR guard and
     `attempt: { lt: maxAttempts }`.
- Move the fake-timer restore in `src/actions/recommendations.test.ts` into an
  `afterEach` (matching `src/lib/itad-retry.test.ts:11-13`) for the describe
  block that uses fake timers, removing the trailing
  `vi.useRealTimers()` from the test body. Note: line numbers shifted with
  the F-20/F-21 changes; locate the cooldown test by its name
  ("excludes a candidate exposed within the cooldown window...").

Must not break: the existing three compat tests and all recommendations tests
(mock behaviors unchanged; only timer lifecycle and added coverage change).

## Build steps

1. [x] Add the compat-job-runner branch tests.
   **Done when:** the runner has at least 8 focused tests, every new test
   fails if the corresponding branch is broken (verified by reading the
   assertion targets), and the full suite is green.
2. [x] Fix the timer lifecycle in `src/actions/recommendations.test.ts`.
   **Done when:** `vi.useFakeTimers()` appears only inside tests, restoration
   lives in `afterEach`, and the suite is green.

## Verify

- Automated: `pnpm typecheck`, `pnpm test`, `pnpm lint`.
- Manual: not applicable - pure test additions.

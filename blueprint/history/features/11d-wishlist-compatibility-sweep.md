# Feature: Wishlist compatibility sweep (11d)

**From build-plan:** 11d (under 11. Compatibility synthesis)
**Status:** draft - awaiting review

## Goal

Make wishlist compatibility evidence maintain itself quietly: any wish that
gains a confirmed Steam App ID gets evidence fetched inline and silently, and
one quiet async manual sweep brings every confirmed-identity base-game wish up
to date through a PriceRefresh-style run record with overlap protection and a
completion toast - all separate from the catalog pipeline.

## Design reference

None. Mirrors the shipped `PriceRefreshPanel` interaction (outline button,
spinning label, count summary line under it) on `/wishlist`, and the shipped
detail-page compatibility block. Feature 14 owns the visual pass.

## In scope

- **Schema**: new `WishlistCompatSweep` run-record model modeled on
  `PriceRefresh` (global run, no wishlist-entry FK): single RUNNING-row
  overlap protection, `counts` JSON, `requestedAt`/`finishedAt`. Stored
  evidence tables already exist from 11c-a - do not touch them.
- **Sweep engine** (`src/lib/wishlist-compat-sweep.ts`): abandoned-run
  recovery (15 minutes), eligibility selection (BASE_GAME +
  `steamAppId` and `steamAppIdProvenance` both set - the same
  "confirmed identity" rule prices use), staleness filter against the single
  180-day window (evidence absent or oldest-passed means refresh; fresh
  evidence counts as up-to-date and is not re-fetched), sequential per-entry
  refresh reusing `runWishlistCompatibilityRefresh`, counts/status finalize
  with SUCCESS/PARTIAL/FAILED mapping like prices.
- **Manual sweep UI**: server actions to start the sweep (awaits the whole
  persisted run; overlapping starts are refused like Update prices) and to
  load the latest run; a quiet `WishlistCompatSweepPanel` next to
  `PriceRefreshPanel` in the `/wishlist` header: immediate
  "Compatibility sweep started" confirmation, completion toast, count
  summary line, `router.refresh()`.
- **Silent auto-trigger**: a tiny helper that calls the existing per-entry
  runner inside try/catch and swallows everything, wired into every place a
  wish's Steam identity becomes confirmed:
  `src/actions/wishlist.ts` (create with identity; update setting identity),
  `src/actions/wishlist-identity.ts` (manual save; RAWG suggestion confirm),
  `src/actions/steam-import-wishlist.ts` (STEAM_IMPORT creations),
  `src/actions/wishlist-import-review.ts` (link and create),
  `src/actions/unresolved-dlc.ts` (create). Identity clears trigger nothing.
- **Detail-page note**: "Compatibility details not found." already ships from
  11c-c and must remain correct after this feature (verify-only; covered by
  done-whens).

## Out of scope

- Personal overrides (none on wishlist, by standing decision) and any catalog
  pipeline change (`EnrichmentJob`, `CompatibilitySnapshot`, override flow).
- Placement in Settings' provider controls - feature 17 decides whether the
  wishlist sweep joins the catalog sweep there.
- Cron automation of the sweep (18 owns scheduling era decisions); the
  auto-trigger here is inline by design.
- Per-entry run records/diagnostics; the run record is global with counts.
- Recommendation behavior change - feature 12 reads this evidence
  warning-only later.
- Cleanup of stored snapshots when identity is cleared.

## Build steps

- [x] **Step 1 - Schema and migration** - Add `WishlistCompatSweep`
      (`id` cuid, `status` `SyncStatus`, `counts Json?`, `requestedAt`
      default now, `finishedAt`) to `prisma/schema.prisma` with index
      `[status, requestedAt]`; hand-edit a migration adding the partial
      unique index
      `CREATE UNIQUE INDEX "WishlistCompatSweep_single_running" ... WHERE "status" = 'RUNNING'`,
      mirroring `20260821221000_price_refresh_running_guard`. Done when:
      `pnpm prisma:migrate` applies cleanly and `prisma generate` exposes
      `wishlistCompatSweep` without touching existing models.
- [x] **Step 2 - Selection and mapping logic** - Export
      `WISHLIST_COMPAT_FRESHNESS_DAYS = 180` from
      `src/lib/wishlist-compatibility.ts`; in the new sweep lib add pure
      functions: entry classification given
      `{ id, createdAt }` + latest snapshot `fetchedAt`s into
      `refresh | upToDate` (absent evidence always refreshes),
      `WishlistCompatSweepCounts { total, refreshed, upToDate, failed }`,
      and `sweepStatusFromCounts` (no successful attempt with attempts > 0 ->
      FAILED; any failure -> PARTIAL; otherwise SUCCESS). Done when
      unit tests cover DLC/no-evidence-here/stale-boundary/fresh cases and
      each status branch.
- [x] **Step 3 - Sweep orchestration** - Implement start/run/finalize:
      recover RUNNING runs older than 15 minutes as FAILED; load
      confirmed-identity BASE_GAME wishes ordered by `createdAt`; insert the
      RUNNING row (catch P2002 -> return `already-running` with the active
      id, mirroring `startPriceRefresh`); sequentially call
      `runWishlistCompatibilityRefresh` counting refreshed/failed; write
      final status + counts + `finishedAt`. Start/end helpers live in
      `src/lib/wishlist-compat-sweep.ts`, `server-only`. Done when tests
      with mocked prisma prove overlap refusal, abandoned recovery,
      zero-eligible SUCCESS, per-entry failure isolation into `failed`, and
      counts JSON matches the contract below.
- [x] **Step 4 - Sweep action and header panel** - Add
      `startWishlistCompatibilitySweep()` (+ latest-run loader mirroring the
      prices page's `latestRun` pattern) to
      `src/actions/wishlist-compatibility.ts` with Zod-free thin input and
      action-result shape `{ success, data, error }`. Create
      `src/components/wishlist/WishlistCompatSweepPanel.tsx` mirrored on
      `PriceRefreshPanel`: outline sm button reading "Update compatibility",
      spinning label while running, immediate info toast
      "Compatibility sweep started", success toast
      "Compatibility sweep finished" with counts, `router.refresh()`; muted
      summary line `{refreshed} refreshed · {upToDate} up to date · {failed}
      failed · {finished}` when a run exists, reading counts through a
      defensive fallback object like `PriceRefreshPanel.readCounts` so
      malformed JSON never breaks the page; before any run exists the panel
      renders just the button and no summary line. Mount beside
      `PriceRefreshPanel` in `/wishlist`'s header. Done when build passes
      and starting from the header updates the button state, refuses a
      second concurrent start, and reflects finished counts.
- [x] **Step 5 - Silent trigger for interactive identity paths** - Add
      `silentlyRefreshWishlistCompatibility(wishlistEntryId)` to
      `src/lib/wishlist-compatibility-runner.ts` (try/catch swallow, returns
      void). Wire into: `updateWishlistIdentity` and the RAWG suggestion
      confirm in `src/actions/wishlist-identity.ts`;
      `createWishlist`/`updateWishlist` identity-setting branches in
      `src/actions/wishlist.ts`. Fire only when both identity fields end
      set and `type === "BASE_GAME"`; never await-toast. Done when mocked
      tests assert one silent call on confirm/save/create and none on clear
      (null identity), and provider errors don't fail the enclosing action.
- [x] **Step 6 - Silent trigger for import-created wishes** - Same helper in
      `src/actions/steam-import-wishlist.ts` (new base-game STEAM_IMPORT
      creations), `src/actions/wishlist-import-review.ts` (link target and
      created wish), `src/actions/unresolved-dlc.ts` (created wish);
      sequential per entry, failures swallowed so import summaries stay
      truthful. Done when mocked tests show silent calls for each creation
      path of eligible wishes and no call for DLC wishes or missing ids.
- [x] **Step 7 - Gate and detail-page verification** - Run `pnpm test`,
      `pnpm typecheck`, `pnpm lint`, `pnpm build`; walk the detail page to
      confirm an eligible wish whose providers all fail keeps previous
      evidence or shows "Compatibility details not found.", stale evidence
      still displays its age, and the header summary renders after a real
      sweep. Done when all checks pass with the note verified.

## Files

- New: `src/lib/wishlist-compat-sweep.ts` + test
- New: `src/components/wishlist/WishlistCompatSweepPanel.tsx`
- Edited: `prisma/schema.prisma` + new migration
- Edited: `src/lib/wishlist-compatibility.ts` (freshness constant export)
- Edited: `src/lib/wishlist-compatibility-runner.ts` (silent helper + test)
- Edited: `src/actions/wishlist-compatibility.ts` (+ tests) for sweep actions
- Edited: `src/app/(app)/wishlist/page.tsx` (panel mount + latest run query)
- Edited (auto-trigger wiring only): `src/actions/wishlist.ts`,
  `src/actions/wishlist-identity.ts`, `src/actions/steam-import-wishlist.ts`,
  `src/actions/wishlist-import-review.ts`, `src/actions/unresolved-dlc.ts`
  (+ test assertions each)
- Untouched: evidence tables, catalog compat code, edit dialogs, detail-page
  block except no behavioral change

## Data / contracts

Load-bearing - features 12, 13, 17, and 18 read these shapes; lock now.

- `WishlistCompatSweep.counts` JSON keys: `{ total, refreshed, upToDate,
  failed }` where `total = refreshed + upToDate + failed`. DLC wishes and
  unconfirmed-identity wishes appear nowhere (quiet by design).
- Overlap: at most one RUNNING row enforced by partial unique index
  `WishlistCompatSweep_single_running`; abandoned (15 min) recovered as
  FAILED before claiming; claim mirrors `startPriceRefresh` P2002 handling.
- Status mapping identical in spirit to `refreshStatusFromCounts`:
  FAILED if attempts>0 && refreshed===0; PARTIAL if failed>0; else SUCCESS;
  zero attempted-but-needed entries -> SUCCESS with zeros.
- Action results: `startWishlistCompatibilitySweep()` ->
  `{ success: true, data: { runId }, error: null }` or
  `{ success: false, data: { runId } | null, error }` with
  `already-running` surfaced through data like prices do.
- Eligibility reuses `getWishlistCompatibilityEligibility` semantics:
  confirmed identity = `steamAppId` AND `steamAppIdProvenance` set.
- Staleness: an entry is up-to-date iff at least one
  `WishlistCompatibilitySnapshot` row has `fetchedAt` within 180 days;
  otherwise the sweep attempts a full refresh (both providers) via the
  existing runner.

## Testing

Vitest (unit gate is on): selection/classification and status-mapping pure
tests (step 2); orchestration with mocked prisma/runner covering overlap,
recovery, isolation, contract shape (steps 3-4); trigger assertions per
identity path including negative cases (steps 5-6). UI rides on `pnpm build`
plus the step 7 walkthrough; no Playwright (project constraint).

## Notes for the AI

- Reuse `runWishlistCompatibilityRefresh` everywhere; do not reimplement
  fetching/persistence.
- Follow the codebase exactly for established patterns: action result
  shapes, Zod parsing, `"server-only"`, `Prisma.InputJsonValue` casts,
  `Prisma.JsonNull` handling, and existing Vitest mocking style.
- Sequential provider calls inside the sweep (no parallel bursts across
  entries); the two providers stay parallel within one entry as today.
- The shipped per-entry detail-page refresh button stays - it is part of
  checked-off 11c-c; do not remove it despite older memory notes saying no
  per-entry button existed pre-11d.
- Auto-trigger latency is accepted deliberately (plain inline calls per
  standing decisions); if a multi-item Steam import feels slow, surface it -
  do not queue silently in this feature.
- Keep diffs minimal; no drive-by refactors, no comments unless asked.

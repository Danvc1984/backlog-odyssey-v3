# Feature: 10b-b - ITAD prices and refresh queue

**From build-plan:** 10b-b (second sub-feature of 10b, Price enrichment and purchase opportunities)
**Status:** complete

## Goal

Let one global `Update prices` action pull real Mexican offers for every
wishlist entry with a confirmed Steam identity: resolve App IDs to ITAD game
IDs through a cached batched lookup, fetch batched `country=MX` prices,
normalize the deals into `DealOffer` rows, and report exactly what happened
(refreshed, failed, identity-required) in a persistent run record. Prices stay
manual until feature 18 wires Vercel Cron.

## Design reference

None. Adds a header action and result panel to the existing Wishlist page;
no new visual design.

## In scope

- `ITAD_API_KEY` server-only environment wiring with a clear configuration
  error when absent.
- New `ItadIdentity` cache model (Steam App ID -> ITAD game UUID) so lookups
  happen once per game, not once per refresh.
- Batched ITAD integration, validated against the live documented API:
  - Lookup: `POST /lookup/id/shop/61/v1` (shop 61 is Steam) with bodies like
    `["app/620", ...]`; response maps each `"app/<id>"` to a UUID or null.
  - Prices: `POST /games/prices/v3?country=MX` with up to 200
    ITAD UUIDs per request; the `deals` filter is intentionally NOT set so
    full-price games still return their current price (per user decision
    during this spec); per-game `historyLow.all` plus `deals[]`
    (shop id/name, price, regular, cut, voucher, storeLow, flag, drm[],
    platforms[], timestamp, expiry, url).
  - Rate limiting: honor `429` + `Retry-After`; window-based limits make
    caching mandatory, which the identity cache provides.
- Global `Update prices` action on the Wishlist header: creates a persistent
  `PriceRefresh` run with overlap protection (one RUNNING run at a time),
  processes every entry holding `steamAppId + steamAppIdProvenance`,
  replaces each entry's `DealOffer` rows with the freshly fetched set, and
  finishes with counts plus SUCCESS / PARTIAL / FAILED.
- Bounded retries: at most three attempts per ITAD call with increasing
  delay, honoring `Retry-After`.
- Abandoned-run recovery: a RUNNING run older than 15 minutes with no
  progress is treated as crashed and no longer blocks new runs.
- Result reporting: refreshed, not-found, no-offers, failed, and
  identity-required buckets persisted in `PriceRefresh.counts`; a persistent
  result summary on the Wishlist page plus a last-refreshed indicator; ITAD
  attribution link.
- A new `itadFlag` column on `DealOffer` storing ITAD's raw deal `flag`
  string so 10b-c can implement keyshop/MX activation warnings without
  refetching.

## Out of scope

- Cheapest-valid-offer selection, 8-10 trimming, alternatives view, MX
  keyshop warnings, targets, badges, stale rules (10b-c).
- Any automatic scheduling; Vercel Cron activation is feature 18.
- Starting or replacing recommendation runs; price refresh never touches them.
- Individual per-entry price refresh buttons.
- Historical-low semantics beyond persisting the value; display-only rules
  are 10b-c's.
- Steam-side pricing data; ITAD only in this feature.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Configuration and schema** - read `ITAD_API_KEY` through a
  server-only config helper mirroring the RAWG pattern; add the `ItadIdentity`
  model (`steamAppId` unique, `itadId`, `fetchedAt`) and the nullable
  `itadFlag` column on `DealOffer`; add a partial unique index enforcing at
  most one `PriceRefresh` row with `status = 'RUNNING'`; migrate and generate.
  *Done when:* migrations apply cleanly, `pnpm typecheck` passes, and a test
  asserts the config helper reports a clear error without the key.
- [x] **Step 2 - ITAD API client** - `src/lib/itad-api.ts`: batched lookup by
  Steam App IDs (`app/<id>` bodies against shop 61) returning a
  Map<appId, uuid | null>; batched prices (chunks of at most 200 UUIDs,
  `country=MX`, no deals filter so full-price games are included) returning
  normalized per-game results
  (history low, deals with shop/price/regular/cut/voucher/storeLow/flag/
  drm/platforms/timestamp/expiry/url); tolerant parsing that skips malformed
  deals instead of failing the batch; injectable `fetchFn`.
  *Done when:* unit tests cover both endpoints' happy paths, chunk splitting
  across >200 inputs, malformed-deal skipping, and non-null handling.
- [x] **Step 3 - Retry and rate-limit wrapper** - shared request wrapper used
  by the client: retries transient failures at most three times with
  increasing delay, honors `Retry-After` on 429, treats repeated failure as
  a typed provider error.
  *Done when:* fake-timer tests prove attempt counts, delay growth, and that
  a 429 waits for `Retry-After` rather than the default backoff.
- [x] **Step 4 - Identity cache service** - `resolveItadIds(appIds)` reads
  cached rows, batches uncached App IDs through the Step 2 lookup, writes
  resolved IDs (and remembers nulls so unknown games are not re-queried every
  run), and returns the full map.
  *Done when:* contract tests cover cache hits avoiding network calls,
  miss batching, null caching, and concurrent-safe upserts.
- [x] **Step 5a - Run lifecycle** - `src/lib/price-refresh.ts` part one:
  `startPriceRefresh()` claims the run atomically via the unique RUNNING
  guard (refuses with the active run when one exists), recovers abandoned
  runs older than 15 minutes first, snapshots the eligible entry set
  (confirmed identity only), initializes counts, and has a `finalize` helper
  writing `SyncStatus` (SUCCESS when nothing failed, FAILED when nothing
  succeeded, PARTIAL otherwise) plus the counts JSON.
  *Done when:* mocked tests cover claim-and-run, overlap refusal returning
  the active run, abandoned-run recovery unblocking a new run, and status
  selection for SUCCESS / PARTIAL / FAILED including the zero-eligible
  wishlist finishing as SUCCESS with all-zero counts.
- [x] **Step 5b - Entry processing and persistence** - `src/lib/`
  `price-refresh.ts` part two: resolve identities through Step 4, fetch
  prices in chunks through Steps 2-3, classify each entry as refreshed /
  notFound / noOffers / failed / identityRequired, and per refreshed entry
  replace `DealOffer` rows delete-and-recreate inside a transaction using
  the contract mapping below; entries failing mid-run never roll back
  already-persisted entries.
  *Done when:* mocked-client tests cover the full happy path, every outcome
  bucket appearing in one mixed run, per-entry replacement removing old
  offers, and a failed chunk leaving earlier entries persisted.
- [x] **Step 6 - Server actions** - `src/actions/prices.ts`:
  `updatePrices()` (requires user, delegates to the engine, returns the run
  summary) and `getLatestPriceRefresh()` (run status, counts, finishedAt)
  for polling. Neither ever starts or modifies a recommendation run.
  *Done when:* contract tests cover auth enforcement, Zod rejection, the
  overlap-refusal surface, and the latest-run reader.
- [x] **Step 7 - Wishlist UI** - header button next to the existing actions:
  click starts a run and polls until terminal; persistent result summary
  shows refreshed / not found / no offers / failed / identity-required
  counts with a last-refreshed timestamp; disabled state while RUNNING; ITAD
  attribution link ("prices via IsThereAnyDeal") near the summary.
  *Done when:* in the running app, clicking `Update prices` with a mix of
  identified and unidentified wishes ends in the correct counts; double
  clicks cannot create two runs; build passes and the flow is captured in a
  screenshot.
- [x] **Step 8 - Boundary verification** - confirm no recommendation run is
  created by any price path (grep plus a regression assertion in the action
  tests), confirm offers written in Step 5 carry `fetchedAt` and survive a
  page reload, and record the deliberate 10b-c boundary (full deal sets are
  persisted here; cheapest-selection and trimming come later).
  *Done when:* regression tests pass and the boundary note appears in this
  spec's Data/contracts section.

## Files / areas

- `.env` / env handling - `ITAD_API_KEY` (server-only).
- `prisma/schema.prisma` + migrations - `ItadIdentity`, `DealOffer.itadFlag`,
  RUNNING uniqueness guard.
- `src/lib/itad-config.ts` (new) - key presence/validation helper.
- `src/lib/itad-api.ts` (new) - Steps 2-3 client.
- `src/lib/itad-identity.ts` (new) - Step 4 cache service.
- `src/lib/price-refresh.ts` (new) - Steps 5a-5b engine.
- `src/actions/prices.ts` (new) - Step 6 actions.
- `src/app/(app)/wishlist/page.tsx` + `src/components/wishlist/*` - Step 7 UI.

## Data / contracts

- `ItadIdentity`: `steamAppId String @unique`, `itadId String`, `fetchedAt`.
  Null lookups are cached as a sentinel row (`itadId = ""` means "ITAD has
  no such game") so unknowns are not re-queried every run.
  **Load-bearing:** 12 (recommendations) never queries this directly; only
  the price pipeline uses it.
- `DealOffer.itadFlag String?` - raw ITAD deal `flag` value.
  **Load-bearing:** 10b-c derives MX keyshop activation warnings from this
  plus the shop identity; values observed today are null or short codes
  (e.g. "H"), so the column stores whatever arrives verbatim.
- `PriceRefresh.counts` JSON shape:
  `{ total, refreshed, notFound, noOffers, failed, identityRequired }`.
  `notFound` means ITAD has no game for the App ID; `noOffers` means the
  game is known but returned zero deals. The selected entry set is
  snapshotted at claim time; entries added mid-run wait for the next run.
- `DealOffer` mapping from ITAD deals: `shop` = ITAD shop name,
  `price`/`regularPrice` = amounts, `discount` = `cut`, `voucher`,
  `drm` = DRM names joined, `platforms` = platforms JSON, `url`,
  `expiresAt` = `expiry`, `historicalLow` = `historyLow.all.amount`,
  `fetchedAt` = refresh time (freshness anchor), `itadFlag` = `flag`.
  **Boundary note:** this feature persists the full returned deal set per
  entry (replace-all). Validity filtering, cheapest 8-10 trimming,
  alternatives presentation, warnings, and badges are 10b-c and will read
  these rows without refetching.
- Freshness: an offer is fresh when `fetchedAt` is within 48 hours;
  staleness computation itself lands in 10b-c, but `fetchedAt` is written
  here and its meaning is fixed now.
- Overlap protection: at most one RUNNING `PriceRefresh`; enforced by a
  partial unique index plus the atomic claim, with 15-minute abandoned-run
  recovery.

## Testing

Vitest is configured and gated. In-scope logic that ships with tests:

- Config helper error path (Step 1).
- Client parsing, chunking, malformed-deal tolerance (Step 2).
- Retry/backoff/Retry-After timing with fake timers (Step 3).
- Cache hit/miss/null-caching behavior (Step 4).
- Run lifecycle: claim, overlap, recovery, finalization (Step 5a).
- Entry processing: buckets, replacement, partial-failure isolation (Step 5b).
- Action contracts incl. auth and overlap surface (Step 6).
- No-recommendation-run regression (Step 8).

UI (Step 7) rides on the dev-server walkthrough plus build evidence, per the
browser-verification convention.

## Notes for the AI

- Server-only for all Prisma, env, and ITAD access; actions use `"use server"`
  + `requireUser()`.
- Follow the `{ success, data, error }` action shape and Zod `.strict()`
  schemas used across `src/actions/`.
- Never put `ITAD_API_KEY` into client bundles or logs; the config helper is
  imported only by server modules.
- Respect ITAD's terms: private-use contact is an accepted project caveat;
  include the attribution link in the UI; do not modify returned data beyond
  normalizing into our columns; keep affiliate URLs untouched (`itad.link`
  redirects pass through verbatim).
- The 200-item cap applies to both the lookup and prices request bodies;
  chunk helpers belong in the client, not the callers.
- No em dashes anywhere in code, comments, or docs.

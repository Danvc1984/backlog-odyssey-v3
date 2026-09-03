# Fix: wishlist detail payload, batch polling, and sweep concurrency trims

**Type:** Fix
**Fixes:** F-24, F-25, F-26

## The problem

Three performance findings on provider-work surfaces:

- **F-24** - `src/app/(app)/wishlist/[id]/page.tsx:270` passed the whole RAWG snapshot payload into the `WishlistIdentity` client component, which only reads `storeLink` and `storeLinkDismissedAt.
- **F-25** - while a batch runs, both panels polled every 2s doing GET then POST, and the RAWG side rescanned pending follow-up batches on every status read.
- **F-26** - `processWishlistCompatSweepEntries` refreshed entries strictly serially, unlike the batch runners' capped concurrency.

## The fix

- **F-24:** extract `{ storeLink, storeLinkDismissedAt }` server-side and pass only that view plus `fetchedAt` to `WishlistIdentity`; retain raw-payload parsing for the identity actions.
- **F-25:** rescan RAWG follow-ups only for terminal views, and make both panels POST-only while the last-known batch status is `RUNNING`.
- **F-26:** process wishlist compatibility refreshes in chunks of five with `Promise.all`, preserving per-entry failure isolation and counts.

Must not break identity suggestion/dismiss semantics, identity actions, panel terminal handling and refresh, follow-up display, sweep counts, or existing P2002 protection.

## Build steps

1. F-24 extraction: helper, reshaped input, page/component update, and tests. **Done.**
2. F-25 rescan gate and panel polling changes, with runner tests. **Done.**
3. F-26 chunked concurrency, with sweep tests. **Done.**

## Verify

- `pnpm typecheck` passed.
- `pnpm test` passed: 98 files, 1017 tests.
- `pnpm lint` passed with five pre-existing warnings and no errors.
- `pnpm build` passed with Next.js/Turbopack compilation, TypeScript, and 13 generated pages.
- Manual `/wishlist` and `/wishlist/cmtaqfuof01hw6qzt2r0j43xv` checks rendered the wishlist and a RAWG-backed identity detail without console errors. Batch execution was not triggered because it would start provider work and mutate local run state.

## Findings

No findings in `blueprint/context/findings.md` were at `closed`, `accepted`, or `invalid` status at completion time. The remaining open findings stay in the ledger for later review.

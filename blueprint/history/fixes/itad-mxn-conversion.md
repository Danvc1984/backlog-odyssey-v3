# ITAD MXN conversion

**Type:** Fix

## The problem

ITAD price refreshes requested Mexico but returned many offers in their source
currency, commonly USD. Wishlist prices, cheapest-offer selection, and MXN
target comparisons therefore could not consistently use a local-currency
representation.

## The fix

- Fetch one current USD-to-MXN rate per global price refresh from the
  server-side Frankfurter endpoint.
- Store converted MXN values while retaining each ITAD offer's original
  currency and amounts, the applied rate, and its timestamp.
- Use converted MXN values for offer selection, target comparisons, opportunity
  badges, and visible primary/alternative prices.
- Keep native Steam MXN prices unchanged.
- Preserve source-currency offers and show a refresh warning when the rate
  provider is unavailable or returns invalid data.

## Verification

- `pnpm test`: 51 test files, 482 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `pnpm prisma migrate status`: database schema up to date.
- `git diff --check`: passed.
- Manual Wishlist refresh completed with 245 refreshed entries and 8 without
  offers. A real offer displayed `MXN 595.36` with `Source: USD 35.17`; the
  database retained the source value, rate `16.9282`, and fetch timestamp.

The existing unverified P3 performance finding remains in
`blueprint/context/findings.md` for later measurement.

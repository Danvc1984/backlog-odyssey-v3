# Feature: 10b-c - Offer display and opportunity badges

**From build-plan:** feature 10b-c
**Status:** not started

## Goal

Show price offers on wishlist cards so the user can see the cheapest deal,
browse alternatives, spot keyshop activation warnings, compare against their
target price, and get an opportunity badge when a deal meets or beats that
target. All data comes from existing `DealOffer` rows persisted by 10b-b;
no new provider calls or schema changes are needed.

## In scope

- Include `offers` in the wishlist page Prisma query
- Cheapest-offer selection logic (lowest valid `price`, fresh within 48 hours)
- Persist the cheapest 8-10 offers per entry; selected = cheapest
- Expandable alternatives view showing the remaining offers
- MX keyshop activation warning derived from `itadFlag`
- Display-only historical low from `DealOffer.historicalLow`
- Inline MXN target comparison using `WishlistEntry.targetPriceMxn`
- Opportunity badge when a fresh offer's price is at or below `targetPriceMxn`
- Stale-offer rules: an offer with `fetchedAt` older than 48 hours is visible
  but cannot create an opportunity badge or contribute offer-quality points
- Unit tests for the offer-selection and badge logic

## Out of scope

- Recommendation runs (opportunity badges never trigger a run)
- Individual per-entry price refresh (global refresh only, from 10b-b)
- Vercel Cron activation (deferred to feature 18)
- Any schema or migration changes
- Sorting or filtering wishlist entries by price/discount (a future enhancement)
- Today dashboard offer display (deferred to feature 13)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Offer selection and badge logic** - Create `src/lib/offer-selection.ts` with pure functions: `selectCheapestOffers(allOffers, now)` returns `{ selected, alternatives, isStale }` where `selected` is the cheapest valid fresh offer (or cheapest stale if no fresh exists), `alternatives` is the remaining offers trimmed to a max of 9 (so total is 8-10), and `isStale` flags whether the selected offer's `fetchedAt` is older than 48 hours. An offer is **valid** when `price` is not null (zero is valid, meaning free) and `expiresAt` is either null or in the future. An offer is **fresh** when `fetchedAt` is not null and is within 48 hours of `now`; null `fetchedAt` is treated as stale. Create `src/lib/opportunity-badge.ts` with `evaluateOpportunityBadge(selectedOffer, targetPriceMxn, isStale)` returning `{ hasBadge: boolean, reason?: string }` - a badge appears only when the offer is fresh, has a valid price, and the price is at or below the target. Write unit tests for both modules covering: fresh vs stale boundary, null/missing price, zero price (free), expired offer, null `fetchedAt`, null target, price exactly at target, price below target, price above target, empty offers array, all-stale offers, all-expired offers, keyshop flag detection. *Done when:* `pnpm test` passes with coverage of all listed edge cases.

- [x] **Step 2 - Server data query and type** - Update the wishlist page query in `src/app/(app)/wishlist/page.tsx` to include `offers` on each `WishlistEntry` (ordered by `price asc` with nulls last). Create `src/types/wishlist-offers.ts` with the `WishlistOfferView` type that the card component will consume: `{ shop, price, regularPrice, discount, historicalLow, url, itadFlag, drm, fetchedAt, isKeyshop }`. Add a server-side helper `buildEntryOfferView(offers, targetPriceMxn, now)` in `src/lib/offer-selection.ts` that calls `selectCheapestOffers` and `evaluateOpportunityBadge` and returns the shaped view object. Update `WishlistCardProps` to accept the offer view. *Done when:* the page query includes offers, the type is defined, and `pnpm typecheck` passes.

- [x] **Repair - Preserve and validate offer currency** - Preserve `DealOffer.currency` in `WishlistOfferView` and the card view. Display the actual currency returned by ITAD instead of labeling every amount as MXN. Update selection so offers in different currencies are never compared directly: prefer valid MXN offers when present, otherwise select within one currency group and expose the actual currency. Opportunity badges and target comparisons are allowed only for MXN offers. Add unit tests for MXN, non-MXN, and mixed-currency offers. *Done when:* a non-MXN offer cannot render as MXN, mixed currencies are not numerically ranked against each other, and non-MXN offers cannot create an opportunity badge; `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

- [x] **Step 3 - Offer display on WishlistCard** - Add an offer section to `WishlistCard.tsx` below the identity block. When offers exist: show the selected offer's shop name, current price in its returned currency, discount percentage badge (if > 0), and a "from <currency> X" regular price when different. Show the historical low as muted text below (display-only). When `targetPriceMxn` is set on an MXN offer, show "Target: MXN X" inline and render an opportunity badge (magenta pill with a tag/flag icon) when the badge logic returns true. When the selected offer is stale, show a muted "price may be outdated" note. When no offers exist and the entry has confirmed identity, show "No offers available". When the entry has no identity, show nothing (the identity component already handles that). *Done when:* a card with offers shows: shop name, actual currency and price, discount badge, regular price (if different), historical low, MXN target comparison when applicable, opportunity badge when triggered, and stale note when stale. A card with confirmed identity but no offers shows "No offers available". A card with no identity shows no offer section. `pnpm typecheck` and `pnpm build` pass.

- [x] **Step 4 - Expandable alternatives view** - Add a collapsible "More offers" section to `WishlistCard.tsx` using a client sub-component `WishlistOfferAlternatives`. It shows a count like "+3 more offers" as a clickable toggle. When expanded, it lists each alternative offer with shop name, price, discount, and a keyshop warning icon when `itadFlag` indicates a keyshop. Each offer's shop name links to its `url` (external, opens in new tab). The keyshop warning uses amber styling and a short tooltip-style label: "Keyshop - activation not guaranteed in Mexico". *Done when:* expanding shows the alternative offers with shop, price, keyshop warnings, and links; collapsing hides them; `pnpm typecheck` and `pnpm build` pass.

- [x] **Step 5 - Keyshop activation warning** - In the offer display (both selected and alternatives), detect keyshop offers via `itadFlag` (the ITAD flag value `"H"` indicates a keyshop). Show an amber warning badge next to the price: "Keyshop - activation not guaranteed in Mexico". This applies to both the selected offer and alternatives. If the cheapest offer is a keyshop, still select it (cheapest wins) but show the warning prominently. *Done when:* keyshop offers display the amber warning in both selected and alternative positions; non-keyshop offers show no warning; `pnpm typecheck` and `pnpm build` pass.

## Files / areas

- `src/lib/offer-selection.ts` - new, pure offer-selection logic
- `src/lib/opportunity-badge.ts` - new, badge evaluation logic
- `src/lib/offer-selection.test.ts` - new, unit tests
- `src/lib/opportunity-badge.test.ts` - new, unit tests
- `src/types/wishlist-offers.ts` - new, view types
- `src/app/(app)/wishlist/page.tsx` - update query to include offers
- `src/components/wishlist/WishlistCard.tsx` - add offer display section
- `src/components/wishlist/WishlistOfferAlternatives.tsx` - new, collapsible alternatives

## Data / contracts

- `DealOffer` model (existing, no changes): `shop`, `price`, `regularPrice`, `discount`, `historicalLow`, `itadFlag`, `drm`, `url`, `fetchedAt`, `expiresAt`
- `WishlistEntry.targetPriceMxn` (existing, no changes): `Decimal(10,2)`, nullable
- `WishlistOfferView` (new type): the shaped data the card consumes
- Offer validity: `price` is not null (zero is valid), `expiresAt` is null or in the future
- Offer freshness: `fetchedAt` is not null and within 48 hours of `now`; null `fetchedAt` is stale
- The 48-hour freshness boundary is derived from `fetchedAt` vs `now` - no stored flag
- Keyshop detection: `itadFlag === "H"` (ITAD keyshop indicator)

## Testing

- **Step 1:** Unit tests for `selectCheapestOffers` and `evaluateOpportunityBadge` covering all edge cases listed in the step description. These are pure logic functions with assertable inputs/outputs.
- **Steps 2-5:** UI and integration steps verified by `pnpm typecheck`, `pnpm build`, and manual browser evidence (wishlist page shows offers, badges, alternatives, keyshop warnings).

## Notes for the AI

- Server components by default; `WishlistOfferAlternatives` needs `'use client'` for the expand/collapse toggle.
- The `DealOffer.price` field is `Decimal(10,2)` from Prisma. Convert to `Number` for display and comparison, or compare as Decimal. The existing `dealToRow` in `price-refresh.ts` uses `Prisma.Decimal`.
- The `itadFlag` value `"H"` is the ITAD keyshop indicator. Validate this assumption during implementation by checking ITAD docs or the existing data.
- The 48-hour freshness window matches the project-overview rule: "An offer older than 48 hours is stale: visible, but unable to create a strong signal or offer-quality points."
- Historical lows are display-only and never affect ranking or badge logic.
- Opportunity badges never start recommendation runs (explicit project decision).
- Follow existing card styling: `rounded-lg border border-border bg-card`, Tailwind classes, shadcn/ui `Button` for interactive elements.
- The `WishlistCard` currently receives entry data without offers. The props interface needs extending, not replacing.
- No em dashes in any generated content.

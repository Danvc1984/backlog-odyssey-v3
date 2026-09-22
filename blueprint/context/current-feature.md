# Feature: Regional price preferences and presentation

**From build-plan:** feature 34a
**Build attempt:** 1
**Branch:** `feature/regional-price-preferences-and-presentation`

## Goal

Let the owner choose one supported ITAD market and one supported display currency in Welcome and Settings. Price refreshes use the selected market, while Frankfurter v2 supplies optional, clearly estimated display conversions without changing the provider price or offer-selection semantics.

## In scope

- Supported markets: Mexico (`MX`), United States (`US`), Canada (`CA`), Brazil (`BR`), Colombia (`CO`), and Argentina (`AR`).
- Supported display currencies: `MXN`, `USD`, `CAD`, `BRL`, `COP`, and `ARS`.
- Validated persisted market and display-currency preferences, including safe defaults for existing settings.
- Welcome selection, Settings editing, and a warning that changing either preference requires a manual price refresh before offers use it.
- Selected-market ITAD and direct Steam Store price requests, regional activation warnings, source-price retention, Frankfurter v2 display conversion, and clear unavailable-conversion behavior.
- Currency-safe offer selection and presentation that keep ITAD source amounts authoritative and label converted values as estimates.

## Out of scope

- Markets or display currencies outside the six supported values, fallback markets, automatic refresh after a preference change, purchasing, and notifications.
- Steam OpenID connect/skip behavior in Welcome (feature 34b).
- A target-price model migration. Existing `targetPriceMxn` and its MXN-only opportunity behavior remain unchanged; no target or badge is inferred from a display conversion.
- Historical FX rates, user-configurable FX providers, or changing the existing ITAD identity-resolution flow.

## Build loop

- Work on `feature/regional-price-preferences-and-presentation`.
- Implement and review one checked step at a time. Run focused Vitest coverage with each logic-bearing step, then `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` before requesting completion.
- No checkpoint commit is planned. `/complete` owns the final commit.

## Build steps

- [ ] **Step 1 - Define and persist supported price preferences.** Add one shared, typed market/currency catalogue with the six allowed country and currency codes. Extend `AppSettings` and exported/imported settings with the display currency, retain `MX` and `MXN` defaults for existing owners, and validate preference updates server-side after `requireUser()`.
  - **Done when:** Invalid country/currency input cannot persist, existing settings resolve to `MX`/`MXN`, valid preferences survive the Prisma migration and export/import validation, and focused tests pass.

- [ ] **Step 2 - Make refreshes market-aware and preserve source truth.** Load the saved preferences when starting a refresh, record the selected market on the refresh and offer rows, and pass that country to ITAD and the direct Steam Store request. Replace the MXN-only Frankfurter request with a v2, tested conversion adapter for supported source/display pairs. Persist source amounts and currency separately from optional converted display amounts, the applied rate, and its fetch time; retain valid source offers if conversion is unavailable.
  - **Done when:** A refresh for every supported market sends its country code to both price providers; supported display conversions retain source amounts and are marked estimated; a missing, malformed, or unsupported rate leaves the source offer available without guessing; focused price and FX tests pass.

- [ ] **Step 3 - Keep selection and offer views currency-safe.** Update offer selection, wishlist/today payloads, formatters, and offer surfaces to use the selected display amount only as labeled presentation context. Preserve comparable source/region selection and warnings, retain the original provider amount, and clearly communicate unavailable conversions. Preserve the current MXN-only target and opportunity behavior rather than comparing converted display amounts to targets.
  - **Done when:** Offer cards and alternatives show authoritative source values plus an estimate only when available, prices in unlike currencies are never silently compared, regional activation warnings remain attached to the relevant offer, and focused selection/view tests pass.

- [ ] **Step 4 - Add Welcome and Settings preference controls.** Add accessible market and display-currency controls to Welcome and complete onboarding with their validated values. Add equivalent editable controls in Settings with a persistent explanation and confirmation warning that the owner must manually refresh prices after changing either preference; do not trigger that refresh automatically.
  - **Done when:** A new owner can save supported choices during Welcome, an existing owner can change either choice in Settings, invalid values show a friendly error without changing saved settings, and Settings explicitly directs the owner to manually refresh prices.

- [ ] **Step 5 - Verify the complete preference flow.** Update affected unit tests and generated Prisma artifacts, run migrations/status, and perform the final automated checks. Manually verify the Welcome and Settings choices, preference persistence after reload, the manual-refresh warning, and a price refresh result that preserves source and estimated display information.
  - **Done when:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm prisma migrate status`, and `git diff --check` pass; the manual path has recorded observable results or a stated blocker.

## Files / areas

- `prisma/schema.prisma` and a new Prisma migration
- `src/lib/price-refresh.ts`, `src/lib/itad-api.ts`, `src/lib/steam-api.ts`, `src/lib/exchange-rate.ts`, offer-selection and offer-view helpers
- `src/actions/settings.ts`, `src/actions/prices.ts`, export/import schemas and their tests
- `src/app/welcome/page.tsx`, `src/components/onboarding/WelcomeSetupForm.tsx`, `src/app/(app)/settings/page.tsx`, and Settings components
- Price, settings, exchange-rate, offer-selection, export/import, and UI payload tests beside their implementation

## Data / contracts

- The shared catalogue is the only authority for supported market/currency values. Client controls use it for options, but server actions validate it before persistence.
- `priceCountry` is an ITAD and direct-Store market code. `displayCurrency` is presentation preference only and may differ from the selected market's usual currency.
- `DealOffer` retains the exact source currency and amounts returned by the provider. Any converted amount, rate, and rate timestamp are optional display metadata and must be visibly described as an estimate.
- One refresh uses one saved market preference. A later Settings change does not rewrite prior offers or enqueue work; the owner explicitly runs the existing price refresh.
- Frankfurter v2 is server-side only. Provider failures, malformed responses, or unsupported pairs are non-destructive and return no converted value.
- All mutations retain the existing single-owner `requireUser()` boundary and `{ success, data, error }` response shape.

## Testing

- Add Vitest coverage for the supported-value validator, preference action, selected-country provider URLs, v2 conversion parsing and failure handling, refresh persistence, and currency-safe offer selection.
- Update export/import schema tests and existing price/Steam/ITAD tests for the new settings and market-aware requests.
- Do not add browser automation. Use the manual path in Step 5 for Welcome and Settings persistence.

## Notes for the AI

- Keep provider amounts authoritative. Never use FX values for target comparisons, discount logic, regional warnings, or cheapest-offer selection.
- Preserve current MXN target behavior until it is separately scoped; communicate unavailable comparisons rather than inventing a conversion.
- Do not begin feature 34b or change Steam OpenID callbacks during this build.

# Feature: Regional price preferences and presentation

**From build-plan:** feature 34a
**Build attempt:** 1
**Branch:** `feature/regional-price-preferences-and-presentation`
**Status:** verified

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

- [x] **Step 1 - Define and persist supported price preferences.** Add one shared, typed market/currency catalogue with the six allowed country and currency codes. Extend `AppSettings` and exported/imported settings with the display currency, retain `MX` and `MXN` defaults for existing owners, and validate preference updates server-side after `requireUser()`.
  - **Done when:** Invalid country/currency input cannot persist, existing settings resolve to `MX`/`MXN`, valid preferences survive the Prisma migration and export/import validation, and focused tests pass.

- [x] **Step 2 - Make refreshes market-aware and preserve source truth.** Load the saved preferences when starting a refresh, record the selected market on the refresh and offer rows, and pass that country to ITAD and the direct Steam Store request. Replace the MXN-only Frankfurter request with a v2, tested conversion adapter for supported source/display pairs. Persist source amounts and currency separately from optional converted display amounts, the applied rate, and its fetch time; retain valid source offers if conversion is unavailable.
  - **Done when:** A refresh for every supported market sends its country code to both price providers; supported display conversions retain source amounts and are marked estimated; a missing, malformed, or unsupported rate leaves the source offer available without guessing; focused price and FX tests pass.

- [x] **Step 3 - Keep selection and offer views currency-safe.** Update offer selection, wishlist/today payloads, formatters, and offer surfaces to use the selected display amount only as labeled presentation context. Preserve comparable source/region selection and warnings, retain the original provider amount, and clearly communicate unavailable conversions. Preserve the current MXN-only target and opportunity behavior rather than comparing converted display amounts to targets.
  - **Done when:** Offer cards and alternatives show authoritative source values plus an estimate only when available, prices in unlike currencies are never silently compared, regional activation warnings remain attached to the relevant offer, and focused selection/view tests pass.

- [x] **Step 4 - Add Welcome and Settings preference controls.** Add accessible market and display-currency controls to Welcome and complete onboarding with their validated values. Add equivalent editable controls in Settings with a persistent explanation and confirmation warning that the owner must manually refresh prices after changing either preference; do not trigger that refresh automatically.
  - **Done when:** A new owner can save supported choices during Welcome, an existing owner can change either choice in Settings, invalid values show a friendly error without changing saved settings, and Settings explicitly directs the owner to manually refresh prices.

- [x] **Step 5 - Verify the complete preference flow.** Update affected unit tests and generated Prisma artifacts, run migrations/status, and perform the final automated checks. Manually verify the Welcome and Settings choices, preference persistence after reload, the manual-refresh warning, and a price refresh result that preserves source and estimated display information.
  - **Done when:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm prisma migrate status`, and `git diff --check` pass; the manual path has recorded observable results or a stated blocker.
  - **Verification (2026-09-22):** All automated gates pass. The owner manually confirmed the Welcome route is reachable after temporarily toggling `AppSettings.onboardingCompleted` without resetting account data, and confirmed that Settings changes persist and refreshed prices show the selected display presentation.

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


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8368,"specSha256":"d5765e6450300a4520dbe29b85c3adb52770edafcedda415d9367188b3b27552","branch":"refs/heads/feature/regional-price-preferences-and-presentation","head":"7d09cf898731de6ed15a371430d4200bee398f83","baseRef":"refs/heads/main","baseCommit":"073e7967c6816a8ea762822674ca322b03841138","sourceTree":"7d15a267a7aa3bb2c783e6818809acfe91fdd537","absentOptional":[]} -->

## Findings

### 34a/F-01 [P1] closed - Display FX values drive offer selection across unlike source currencies

**File:** src/lib/price-refresh.ts:149-159; src/lib/offer-selection.ts:67-85
**Found:** 2026-09-22 by /audit (scope: current; lens: quality, security, performance, tests)
**Why it matters:** A successful conversion replaces the persisted `currency` and `price` with the selected display currency and converted amount, while the selector groups and sorts by those fields. For example, a CAD source offer converted to USD and a USD source offer both become USD candidates, so the selector compares unlike source currencies and can choose a different offer solely because the presentation currency preference changed. This violates the feature contract that source prices remain authoritative and presentation-only FX cannot change offer selection.
**Suggested fix:** Keep selection keyed to source currency/source amount and the existing comparable-source rule; use converted display values only for rendering. Add a test with mixed source currencies and a non-MXN display currency proving that changing display currency does not change the selected source offer.
**Resolution:** Closed in the fresh independent review. The reviewed selector uses source currency/source amount for validity, comparability, and sorting while retaining converted values for presentation; mixed-source coverage passes.

### 34a/F-02 [P2] closed - Price-only settings saves trigger the full OS recomputation pipeline

**File:** src/components/settings/AccountCard.tsx:83-97, 182-209; src/actions/settings.ts:83-99
**Found:** 2026-09-22 by /audit (scope: current; lens: quality, performance)
**Why it matters:** The Settings price controls save through `updateOsSetup`, and that action always re-derives every catalog and wishlist compatibility row and regenerates recommendation runs in one transaction. Changing only a market or display currency is presentation/refresh configuration, so this adds potentially expensive unrelated work and can make a price-preference save fail or alter recommendation state even though no device setting changed.
**Suggested fix:** Route price-only changes through `updatePricePreferences`, or split the action so the compatibility and recommendation pipeline runs only when OS fields changed.
**Resolution:** Closed in the fresh independent review. Environment changes use `updateOsSetup`, while price-only changes use `updatePricePreferences`, avoiding unrelated compatibility and recommendation recomputation.

### 34a/F-03 [P2] closed - Converted MXN offers still present the MXN target as if comparable

**File:** src/components/wishlist/WishlistOfferSection.tsx:110-120
**Found:** 2026-09-22 by /audit (scope: current; lens: quality, security)
**Why it matters:** The section displays the existing MXN target whenever the displayed offer currency is MXN, but does not require `sourceCurrency` to be MXN. A USD offer converted to an estimated MXN display value therefore shows the target beside a non-authoritative amount. The opportunity badge is suppressed elsewhere, but the target presentation still implies a comparison that the spec explicitly keeps MXN-source-only.
**Suggested fix:** Require an MXN source currency before rendering the target row, matching the source-currency guard used by opportunity evaluation and Today.
**Resolution:** Closed in the fresh independent review. Wishlist target rendering and Today target ranking require an MXN display value backed by an MXN source.

### 34a/F-04 [P2] closed - Regionalized price flows retain hard-coded Mexico/MXN messaging

**Files:** src/components/wishlist/PriceRefreshPanel.tsx:46-49; src/components/wishlist/WishlistOfferSection.tsx:85-89; src/components/wishlist/WishlistOfferAlternatives.tsx:82-89; src/components/wishlist/WishlistDetailHero.tsx:129-132
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** Users selecting another display currency still receive a refresh failure message specifically about conversion to MXN, and users selecting another market see keyshop activation warnings specifically about Mexico. These messages no longer describe the configured market or display preference and can mislead the owner about the offer being shown.
**Suggested fix:** Pass the selected market/display currency into the view models and use it in the warning text, or use market-neutral wording where the exact value is unavailable.
**Resolution:** Closed in the fresh independent review. Conversion-failure messaging uses the selected display currency, and keyshop activation warnings are market-neutral.

## Independent review

**Status:** passed
**Target commit:** 7d09cf898731de6ed15a371430d4200bee398f83
**Base commit:** 073e7967c6816a8ea762822674ca322b03841138
**Base ref:** refs/heads/main
**Spec hash:** d5765e6450300a4520dbe29b85c3adb52770edafcedda415d9367188b3b27552
**Prepared by:** codex
**Builder model:** unknown (runtime did not expose exact model)
**Requested reviewer:** codex
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-09-22T23:52:27Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** codex
**Reviewer model:** unknown (runtime did not expose exact model)
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-22T23:59:35Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `pnpm test`: pass, 131 test files and 1,276 tests
- `pnpm typecheck`: pass
- `pnpm lint`: pass
- `pnpm build`: pass
- `pnpm prisma migrate status`: pass, database schema is up to date with 42 migrations
- `git diff --check 073e7967c6816a8ea762822674ca322b03841138..HEAD`: pass

### Evidence

- Reviewed the complete `073e7967c6816a8ea762822674ca322b03841138..7d09cf898731de6ed15a371430d4200bee398f83` delta across quality, security, performance, and tests, including the final repair commit.
- Freshness checks passed: `HEAD`, `refs/heads/main`, merge base, current-feature SHA-256, and dirty-path scope match the pending request.
- Server validation/authentication, source-price retention, currency-safe selection, UI presentation labels, migration, export/import, and focused test coverage were inspected.
- The active spec's owner-recorded Welcome and Settings manual evidence was read; no fresh browser run was required by this request.

### Findings

- F-01, F-02, F-03, F-04 closed after fresh re-review; no new findings.

### Remaining risk

- No fresh browser run was performed in this reviewer session because Check was not required; the recorded manual evidence remains owner-provided.
- No dedicated security scanner or performance profiler is declared for this project; static four-lens review and the declared automated gates were used.

## Manual try guide

### Start

1. From the project root, run `pnpm dev`.
2. Open `http://localhost:3500` in the signed-in browser session.

### Settings path

1. Open `/settings`.
2. In Account, under Environment, choose **Edit**.
3. Change the price country and/or display currency, select **Review changes**, then confirm.
4. Reload Settings and reopen the modal.

### Expect

- The selected country and display currency remain saved after reload.
- The confirmation explains that price-only changes affect future refreshes and do not refresh existing offers automatically.
- Choose **Update prices** from a price surface, then reload the affected wishlist or Today view. Converted values are visibly estimates, and the provider source amount/currency remains available alongside them.
- If conversion is unavailable, the source offer remains visible and the message names the selected display currency rather than assuming MXN.
- Keyshop activation warnings refer to the selected market generically and do not claim Mexico for every region.
- A converted non-MXN source offer does not show the MXN target or opportunity comparison.

### Welcome path

For an account that has already completed onboarding, use the existing local test procedure that temporarily sets `AppSettings.onboardingCompleted` to `false` without resetting account data, open `/welcome`, and restore the setting afterward. Choose supported market/currency values, complete setup, and confirm the selection persists on the next load.

### Watch For

- Prices changing immediately when only Settings preferences change; the owner must run a manual refresh.
- A converted amount being treated as the cheapest comparable offer or as an MXN target match.
- Runtime Prisma errors about `DealOffer.displayCurrency`, stale migration status, or a script warning from `RootLayout`.

**Best signal:** change the display currency in Settings, reload, run a manual price refresh, and confirm the converted presentation changes while the source price remains visible.

**Optional deeper checks:** repeat with a different supported market, test a conversion-unavailable response if one is available locally, and verify both wishlist detail and Today surfaces.

**Gaps:** this guide does not provide fresh browser evidence; the archived manual evidence is owner-confirmed, and external provider availability can affect live price-refresh results.

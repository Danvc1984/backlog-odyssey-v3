# Feature: Optional Steam connection in Welcome

**From build-plan:** feature 34b
**Build attempt:** 1
**Branch:** `feature/optional-steam-connection-in-welcome`
**Status:** verified

## Goal

Let a signed-in owner optionally link the existing Steam account during Welcome, then either return to and finish Welcome or explicitly skip Steam. A cancelled or failed OpenID attempt must return safely to Welcome and must never prevent setup completion.

## In scope

- An optional Steam OpenID connection action in the existing Welcome flow.
- A clear skip path that completes the existing device, duration, price, and theme setup without a Steam connection.
- Success, cancellation, and failure return paths that preserve access to Welcome until its existing setup is saved.
- Existing single-owner authentication, nonce validation, OpenID verification, and Steam connection persistence.
- Clear accessible connected, pending, and error feedback in Welcome, without automatic Steam library or wishlist import.

## Out of scope

- Changing the existing Settings Steam connection experience or its import, sync, and disconnect actions.
- Automatic Steam imports, price refreshes, recommendation runs, or onboarding completion after linking.
- Changing Steam OpenID provider verification, Steam account data, or the existing connection model.
- Any work from feature 35.

## Build loop

- Work on `feature/optional-steam-connection-in-welcome`.
- Implement and review one checked step at a time. Run focused Vitest coverage for each logic-bearing step and `pnpm test` before review.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` before requesting completion. No checkpoint commit is planned. `/complete` owns the final commit.

## Build steps

- [x] **Step 1 - Make the existing OpenID round trip return safely to Welcome.** Extend the existing authenticated connection route and callback with a server-controlled, allowlisted Welcome return intent stored alongside the current nonce. Keep callback validation and cleanup intact, redirect a valid Welcome-originated success or rejected/cancelled attempt back to Welcome with a short status, and retain Settings as the default for existing entry points.
  - **Done when:** A Welcome connection request creates the same nonce-protected OpenID request and returns success, cancellation, verification failure, or callback error to `/welcome`; an absent or invalid return intent cannot redirect outside the supported routes; Settings-originated connection behavior remains unchanged; focused tests pass.

- [x] **Step 2 - Compose optional Steam connection and skip in Welcome.** Load the current Steam connection state with the existing Welcome data and add an accessible optional Steam section to `WelcomeSetupForm`. Show the current connected state when present, start the existing connection action when requested, surface the returned success or failure status once, and provide an explicit continue-without-Steam action that uses the existing validated setup save.
  - **Done when:** A new owner can either begin Steam connection or choose a clearly labeled skip action; a connected owner sees that state; a failed or cancelled attempt leaves the setup fields usable with friendly feedback; neither path imports or syncs Steam data automatically.

- [x] **Step 3 - Verify the complete Welcome paths.** Update focused route/helper tests and any affected component-facing contracts, then run the final automated checks. Manually check the skip path, connection handoff and return, and cancellation/failure return when safely possible with a real signed-in session.
  - **Done when:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check` pass; manual evidence records the skip result and the observable Steam return result or a stated external-provider blocker.
  - **Manual evidence:** User-confirmed successful Steam connection and successful Welcome completion using “Continue without Steam”.

## Files / areas

- `src/app/api/steam/connect/route.ts` and `src/app/api/steam/callback/route.ts`
- `src/lib/steam-openid.ts` and new or adjacent focused tests
- `src/app/welcome/page.tsx` and `src/components/onboarding/WelcomeSetupForm.tsx`
- Existing Steam connection and Welcome test areas as supported by the implementation

## Data / contracts

- The owner identity always comes from `requireUser()` at every Steam route. Client input cannot select an identity or an arbitrary callback destination.
- Welcome return intent is server-controlled and restricted to the existing Welcome route. The nonce remains HTTP-only, same-site, and short-lived; all temporary OpenID cookies are cleared on every callback terminal path.
- A successful callback upserts the same single `SteamConnection` record as Settings. It does not mark onboarding complete or trigger any Steam work.
- Welcome setup completion remains the existing validated `updateOsSetup` mutation. Skipping Steam is a completion choice, not a persisted refusal or a provider-side mutation.
- User-facing OpenID failures use short status tokens and friendly accessible feedback. Do not expose provider response details.

## Testing

- Add Vitest coverage for allowlisted return selection and callback outcome redirects, including missing, invalid, cancelled, failed, and successful Welcome-originated flows.
- Preserve and update existing Steam OpenID helper tests as needed for nonce and callback validation behavior.
- Do not add browser automation. Step 3 uses a manual signed-in Welcome path, with a real Steam cancellation or provider failure recorded as available.

## Notes for the AI

- Reuse the existing OpenID verification and `SteamConnection` upsert. Do not create another linking flow.
- Preserve the current Settings callback destinations and toast behavior for connections initiated there.
- Keep all current Welcome choices editable after a Steam return. Do not assume a successful link means setup is saved.
- Render any returned status as text, never as raw query or provider content.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6057,"specSha256":"eb80217e709d2e8aab97efbb308e1c567cd7e47622f2e35727af2ccf0cfd4a7b","branch":"refs/heads/feature/optional-steam-connection-in-welcome","head":"bd761ca5f4b7a0f09517b96c6bf6736e0599c2e2","baseRef":"refs/heads/main","baseCommit":"bd761ca5f4b7a0f09517b96c6bf6736e0599c2e2","sourceTree":"24c2b7dac875e70618510028e9e955696d54b48c","absentOptional":[]} -->

## Manual try guide

### Start

1. From the project root, run `pnpm dev`.
2. Open `http://localhost:3500` in the signed-in browser session.

### Welcome path

1. Open `/welcome` for an owner whose onboarding is not yet complete.
2. Confirm the **Optional Steam connection** section is present.
3. Choose **Connect Steam**, complete the Steam handoff, and return to Welcome.
4. Reload or revisit Welcome and confirm the connected state is shown.
5. In a setup without Steam, choose **Continue without Steam**.

### Expect

- A successful Steam handoff returns to Welcome with a friendly connected message; setup choices remain editable and no import or sync starts automatically.
- A cancelled or failed attempt returns to Welcome with a short friendly status; the setup fields remain usable.
- **Continue without Steam** uses the existing validated setup save and completes onboarding without a Steam connection.
- Settings-originated Steam connection continues to return to Settings with its existing status behavior.

### Watch For

- A return destination outside `/welcome` or `/settings`.
- Steam import, wishlist import, playtime sync, or recommendation work starting automatically.
- A failure exposing raw provider response details.
- Setup controls becoming unavailable after cancellation or failure.

**Best signal:** from signed-in Welcome, complete the Steam connection and confirm that Welcome remains available for saving setup; then repeat with **Continue without Steam**.

**Optional deeper checks:** cancel the Steam provider handoff and repeat with an unavailable or rejected provider response if one is safely available locally.

**Gaps:** external Steam cancellation/failure behavior depends on provider availability; focused route tests cover the short status and redirect outcomes.

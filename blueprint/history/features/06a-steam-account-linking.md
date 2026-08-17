# Feature: Steam account linking (6a)

**From build-plan:** feature 6a
**Status:** complete

## Goal

Let the owner link their Steam account so later sub-features can call the Steam
Web API on their behalf. The flow: a "Connect Steam" button redirects to Steam's
OpenID 2.0 login page, Steam redirects back to a callback route that extracts
the SteamID64, and the `SteamConnection` singleton row is created or updated.
Settings shows the linked account and offers a disconnect action.

## In scope

- Custom Steam OpenID 2.0 flow via route handlers (not Auth.js, which only
  handles the Google login identity)
- `SteamConnection` row upsert (state = `CONNECTED`, steamId64 stored)
- Connection status display on `/settings`
- Disconnect action: deletes the `SteamConnection` row (row absence = disconnected; 6b re-connects via upsert)
- `requireUser()` guard on all Steam endpoints and actions

## Out of scope

- Steam Web API calls (owned games, playtime) - deferred to 6b
- SyncRun logging - deferred to 6c
- Daily scheduled refresh - deferred to 6c
- Steam avatar or profile display
- Multiple Steam accounts (single-user, one SteamID64)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Steam OpenID helper** - create `src/lib/steam-openid.ts` with `buildSteamOpenIdUrl(returnUrl, realm)` and `verifySteamOpenIdResponse(query)`. Verification POSTs the `openid.*` params plus `openid.mode=check_authentication` to the Steam OP endpoint (`https://steamcommunity.com/openid/login`) and checks for `is_valid:true`. `extractSteamId64(query)` pulls the SteamID64 from `openid.claimed_id`. *Done when:* `pnpm test` passes with tests for URL construction and SteamID64 extraction.

- [x] **Step 2 - Steam connect route** - `src/app/api/steam/connect/route.ts` GET handler. Calls `requireUser()`, redirects to the Steam OpenID URL with the callback at `/api/steam/callback`. Realm and return_to derive from `AUTH_URL` env var, falling back to `http://localhost:3500`. Signed out requests redirect to `/`. *Done when:* signed-in hits redirect to `steamcommunity.com/openid/login` with the correct `openid.return_to`.

- [x] **Step 3 - Steam callback route** - `src/app/api/steam/callback/route.ts` GET handler. Calls `requireUser()`, verifies `openid.return_to` matches the expected callback, calls `verifySteamOpenIdResponse`, upserts the `SteamConnection` singleton (id=1) with the SteamID64 and `state: "CONNECTED"`. Success redirects to `/settings?steam=connected`, failure to `/settings?steam=error`. Real errors are logged and redirected rather than surfacing as a 500. *Done when:* valid callback creates/updates the connection; invalid callback and unsigned-out requests redirect correctly.

- [x] **Step 4 - Disconnect server action** - `src/actions/steam.ts` `disconnectSteam()`. Calls `requireUser()`, deletes the singleton row if it exists (idempotent). Returns `{ success, data, error }`. *Done when:* `pnpm test` passes for happy path and no-connection idempotency.

- [x] **Step 5 - Settings connection section** - `src/app/(app)/settings/page.tsx` fetches the `SteamConnection` singleton and renders `src/components/steam/SteamConnectionCard.tsx`: "Connect Steam" when disconnected, SteamID64 + Disconnect when connected. `?steam=connected` shows a success toast, `?steam=error` an error toast. *Done when:* `/settings` reflects connect and disconnect states.

## Files / areas

- `src/lib/steam-openid.ts` - OpenID URL builder + response verifier (step 1)
- `src/lib/steam-openid.test.ts` - unit tests (step 1)
- `src/app/api/steam/connect/route.ts` - connect route handler (step 2)
- `src/app/api/steam/callback/route.ts` - callback route handler (step 3)
- `src/actions/steam.ts` - disconnect action (step 4)
- `src/actions/steam.test.ts` - unit tests (step 4)
- `src/components/steam/SteamConnectionCard.tsx` - connection status UI (step 5)
- `src/app/(app)/settings/page.tsx` - settings page with Steam section (step 5)
- `src/generated/prisma/*` - regenerated client (SteamConnection.id was stale: String vs schema Int)

## Data / contracts

- `SteamConnection` model (already in schema, id=1 singleton): `steamId64`, `state` (string), `lastSyncAt`, `counts` (JSON), `createdAt`, `updatedAt`
- `state` values used by this feature: `CONNECTED` (row exists). Row absence means disconnected. Later features add `SYNCING`, `ERROR`.
- `AUTH_URL` env var provides the app's public URL (used as OpenID realm and callback base; defaults to `http://localhost:3500`)
- `STEAM_WEB_API_KEY` env var: declared in `.env.example` as future; not used until 6b

## Testing

- **Unit tests (Vitest):** Steam OpenID helper (`buildSteamOpenIdUrl`, `verifySteamOpenIdResponse` with mocked fetch, SteamID64 extraction). Disconnect action (happy path, idempotent when no connection). Test files next to source.
- **Browser verification:** sign in, hit `/settings`, click "Connect Steam", complete Steam login, verify redirect back and SteamID64 shown; click Disconnect, verify "Connect Steam" reappears.

## Notes for the AI

- Steam OpenID 2.0 is NOT OAuth2. The redirect URL is `https://steamcommunity.com/openid/login` with OpenID query params. **Verification is a POST of the received `openid.*` params plus `openid.mode=check_authentication` to the same OP endpoint** (`/openid/login`), which returns `is_valid:true/false` as plain text. The `/openid/isValid` endpoint now returns only an XRDS discovery document and no longer answers `check_authentication`.
- The callback must also verify `openid.return_to` matches the expected callback URL, and the OpenID signature must be checked server-side before trusting the SteamID64. Never trust client-supplied identity values.
- `requireUser()` guards every Steam route and action. The SteamID64 belongs to the single allowed user.
- The `SteamConnection` singleton uses `id=1` (same pattern as `AppSettings`). Use `upsert({ where: { id: 1 }, create: { id: 1, ... }, update: { ... } })`.
- Steam nonces are single-use: replaying a callback URL yields `?steam=error` by design (Steam rejects the repeat).
- Restart the dev server after `pnpm prisma generate`; a stale in-memory client caused a 500 on the callback upsert.

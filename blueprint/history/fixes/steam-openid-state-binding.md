# Fix: Steam OpenID connect state binding

**Type:** Fix
**Fixes:** F-22

## The problem

`GET /api/steam/callback` accepted any Steam-signed OpenID response and could
silently rebind the single Steam connection to a different SteamID64.

## The fix

The connect route now generates a random state nonce, stores it in an
HttpOnly, Secure, SameSite=Lax cookie, and includes it in the signed
`openid.return_to` URL. The callback requires a timing-safe match between the
query state and cookie before verifying or upserting the connection, then
clears the cookie on success or error.

## Verification

- `pnpm typecheck` passed.
- `pnpm test` passed: 98 files, 1011 tests.
- `pnpm lint` passed with five pre-existing warnings outside this fix.
- `git diff --check` passed.
- Manual verification confirmed the normal Steam connection redirect and that
  editing `state` redirects to `/settings?steam=error` without rebinding.

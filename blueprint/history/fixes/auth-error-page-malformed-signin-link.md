# Fix: Auth error page malformed sign-in link

**Type:** Fix

## The problem

When an unauthorized email attempts Google sign-in, the `signIn` callback in
`src/lib/auth.ts` returns `false`, triggering an Auth.js `AccessDenied` error.
Auth.js redirects to `/api/auth/error?error=AccessDenied`, which renders the
default error page.

The default error page's "Sign in" link is malformed: it appends `/signin` to
the current path, producing `/api/auth/error?error=AccessDenied/signin`. This
causes a second redirect to `/` before the user lands on the sign-in page. The
round-trip is confusing and the URL is ugly.

The root cause: `src/lib/auth.ts` configures `pages.signIn: "/"` but there is
no custom error page (`pages.error` is unset), so the default error page does
not know the correct sign-in path.

## The fix

Add a custom error page at `src/app/api/auth/error/page.tsx` that handles the
`AccessDenied` case with a clear message and a proper link back to `/` (the
configured sign-in page). The page reads the `error` search param and renders
an appropriate message.

Must not break: existing sign-in flow, sign-out, session callbacks, or the
auth guard in the `(app)` layout.

## Build steps

- [x] **Step 1 - Custom error page** - create `src/app/api/auth/error/page.tsx`
  as a server component that reads the `error` search param. For `AccessDenied`,
  show "You do not have permission to sign in" with a link back to `/`. For
  other errors, show a generic message. *Done when:* navigating to
  `/api/auth/error?error=AccessDenied` shows the custom page with a working link
  to `/`, and `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` are
  green.

## Verify

1. Run `pnpm dev`
2. Navigate to `http://localhost:3000/api/auth/error?error=AccessDenied`
3. Confirm the custom error page renders with a "Sign in" link pointing to `/`
4. Click the link, confirm it goes directly to `/` (no malformed URL, no double redirect)
5. Run `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

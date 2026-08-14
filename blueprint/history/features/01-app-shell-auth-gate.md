# Feature: App shell and auth gate

**From build-plan:** feature 1
**Status:** complete

## Goal

Gate the whole app behind single-user Google sign-in (only `ALLOWED_GOOGLE_EMAIL`
may enter) and wrap the protected area in a responsive app shell with a desktop
sidebar nav and a mobile bottom nav. Auth plumbing is already scaffolded
(`src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, Auth schema models),
so this feature completes route protection and delivers the shell that later
features hang their pages off.

## Design reference

Not a visual replication; no reference image needed. Follow the UI/UX constraints
in `blueprint/context/project-overview.md` (constrained desktop width, persistent
nav, mobile bottom nav with 44px touch targets, single-user private app).
Use the existing design tokens in `src/app/globals.css`; the per-game dynamic
theme is feature 14, out of scope here, so default to light with a dark class
available.

## In scope

- **Route protection:** an `(app)` route group whose layout runs an auth guard and
  redirects unauthenticated visitors to `/`; the public landing `/` redirects an
  authenticated user to `/today`.
- **Allowed-email enforcement:** a reusable server guard asserting the session
  email equals `ALLOWED_GOOGLE_EMAIL`, used at every protected entry point, keeping
  the existing `signIn` / `session` callbacks as the identity gate.
- **App shell:** shared layout with a desktop sidebar nav and a mobile bottom nav
  (44px touch targets), linking Today, Library, Wishlist, Settings, with active
  state and a sign-out control.
- **Placeholder pages** for Today, Library, Wishlist, Settings so the shell links
  resolve; `/today` is the post-login landing.
- **One pure, testable auth-decision helper** with unit tests (test gate is on).

## Out of scope

- Page content for Today / Library / Wishlist / Settings (features 13, 2, 8, 16).
- Light/dark toggle and per-game dynamic theme (feature 14).
- Wallpaper and reduced-data concerns (features 15, 16).
- Expanding the Playwright suite (E2E is not a gate; keeping the existing spec green).

## Build loop

Build one step at a time, never the whole feature at once. The AI implements one
step, shows the diff, you read and approve it, optionally commit a checkpoint,
then the next step starts. Never accept a step you haven't read; if a diff is too
big to review, split it.

## Build steps

- [x] **Step 1 - Auth guard helper** - add `src/lib/auth-guard.ts` with a pure
  `isAllowedEmail(email)` boolean (compares to `ALLOWED_GOOGLE_EMAIL`) and a
  server-side `requireUser()` that calls `auth()` and `redirect("/")` when
  unauthorized. Unit-test `isAllowedEmail` (allowed match, wrong email,
  null/undefined, env unset). *Done when:* `pnpm test` is green and the helper is
  exported and typechecks.
- [x] **Step 2 - Protected route group + redirects** - create `src/app/(app)/`
  with a `layout.tsx` that runs `requireUser()` and renders a minimal shell (nav
  links, sign-out, placeholder pages for `/today`, `/library`, `/wishlist`,
  `/settings`); update public `src/app/page.tsx` to redirect an authenticated user
  to `/today`. *Done when:* unauthenticated `/today` redirects to `/`,
  authenticated `/` redirects to `/today`, all placeholders render with working
  links, and tests / lint / typecheck / build are green.
- [x] **Step 3 - Responsive shell** - style the shell: persistent desktop sidebar
  nav and mobile bottom nav (44px touch targets), active link state via
  `usePathname`, sign-out in the user area (remove ad-hoc buttons from the landing
  page; landing shows sign-in only when logged out). *Done when:* desktop shows the
  persistent sidebar, mobile width shows the bottom nav, all links navigate with
  active states, and tests / lint / typecheck / build are green.

## Files / areas

- `src/lib/auth-guard.ts` (new) - `isAllowedEmail` + `requireUser()`.
- `src/lib/auth-guard.test.ts` (new, alongside) - unit tests.
- `src/app/(app)/layout.tsx` (new) - guard + shell layout.
- `src/app/(app)/today/page.tsx`, `library/page.tsx`, `wishlist/page.tsx`,
  `settings/page.tsx` (new) - placeholders.
- `src/app/(app)/_components/` (new) - `AppNav.tsx` (client, `usePathname` active
  state) and any shell primitives.
- `src/app/page.tsx` (edit) - landing redirect + sign-in when logged out.
- `src/app/(app)/(...)` - `middleware.ts` is intentionally NOT used; guard lives in
  the server layout consistent with the single-user convention.

## Data / contracts

- No schema changes; Auth models (`User`, `Account`, `Session`) already exist and
  are migrated.
- `isAllowedEmail(email: string | null | undefined): boolean` - pure,
  load-bearing; the protected layout, future pages, route handlers, and Server
  Actions all route authorization through this or `requireUser()`.
- `ALLOWED_GOOGLE_EMAIL` is read from env once; never trust a client-supplied
  identity, always compare against the authenticated session email.
- `requireUser()` returns the authorized session or calls `redirect("/")` (which
  throws); keep the pure decision logic separate from the redirect so it is
  testable.

## Testing

- **Step 1 logic (test gate):** `isAllowedEmail` - true on exact allowed email,
  false on a different email, false on null/undefined, false when the env var is
  unset. Use `vi.stubEnv("ALLOWED_GOOGLE_EMAIL", ...)` with a real allowed value
  and an "other" value. No DB or auth mocks needed for the pure helper.
- **Integration (screenshot + build):** redirects (`/` vs `/today`) and shell
  layout behavior. Verify by running the dev server and hitting `/today`
  unauthenticated (expect redirect to `/`) and `/` authenticated (expect redirect
  to `/today`), plus a desktop and a mobile-width screenshot of the nav.
- **Regression:** `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all green.

## Notes for the AI

- **Single user, no per-user scoping**, per `coding-standards.md`. Authorization is
  a global gate, not a per-row filter. Enforce it at every protected server entry
  point via `requireUser()`; the `signIn` / `session` callbacks in `src/lib/auth.ts`
  remain the identity gate and must not be loosened.
- **Denied sign-in is already handled by Auth.js:** a non-allowed email that
  attempts Google sign-in returns `false` from the existing `signIn` callback, so
  Auth.js refuses the session. Do not add a custom denial page in this feature;
  Step 2 must simply confirm the gate holds, not scaffold new denial UI.
- **Server components by default.** Only the nav needs `usePathname` for active
  state, so only that component is `"use client"`.
- **Tailwind v4 CSS-first** - use the tokens already in `src/app/globals.css`; do
  not add a `tailwind.config.js`.
- **Dark-first, light available** - the tokens already define both; leave theme
  switching to feature 14.
- **Mobile bottom nav** must honor the 44px touch-target rule and not clip content;
  account for the safe-area inset so the bottom nav sits above the home indicator.
- **Route structure:** protected pages live in `src/app/(app)/` so the group's
  single `layout.tsx` provides both the auth guard and the shell; `src/app/page.tsx`
  stays the public sign-in landing. Do not introduce middleware for this; a
  server-layout guard matches the project convention and avoids edge-runtime
  database-session complications.

## Findings

### 1/F-01 [P2] fixed - AGENTS.md "What this is" still has placeholder text

**File:** AGENTS.md:9
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The project description block was never filled in after `/onboard`. It still reads "A description of your project and the problem it solves." Every agent session reads this file first; a placeholder here wastes context and gives no project grounding.
**Suggested fix:** Replace the placeholder with a 1-2 sentence project description (can be lifted from project-overview.md line 3).
**Resolution:** Replaced with actual project description lifted from project-overview.md.

### 1/F-02 [P3] fixed - Empty `src/lib/auth/` directory committed

**File:** src/lib/auth/
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** Empty directories are noise in git. Likely an artifact of scaffolding that was never cleaned up.
**Suggested fix:** Remove the directory (`rm -r src/lib/auth/`).
**Resolution:** Directory removed.

### 1/F-04 [P2] fixed - `MetadataSnapshot.provider` uses `String` not the `Provider` enum

**File:** prisma/schema.prisma:232
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The schema defines a `Provider` enum (lines 93-101) used by `CompatibilitySnapshot` and `SyncRun`, but `MetadataSnapshot.provider` is a plain `String`. This allows invalid provider values and loses type safety. The PRD's data model (section 15) lists RAWG, Steam, and ITAD as metadata providers, all of which are in the enum.
**Suggested fix:** Change `provider String` to `provider Provider` on MetadataSnapshot.
**Resolution:** Changed to `provider Provider` enum type.

### 1/F-05 [P2] fixed - `SteamConnection` uses `cuid()` but is described as a singleton

**File:** prisma/schema.prisma:167
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The project overview says "SteamConnection (singleton)" and the PRD says "one SteamID64". But unlike `AppSettings` (id=1) and `WallpaperState` (id=1), `SteamConnection` uses `@default(cuid())`. Multiple rows could be created accidentally. There is no `@@unique` constraint preventing duplicates beyond `steamId64`.
**Suggested fix:** Either use `id Int @id @default(1)` to match the singleton pattern, or add application-level guard logic and document why cuid is intentional.
**Resolution:** Changed to `id Int @id @default(1)` to match the singleton pattern used by AppSettings and WallpaperState.

### 1/F-06 [P3] closed - `AppSettings` timezone string does not match PRD

**File:** prisma/schema.prisma:157
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The PRD (section 5.2) says "UTC-6 (Central Time, Mexico)". The schema defaults to `"America/Mexico_City"` which is IANA and correct for date-fns/luxon/Temporal, but the project overview says "UTC-6". This is fine if intentional (IANA handles DST correctly), but worth confirming the choice matches the PRD intent, since Mexico eliminated DST in 2023 and `America/Mexico_City` is now permanently UTC-6.
**Suggested fix:** Confirm IANA is the intended format. No code change needed if so, but note it in the schema comment.
**Resolution:** Confirmed intentional. Added clarifying comment to schema: "IANA; Mexico eliminated DST in 2023, permanently UTC-6".

### 1/F-07 [P3] fixed - Vite config ESM/CJS warning in test runner

**File:** vitest.config.mts (renamed from vitest.config.ts)
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** Vitest prints a warning: "Your Vite config uses features that are unsupported by `configLoader: 'native'`". The config uses ESM import syntax in a `.ts` file without `"type": "module"` in package.json. This is cosmetic today but will break when Vite makes native the default.
**Suggested fix:** Either rename to `vitest.config.mts` or add `"type": "module"` in package.json (verify no side effects).
**Resolution:** Renamed `vitest.config.ts` to `vitest.config.mts` and replaced `__dirname` with `import.meta.dirname` (not available in ESM). The rolldown native binding error from the first attempt did not reproduce on Node 22.23.1 / Vitest 4.1.10. Warning gone; `pnpm test`, `pnpm typecheck`, and `pnpm lint` all pass.

### 1/F-08 [P3] fixed - `blueprint/context/ai-interaction.md` boilerplate comment not removed

**File:** blueprint/context/ai-interaction.md:3-6
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The file still has the original Blueprint boilerplate blockquote: "This blueprint is an overlay layer, added on top of an already-scaffolded app. Never run a framework scaffolder..." This is setup guidance that `/onboard` typically removes or replaces. It adds noise to every AI interaction since this file is always in context.
**Suggested fix:** Remove the boilerplate blockquote or replace with a project-specific note.
**Resolution:** Boilerplate blockquote removed.

### 1/F-09 [P2] fixed - `coding-standards.md` references Clerk in example comments

**File:** blueprint/context/coding-standards.md:129
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The testing section says "vi.mock() for external dependencies (Prisma, Clerk, etc.)". This project uses Auth.js, not Clerk. This is leftover from the Blueprint template and could confuse agents.
**Suggested fix:** Replace "Clerk" with "Auth.js" in the example.
**Resolution:** Replaced "Clerk" with "Auth.js".

### 1/F-10 [P2] fixed - No Prisma migrations exist yet

**File:** prisma/migrations/
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The schema is comprehensive (486 lines, 25 models) but no migration has been generated. The app cannot start against a real database until `pnpm prisma:migrate` is run. This is expected for an early-stage project that hasn't connected to a database yet, but should be done before feature 1 implementation begins.
**Suggested fix:** Run `pnpm prisma:migrate` when a database is available, or confirm this will be part of feature 1 setup.
**Resolution:** Initial migration `20260813193002_init` generated and applied to local PostgreSQL (Postgres.app). Database seeded with AppSettings and WallpaperState singletons.

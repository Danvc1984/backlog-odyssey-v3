# Feature: Sign-in introduction demo

**From build-plan:** feature 33
**Build attempt:** 1
**Branch:** feature/sign-in-introduction-demo
**Status:** verified

## Goal

Make the signed-out entry point explain Backlog Odyssey before authentication: present icon-led branding, the approved tagline, and a playful, adventurous responsive demo that shows recognizable games moving from a backlog entry to explainable play or buy recommendations.

## In scope

- Replace the signed-out home page's plain heading and supporting copy with a Sunset-colored dragon brand mark, `Backlog Odyssey`, and the tagline `Turn your gaming backlog into your next adventure`; add a Google icon to the existing sign-in action.
- Keep the existing server-side Google sign-in action and authenticated redirect unchanged, with sign-in remaining the primary action.
- Add a decorative responsive demo panel that cycles static curated records for Half-Life 2, Cult of the Lamb, Elden Ring, Grand Theft Auto V, and NieR:Automata. Desktop places it beside sign-in; mobile places it below the primary sign-in card.
- Each visible demo record shows a compact three-part story: add a game manually or through Steam import, fill in personal information and track the backlog, then receive an explainable Play Next or Buy recommendation grounded in actual app signals such as genres, personal tags, compatibility, handheld suitability, and a wishlist discount.
- Use remote cover art from the static curated records only when reduced-data is off. Fall back to a deterministic token/gradient card with the game title when reduced-data is on or an image fails to load.
- Reuse the existing visual-preference provider and carousel timing rules: dark Sunset is the default until an owner chooses otherwise, reduced motion makes the demo manual, while full motion auto-advances and pauses on hover or focus. Provide visible, keyboard-operable previous/next controls and an announced position.
- Keep authentication and branding first on mobile, then present the demo as a compact secondary panel below it.

## Out of scope

- Public registration, changes to Google/Auth.js access rules, authentication error-page redesign, or onboarding changes.
- Provider/API calls, database records, IGDB matching, persistent demo state, or using the owner's real catalog or recommendations.
- Changes to recommendation ranking, recommendation events, or real data import.
- Bundling copyrighted cover-art files locally or adding a new artwork provider.

## Build loop

- Work on `feature/sign-in-introduction-demo`, not `main`.
- Review each checked build step with the owner before starting the next step. Checkpoint commits are not configured.
- Run `pnpm test` for any new pure helper logic and run `pnpm typecheck` plus `pnpm build` for each completed UI step. Do not commit without approval.

## Build steps

- [x] 1. Revise the focused client-side sign-in demo component with typed static curated records and a deterministic cover fallback. Reuse the existing visual-preference context and carousel helper for cycling, pause, controls, reduced-motion behavior, and reduced-data artwork suppression. Use clear product language without labels such as "example signal", "illustrative image", or generic metadata wording; state that the demo is a preview without claiming to have analyzed user data.
  - Done when every approved game can show a title-only fallback after remote-art failure or reduced-data mode; Cult of the Lamb showcases handheld suitability, Half-Life 2 shows an app-real ProtonDB compatibility badge, Grand Theft Auto V replaces Fortnite, and discounted wishlist NieR:Automata explains the Buy recommendation. The tracking UI uses actual app fields, omits the `Not started` flag, includes a Play soon tag, and shows genres plus personal tags where appropriate. Labelled previous/next controls and a polite current-position announcement remain available. `pnpm test` passes for any new pure helper, and `pnpm typecheck` passes.

- [x] 2. Compose the signed-out `/` page around the brand mark, approved tagline, unchanged Google sign-in action, and the revised demo component in a responsive layout. Preserve the current authenticated redirect; place the demo alongside sign-in on desktop and below the primary sign-in card on mobile.
  - Done when signed-out users see the branded sign-in action and clear three-stage product story at desktop and mobile widths, authenticated users still redirect to `/today`, and sign-in remains the first mobile action. `pnpm typecheck` and `pnpm build` pass.

- [x] 3. Review the completed sign-in entry point in a browser across desktop and mobile widths with full and reduced-motion/reduced-data preferences. Confirm keyboard access, focus visibility, image fallback, manual reduced-motion controls, the three-stage story, and that submitting sign-in still begins the existing Google flow.
  - Done when the observable UI criteria above are captured as browser evidence and `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Files / areas

- `src/app/page.tsx` - signed-out page composition; preserve the existing session redirect and Google sign-in server action.
- `src/components/auth/SignInIntroductionDemo.tsx` (new) - client-side static demo, compact game-card-lite presentation, visual-preference behavior, artwork fallback, and accessible controls.
- `src/components/ui/detail-hero-art.tsx` and `src/components/ui/artwork-backdrop.tsx` - reuse the existing hero-art treatment and optionally report an image failure so the demo can fall back safely.
- `src/components/preferences/VisualPreferencesProvider.tsx`, `src/lib/visual-preferences.ts`, and `src/app/layout.tsx` - default the unconfigured experience to dark Sunset while retaining explicit stored choices.
- `src/lib/carousel.ts` and `src/lib/carousel.test.ts` - reuse as-is where sufficient; update only if a new pure demo-specific behavior cannot be expressed with the existing helper.
- `public/dragon-icon.svg` and `src/app/globals.css` - reuse the existing brand mark and tokens; add narrowly scoped styling only if Tailwind utilities cannot express the needed accessible decorative treatment.

## Data / contracts

- Demo data is a code-owned, read-only TypeScript constant with exactly the five approved titles. It has no database/API contract and never reads or writes user data.
- Each record contains the display name, remote cover URL, deterministic fallback identifier, manual/Steam import copy, personal-tracking and backlog-progress copy, actual supported signal labels, and a static play or buy recommendation reason. The content must present a product preview, not a result from the owner's real recommendation engine.
- Remote image loading is optional presentation only: reduced-data mode must make zero demo-art image requests, and an image load failure must preserve the demo's title and narrative through its local token/gradient fallback.
- The demo is decorative supporting content. Authentication, authorization, redirect behavior, and the Google form action remain server-owned in `src/app/page.tsx`; no client-supplied identity is introduced.

## Testing

- Add or extend Vitest coverage only for any new pure demo helper or changed carousel behavior, including cycling wraparound and the full-motion/reduced-motion pause decision.
- UI component rendering is verified through the production build and browser review, not brittle component unit tests.
- Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before the final review.

## Notes for the AI

- Use Tailwind semantic tokens and existing Cinzel/Inter typography. Keep the playful, adventurous voice on expressive demo copy, but keep sign-in and any error/operational text plain.
- Do not add inline styles, new packages, API routes, server fetches, migrations, or stored state.
- Do not use the demo to imply that any listed title is owned by the user or is an actual recommendation.
- Retain readable contrast and visible focus states in all theme families. The existing pre-paint preference setup and `VisualPreferencesProvider` are the source of truth for reduced-motion and reduced-data behavior.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8165,"specSha256":"fdc5ea591b967b95019e357d7590fd96869907ff978cbd0d0a82c7b76c0ecdbf","branch":"refs/heads/feature/sign-in-introduction-demo","head":"8c354e897e7d24b6930cf37e46fb6cd288b59dd7","baseRef":"refs/heads/main","baseCommit":"8c354e897e7d24b6930cf37e46fb6cd288b59dd7","sourceTree":"6760dcd304c64574e09d77ae0482dc0ad314807d","absentOptional":[]} -->

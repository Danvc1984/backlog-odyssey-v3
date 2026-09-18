# Feature: Today recommendation spotlight carousels

**From build-plan:** feature 29
**Build attempt:** 1
**Branch:** `feature/today-recommendation-spotlight-carousels`

## Goal

Replace Today’s Play Next and Buy recommendation grids with accessible spotlight carousels, keep both general-fit picks, add Handheld without suppressing another role, and unify every recommendation surface around one durable dismissal-and-replacement action.

## Design reference

Use the established application design system and the approved visual direction in `blueprint/reference/reference material.png` and the other `blueprint/reference/reference material *.png` files. This is not a pixel-copy task: retain the current Dawn/Sunset tokens, typography, responsive shell, artwork fallbacks, reduced-data behavior, focus treatment, and card language while changing recommendation composition.

## In scope

- Keep Play Next roles in this display order when qualified: Best Fit, You Might Also Enjoy, Out of the Box, Change of Pace, and Handheld.
- Make Handheld additive so a configured handheld can produce five Play Next items rather than replacing the second Best Fit or suppressing Change of Pace.
- Label `BEST_FIT_2` as `You Might Also Enjoy` for both Play Next and Buy.
- Preserve Buy’s existing normal and deal-saturation role composition.
- Omit unqualified roles silently from recommendation presentation without placeholders or role-omission notices.
- Replace Today’s Play Next and Buy grids with one spotlight carousel per section.
- Pair artwork with the item name, role, existing recommendation metadata, and ordered reasoning.
- Show the first four prepared factors/caveats and place the remainder in an accessible disclosure.
- Make `View details` the primary action; keep `Start playing` secondary for Play Next.
- Auto-advance recommendation carousels every 10 seconds, pause for hover, focus, touch, manual navigation, or another interaction, and resume afterward.
- Disable recommendation auto-advance under the existing resolved reduced-motion preference.
- Replace neutral rotation, separate dismissal, and dismissal-reason input across Today, Game Detail, and Wishlist Detail with `Maybe some other time — show me another`.
- Record one durable dismissal, replace from the same retained role batch, and remove the role item when no replacement is available.
- Preserve cumulative calibration and exposure cooldown behavior.
- Make the selected provider name in the Wishlist Detail hero link to the selected external offer.

## Out of scope

- Feature 30 play-state and prior-completion changes.
- Feature 31 personal-data, notes, availability, or export/import simplification.
- Feature 32 tag and collection changes.
- New recommendation factors, scoring weights, eligibility rules, deal-saturation thresholds, Tune behavior, or provider calls.
- Recommendation schema changes or removal of historical `ROTATION` event rows.
- Changes to Currently Playing, Featured Offers, Steam activity, data health, or provider-operation sections.
- Deployment, cron, CI, or unrelated visual redesign.

## Build loop

Implement one checked step at a time. After each step, run its focused tests, show the diff and done-when evidence, and wait for review before continuing. Checkpoint commits are optional and require approval. `/complete` owns the final feature commit and merge flow.

## Build steps

- [ ] 1. Make role assignment and labels match the five-role contract.
  - Update play-role assignment so both Best Fit roles remain, Handheld is additive, and Change of Pace is still selected independently when candidates exist, including cold start.
  - Preserve unique displayed candidates, role-specific retained batches, second-chance constraints, readiness floors, and Buy saturation behavior.
  - Change `BEST_FIT_2` presentation to `You Might Also Enjoy` for both engines.
  - Add focused role-assignment and label tests for handheld/non-handheld, sparse pools, cold start, and Buy labels.
  - **Done when:** role tests prove a handheld run can contain five unique roles, sparse pools omit missing roles, non-handheld behavior remains valid, and `pnpm test` passes the affected recommendation tests.

- [ ] 2. Replace separate dismiss and rotate mutations with one authenticated dismissal-and-replacement contract.
  - Add a strict Zod-validated Server Action accepting only `runId`, `role`, and `itemId`; derive the recommendation kind and target from the persisted run item rather than trusting client target IDs.
  - Require the allowed authenticated user and verify that the item belongs to the supplied run and role.
  - In one Prisma transaction, create exactly one `RecommendationFeedback`, choose an eligible same-role replacement using the existing exposure cooldown, consume that candidate from retained batches, and either update the item or delete it when no replacement exists.
  - Return a stable `{ dismissedItemId, replacement }` result where `replacement` is the existing rotatable item shape or `null`.
  - Keep dismissal telemetry and replacement exposure telemetry fail-soft after the authoritative transaction. Stop generating neutral rotation telemetry from user-facing recommendation controls.
  - Remove dismissal reason from the action input and callers without requiring a schema migration for historical event data.
  - Return friendly errors for invalid input, missing/stale items, concurrent changes, denied access, and unexpected failures without partially recording calibration.
  - Add Server Action tests for replacement, exhausted batches, cooldown exhaustion, persisted batch consumption, atomic failure, invalid ownership of run/role/item, authentication failure, and exactly one dismissal count.
  - **Done when:** action tests prove dismissal and replacement/removal are one durable operation, reload-safe run state is correct, failures leave the recommendation and calibration unchanged, and the focused action test suite passes.

- [ ] 3. Build the shared spotlight slide and apply the unified action to every recommendation surface.
  - Refactor the current recommendation card/rotation wrappers into one focused interactive slide/card that can replace its item in place or notify its parent that the role is exhausted.
  - Render role, name, artwork, existing metadata, the first four ordered factors/caveats, and an accessible disclosure for the remainder.
  - Provide a primary `View details` link, secondary `Start playing` for Play Next, and the single dismissal-and-replacement control with clear pending and error feedback.
  - Remove the optional reason UI, neutral `Show another`, and separate `Dismiss` controls from Today, Game Detail, and Wishlist Detail; remove obsolete wrappers only after all callers use the shared component.
  - Keep user-controlled names and factor labels rendered as React text, preserve deterministic/reduced-data artwork fallbacks, and retain current deal-glow rules where applicable.
  - Link the Wishlist Detail hero’s selected provider name to the persisted selected-offer URL using safe external-link attributes; render the existing non-linked sentence when no usable selected offer exists.
  - **Done when:** every recommendation surface exposes the same single feedback action, View details is primary, Play Next retains Start playing, extra reasoning is keyboard-accessible, provider navigation works only with a valid selected offer, and `pnpm typecheck` passes.

- [ ] 4. Compose Today’s Play Next and Buy spotlight carousels.
  - Add a recommendation-specific carousel or safely extend the shared carousel without changing the existing six-second timing of unrelated carousels.
  - Use the approved role order and include all Buy deal items produced by the stored run; sparse runs produce fewer slides and zero-role runs keep their existing section-level empty state.
  - Auto-advance every 10 seconds and restart the timer after transient interaction pauses. Pause on hover, focus within, touch/pointer interaction, previous/next controls, slide actions, and expanded reasoning; remain manual while reduced motion is active.
  - Provide visible previous/next controls, position status, keyboard/focus behavior, appropriate labels, and polite announcements without moving focus on automatic advance.
  - Remove Today’s role-omission messages while preserving setup-level play-exclusion explanations.
  - Record exposure when a slide actually becomes visible, including auto/manual navigation and replacements, instead of recording every hidden carousel item on initial render.
  - Ensure replacing or removing the active slide keeps the index valid and does not leave an empty or lopsided container.
  - Add focused pure tests for carousel timing/index helpers and exposure-selection logic where wrong answers are possible.
  - **Done when:** Today shows one responsive carousel per recommendation kind, each cycles through only stored qualified items in the correct order, interaction and reduced-motion rules are observable, sparse/exhausted state stays coherent, and focused tests plus `pnpm typecheck` pass.

- [ ] 5. Verify the complete feature.
  - Run `pnpm typecheck`, `pnpm test`, and `pnpm build` because no project Verify command is configured.
  - In the running app, check desktop and mobile layouts in Dawn/Sunset and light/dark modes; keyboard navigation; focus visibility; 10-second advance; pause/resume; reduced motion; sparse roles; five-role handheld runs; normal and saturated Buy runs; successful replacement; exhausted-role removal; error recovery; Game Detail and Wishlist Detail feedback; and the external provider link.
  - Confirm no unrelated carousel timing changed and no hidden recommendation is counted as exposed before becoming visible.
  - **Done when:** all automated checks pass and the live review demonstrates the approved behavior without console errors, inaccessible controls, clipped reasoning, stale slides, or regressions on non-recommendation carousels.

## Files / areas

- `src/app/(app)/today/page.tsx` - Today queries, role ordering, empty states, carousel composition, omission display, and exposure wiring.
- `src/components/recommendations/RecommendationItemCard.tsx` - shared recommendation presentation and feedback behavior.
- `src/components/recommendations/ShowAnotherButton.tsx` and `PlayNextRailCard.tsx` - existing wrappers to consolidate or remove when no longer referenced.
- `src/components/recommendations/RecommendationRoleLabel.tsx` - Best Fit and You Might Also Enjoy labels.
- New or existing recommendation carousel/slide components under `src/components/recommendations/`.
- `src/components/ui/Carousel.tsx` and `src/lib/carousel.ts` only if a backward-compatible configurable timing/pause seam is preferable to a recommendation-specific carousel.
- `src/components/preferences/VisualPreferencesProvider.tsx` - consume the existing resolved reduced-motion state; do not create another preference.
- `src/actions/recommendations.ts` - authoritative dismissal-and-replacement mutation.
- `src/lib/recommendations/roles.ts` and `src/lib/recommendations/run-pipeline.ts` - additive role assignment and retained batches.
- `src/app/(app)/games/[id]/page.tsx` and `src/app/(app)/wishlist/[id]/page.tsx` - non-Today recommendation callers.
- `src/components/wishlist/WishlistDetailHero.tsx` - selected-provider external link.
- `src/actions/recommendations.test.ts`, `src/lib/recommendations/roles.test.ts`, existing carousel tests, and focused new tests as needed.
- `prisma/schema.prisma` - reference only; no migration is expected.

## Data / contracts

- Existing `RecommendationRole` values remain unchanged: `BEST_FIT_1`, `BEST_FIT_2`, `HANDHELD_PICK`, `OUT_OF_THE_BOX`, `CHANGE_OF_PACE`, and `DEAL`.
- `BEST_FIT_2` is presented as `You Might Also Enjoy`; stored role identity does not change.
- Recommendation carousel interval is `10_000ms`; unrelated carousels retain their current interval.
- The initial reasoning summary contains four items total from the repository’s existing prepared positive, negative, and caveat ordering; remaining items stay available in a disclosure.
- The unified action accepts `{ runId: string, role: RecommendationRole, itemId: string }` and returns the standard action envelope with `{ dismissedItemId: string, replacement: RotatedRecommendationItem | null }`.
- `replacement: null` means the persisted run item was removed and the UI must remove that slide/role.
- `RecommendationFeedback` is the authoritative calibration record. One successful action creates one feedback row for the persisted target and kind.
- Retained candidate batches remain in `RecommendationRun.context.roles.batches`; the selected replacement is removed from every relevant batch as the existing rotation path does.
- Recommendation-item replacement/removal, feedback insertion, and batch-context update are atomic. Telemetry remains non-authoritative and fail-soft.
- Server trust comes from `requireUser()` plus repository lookups. The client cannot choose the feedback target or recommendation kind independently of the stored run item.
- No new database fields, enums, provider requests, or migrations are required.

## Testing

- Unit-test five-role and sparse role assignment, cold-start behavior, candidate uniqueness, retained batches, and role labels.
- Contract-test the authenticated Server Action for valid replacement, no replacement, cooldown exhaustion, malformed input, stale/concurrent item, run/role mismatch, authorization failure, atomic rollback, and calibration count.
- Unit-test any extracted carousel timing, index normalization, pause/resume, and visible-exposure helpers with fake timers where applicable.
- Do not add brittle component-render tests. Use live browser evidence for responsive layout, keyboard operation, auto-advance, reduced motion, disclosure behavior, and cross-surface integration.
- Final automated gate: `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Notes for the AI

- Preserve current recommendation scoring, Tune semantics, Buy saturation, exposure cooldown duration, and calibration thresholds.
- Prefer one shared client presentation and one authoritative Server Action over duplicating Today, game-detail, and wishlist-detail behavior.
- Keep server components responsible for loading run data; client components own carousel state and interactions.
- Do not trust client-supplied target IDs. Resolve the current item inside the authenticated mutation and guard against stale or concurrent updates.
- Do not display stored role-omission explanations, but keep setup-level hard-exclusion explanations visible.
- Reuse semantic tokens and current artwork helpers. Do not add raw palette values or a new carousel library.
- The missing `blueprint/config.json` means the repository’s documented review-per-step and optional-checkpoint defaults apply.

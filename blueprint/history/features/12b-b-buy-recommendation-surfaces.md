# Feature: 12b-b - Buy recommendation surfaces

**From build-plan:** feature 12b-b (sub-item of 12b, Buy recommendations)
**Status:** not started

## Goal

Make persisted BUY recommendations visible and actionable on Today and the
corresponding wishlist detail page. Each result must show its score,
explanations, caveats, and an in-run dismissal without changing the stored run.

## In scope

- Generalize the existing recommendation card so it safely renders either a
  catalog-game PLAY_NEXT item or a wishlist-entry BUY item.
- Render the newest BUY run on `/today`, including first-run and empty-run
  states.
- Render the current entry's item only when it appears in the newest BUY run on
  `/wishlist/[id]`.
- Reuse the existing authenticated `dismissRecommendation` action with a BUY
  target, hiding a dismissed card locally until reload.

## Out of scope

- Buy scoring, eligibility, offer selection, or price refresh behavior: 12b-a
  is complete.
- Showing BUY cards on the wishlist list page or adding a new recommendation
  run action.
- Candidate batches, `Show another`, role labels, weighted rotation,
  deal-saturation display, or richer tuning: 12c.
- Dismissal-counter calibration: 12d.
- Any new visual system or prototype work. This extends the existing
  recommendation-card styling.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at
   the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Generalize the recommendation card** - Refactor
  `RecommendationItemCard` to receive one discriminated display target:
  `PLAY_NEXT` with a `gameId` and `/games/[id]` link, or `BUY` with a
  `wishlistEntryId` and `/wishlist/[id]` link. Keep existing factor/caveat
  chips and client-local dismissal; pass the matching target and kind to the
  existing action. *Done when:* existing play-next cards retain their current
  appearance and action payload, and a BUY card links to its wishlist entry,
  stores a BUY dismissal feedback row, shows a success toast, and disappears
  until reload.
- [x] **Step 2 - Render BUY results on Today** - Load the latest BUY run with
  its wishlist-entry references and render its cards in Today. Keep a clear
  first-run note and add a distinct empty-run note when a BUY run exists but
  has no items. *Done when:* the newest run renders each BUY item once with
  rank, score, factors, caveats, a wishlist link, and dismiss control; no run
  says no recommendations exist yet; an empty latest run says no eligible
  wishlist purchases exist; no catalog-game item can render in this section.
- [x] **Step 3 - Add the wishlist-detail recommendation block** - Fetch the
  newest BUY run and select its item for the viewed wishlist entry, then render
  the reusable card below the offer area only when that item exists. *Done
  when:* a recommendation appears only for an entry included in the newest
  BUY run, retains factors/caveats/dismiss behavior, and absent/empty/latest-run
  non-membership leaves the detail layout unchanged.
- [x] **Step 4 - Browser verification and regression gate** - Verify both
  surfaces against persisted BUY data, including dismissal and reload behavior,
  then run the documented checks. *Done when:* a live authenticated walkthrough
  proves Today and wishlist-detail rendering and confirms dismissal hides only
  the current client view while reload restores the persisted result; `pnpm
  test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`
  pass.

## Files / areas

- `src/components/recommendations/RecommendationItemCard.tsx`
- `src/app/(app)/today/page.tsx`
- `src/app/(app)/wishlist/[id]/page.tsx`
- Existing `src/actions/recommendations.ts` is reused, not changed unless an
  actual action-contract gap is demonstrated.
- No Prisma migration or provider integration changes.

## Data / contracts

- **Card target contract (load-bearing):** client props are a discriminated
  union. A PLAY_NEXT card receives exactly `gameId`, uses kind `PLAY_NEXT`, and
  links to `/games/[id]`; a BUY card receives exactly `wishlistEntryId`, uses
  kind `BUY`, and links to `/wishlist/[id]`. Never pass both target IDs.
- **Latest run rule:** each surface reads only the newest `RecommendationRun`
  of kind `BUY`, ordered by `createdAt` descending. The wishlist detail first
  finds that run, then selects its item for the current `wishlistEntryId`; it
  must not query the newest matching item across all historical runs.
- **Item rendering:** BUY cards use the persisted `rank`, `score`, `positive`,
  `negative`, and `caveats` JSON from `RecommendationItem`, plus the related
  wishlist entry name. Ignore malformed/null target references defensively
  rather than crashing the page.
- **Dismissal:** preserve 12a semantics. It creates one
  `RecommendationFeedback` row with `kind: BUY` and the `wishlistEntryId`, then
  removes only that card from local state. It does not delete/update the run,
  rescore candidates, refresh prices, or create a negative preference.

## Testing

This feature changes UI composition and reuses already-tested server-action
validation, so no new unit test is expected unless implementation introduces
new pure logic.

- `pnpm build` proves the server/client prop boundary and Prisma query types.
- Manual authenticated browser proof covers no-run, populated BUY run, empty
  BUY run, direct wishlist-detail membership/non-membership, the BUY link, and
  dismissal then reload.
- Full regression gate: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm
  build`, and `git diff --check`.

## Notes for the AI

- Server components remain the default. Only the card stays client-side for its
  local dismissal state and toast.
- Follow existing Tailwind card and factor-chip styling. Do not introduce a new
  design language or duplicate the card for BUY.
- Fetch data directly in server pages with Prisma. The app is single-user, but
  preserve the existing protected-route/auth boundary.
- Reuse the action's `{ success, data, error }` response and show user-facing
  errors through Sonner.
- The current Today page has a BUY-run placeholder. Replace it only in Step 2;
  do not alter the PLAY_NEXT query or cards beyond the target-aware prop update
  in Step 1.
- No em dashes in code, comments, or UI strings.

## Findings

_None resolved by this feature. Preserve the live findings ledger state._

# Fix: Recommendation and interaction polish batch

**Type:** Fix
**Status:** verified
**Branch:** `fix/recommendation-and-interaction-polish`
**Fixes:** F-01, F-02, F-05, F-06, F-11, F-16

## The problem

Several owner-facing flows are unreliable or unclear:

- A failed recommendation update needs an understandable recovery path without losing the last valid result.
- Recent Steam activity does not clearly distinguish a fresh empty result from a stale cache after a provider failure.
- Compatibility evidence is repeated or does not clearly identify the configured target device.
- Some copy reveals implementation details or repeats equivalent empty-state guidance.
- Tune opens with controls that look active before the owner makes a choice.
- The Wishlist and Add Game forms waste space and do not consistently group related controls.
- Handheld-enabled recommendation lists replace a second Best fit with a Handheld pick and still show Change of pace.
- When no handheld-suitable candidate qualifies, the handheld role currently produces an omission message instead of a Change of pace recommendation.

## The fix

Preserve valid cached recommendation and activity data on provider failures, then make the relevant recovery state actionable. Present compatibility once per relevant configured Linux target, with a separately labeled Windows fallback only when applicable. Simplify owner-facing copy, reset Tune to a collapsed neutral state, align the two manual-entry forms with established responsive form patterns, and always show two Best fit recommendations while using Handheld pick in place of Change of pace when a handheld is configured, falling back to Change of pace when no handheld-suitable candidate qualifies.

Do not change the planned availability, notes, tag, collection, or play-history data-model work in features 29 through 31.

## Build steps

1. **Recommendation and Steam-activity recovery**
   - [x] Reproduce and identify the confirmed failure paths for recommendation updates and recent Steam activity.
   - [x] Preserve the most recent usable recommendation run and activity cache when a refresh fails.
   - [x] Distinguish fresh-empty activity from stale-on-error activity and provide useful retry or sync guidance.
   - [x] Add focused tests for the confirmed server-side recovery behavior.
   - **Done when:** failed refreshes leave prior valid data visible, fresh empty data is not presented as an error, and the relevant focused tests pass.

2. **Compatibility presentation and Tune defaults**
   - [x] Render Linux compatibility evidence once for its relevant configured target devices.
   - [x] Render Windows fallback in a separate labeled row only when configured and relevant.
   - [x] Start Tune collapsed with neutral choices and no selected filters; keep preset loading explicit.
   - **Done when:** detail views no longer duplicate compatibility evidence or obscure its target, and opening Tune shows no active-looking constraints.

3. **Owner-facing copy and form composition**
   - [x] Remove implementation-oriented and duplicate empty-state copy in the affected surfaces, retaining meaningful outcomes and next actions.
   - [x] Recompose the Wishlist add form using the Library form's established grouping without adding catalog-only availability controls.
   - [x] Group Interest with Availability in Add Game where responsive space permits.
   - [x] Ensure recommendation roles always include two Best fit items; when a handheld is configured, show Handheld pick instead of Change of pace, falling back to Change of pace when no handheld-suitable candidate qualifies.
   - **Done when:** affected copy is concise and action-oriented, the Wishlist form matches the established form hierarchy, Add Game groups related controls responsively, and handheld-enabled recommendations retain two Best fit items, show a Handheld pick when available, and otherwise show Change of pace.

## Verify

- Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- In the running app, trigger or simulate the confirmed recommendation and Steam-activity failure paths and confirm usable cached content and recovery guidance remain visible.
- Review catalog and wishlist compatibility with Linux and Windows-fallback configurations.
- Open Tune from each recommendation tab and confirm it starts collapsed and neutral; load a preset and confirm it remains an explicit action.
- Review the affected empty states and both manual-entry forms at narrow and wide viewport widths.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4509,"specSha256":"3cef9403d8b213b6c1aacf4465094ca8f614e2906f752bb5cde5475532c8aa2e","branch":"refs/heads/fix/recommendation-and-interaction-polish","head":"cad9f0fe4bcd7007d7e2357bd1af70a0dc6e012f","baseRef":"refs/heads/main","baseCommit":"cad9f0fe4bcd7007d7e2357bd1af70a0dc6e012f","sourceTree":"458455ecf36f8270ec74669337027e4f9e2d8bc1","absentOptional":[]} -->

## Manual try guide

1. **Start:** Run `pnpm dev` from the project root, or reuse the existing server at `http://localhost:3500`.
2. **Open:** Visit `http://localhost:3500/today`.
3. **Do:** Click **Update recommendations**. Also review the Play These Next and Recommended Purchases sections, open Tune, and inspect the Add Game and Wishlist forms from their respective routes.
4. **Expect:** A refreshed Play These Next list keeps two Best fit cards. With handheld mode enabled, a suitable game appears as Handheld pick and Change of pace is absent; when no suitable game exists, Change of pace appears instead and no handheld omission message is shown. Add Game availability is a dropdown limited to Steam, ROM, and active Settings sources, with no Display name field. Wishlist has no availability controls.
5. **Watch For:** Old recommendation runs may retain previous role assignments until **Update recommendations** is completed. At narrow and wide widths, controls should remain grouped and usable without horizontal overflow.

**Best signal:** Refresh recommendations on Today and confirm the four-card role sequence for a handheld-enabled setup, or the Change of pace fallback when no handheld candidate qualifies.

**Optional deeper checks:** Open a game detail page and wishlist detail page to review the compatibility presentation, then expand Tune and verify it starts collapsed and neutral.

**Gaps:** Manual verification requires the app's configured database, account session, and recommendation candidates.

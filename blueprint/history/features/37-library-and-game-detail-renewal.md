# Feature: Library and game-detail renewal

**From build-plan:** feature 37
**Build attempt:** 1
**Branch:** `feature/library-and-game-detail-renewal`
**Status:** verified

## Goal

Make Library and Game Detail easier to navigate and maintain without changing catalog, personal-data, compatibility, or provider rules. Correct the Library backlog-progress display so a currently completed game contributes to the completed numerator.

## In scope

- Reorder Game Detail into hero, details, personal data, tags, platforms, DLC, compatibility when active, artwork, and delete.
- Improve the existing personal-data presentation and move or rename its controls where the reordered page makes that clearer, including a visible hidden flag and a "Planned for my handheld" marker presented with the journey controls.
- Combine catalog-title maintenance with the existing IGDB enrichment controls while preserving manual title updates and explicit IGDB-title application.
- Add a single primary hero action for base games, "Update play state / edit data", backed by the combined personal-data card; keep secondary destinations in a compact More actions menu.
- Add hero links to the page's actionable sections, respecting base-game, DLC, and Linux-compatibility gating.
- Tint the destructive Delete action red while retaining the existing confirmation and Undo behavior.
- Remove redundant success feedback from the affected detail controls without weakening error feedback.
- Refresh duplicate review compatibility presentation and preserve semantic availability deduplication during duplicate merges.
- Make a Library ProtonDB badge navigate to that game's compatibility section.
- Fix the Library health-strip backlog progress for completed games.

## Out of scope

- Prisma schema, migrations, provider contracts, enrichment queue behavior, recommendation scoring, or compatibility synthesis changes.
- Changes to the separate Wishlist Detail, Today dashboard, Settings source administration, or card filtering behavior.
- New duplicate-match rules, automatic merges, or changed Undo semantics.
- New browser-test infrastructure.

## Build loop

1. Create `feature/library-and-game-detail-renewal` from `main` after this spec is approved.
2. Implement one checked build step at a time and present its diff and focused evidence for review before continuing.
3. Run `pnpm test` for logic-bearing steps. Finish with `pnpm typecheck`, `pnpm test`, and `pnpm build`; no umbrella Verify command is currently declared.
4. Do not commit, merge, push, or deploy during this feature loop without separate approval.

## Build steps

- [x] 1. Recompose Game Detail around its intended section order and navigation.
  - Put the existing metadata/details surface directly after the hero; retain the existing base-game and DLC gates for personal data, tags, platforms, DLC, compatibility, screenshots/artwork, and deletion.
  - Keep one primary base-game action, "Update play state / edit data", targeting the combined personal-data card. Place title, tags, platforms, DLC, compatibility, artwork, and delete destinations in a compact accessible More actions disclosure; keep only actions whose sections render for the current game and setup.
  - Keep hash targets keyboard-focusable and preserve their target/focus treatment.
  - **Done when:** a base-game detail page presents hero, details, personal data, tags, platforms, DLC, applicable compatibility, artwork, and delete in that order; a DLC and an all-Windows setup omit inapplicable controls and links; hash links land on the matching visible section.

- [x] 2. Consolidate title and IGDB maintenance, and refine personal-data controls.
  - Move the existing manual title form into the IGDB maintenance area so manual edits, match review, refresh, and explicit "Use IGDB title" remain available together without changing their server-action contracts.
  - Reorganize the existing Journey and Preferences controls for clearer scanning, retaining labels, information popovers, validation, server-side auth, and current play-state effects. Include the hidden flag and move the handheld marker into the same visually distinct journey-marker group, labeling it "Planned for my handheld".
  - Remove redundant section status and enrichment success messaging while leaving one success confirmation per completed user action and retaining inline and toast error feedback.
  - **Done when:** manual title updates and IGDB title application remain independently available from one maintenance area; personal data remains editable with its existing values and accessible labels; an affected successful action produces one confirmation, while failure remains clearly announced; the base-game hero exposes one primary "Update play state / edit data" action and a compact More actions menu.

- [x] 3. Improve Library cards and duplicate review without changing merge safety.
  - Make each rendered Library ProtonDB badge a link to `/games/[id]#compatibility` while retaining its existing compatibility gating and visible tag state.
  - Refresh duplicate-review presentation so the two candidate games, match evidence, compatibility differences, merge action, and dismiss action are understandable and keyboard-operable.
  - Confirm duplicate merging treats semantically identical Steam, ROM, and saved alternative-source availability as one platform, preserves the most informative Steam statistics, and keeps distinct platforms.
  - **Done when:** an eligible ProtonDB badge takes the owner to its game compatibility section; duplicate review exposes the existing actions and relevant comparison data accessibly; merge planning deduplicates identical platform assignments without losing Steam playtime or distinct platform rows.

- [x] 4. Correct Library backlog progress and add focused coverage.
  - Correct the health-strip input or display so a current `COMPLETED` game is counted as completed progress, with abandoned and prior-completion-only behavior unchanged.
  - Add or update unit coverage for the progress calculation and platform-merge semantics; keep component behavior covered by the manual browser path and build.
  - **Done when:** Library shows completed games in its `completed / total` backlog-progress value; abandoned games remain excluded and `completedBefore` alone does not increase current completion; focused Vitest coverage proves completed progress and platform deduplication edge cases.

## Files / areas

- `src/app/(app)/games/[id]/page.tsx` - detail query composition, section order, gates, and anchors.
- `src/components/games/GameDetailHero.tsx` - conditional actionable section links.
- `src/components/games/GameNameForm.tsx`, `src/components/games/IgdbEnrichmentPanel.tsx` - consolidated title and IGDB maintenance, feedback ownership.
- `src/components/games/PlayStateSection.tsx`, `src/components/games/PersonalFieldsForm.tsx` - personal-data presentation and success feedback.
- `src/components/games/LibraryGameCard.tsx`, `src/components/games/ProtonDbTag.tsx` - compatibility badge navigation.
- `src/components/games/DuplicatesList.tsx`, `src/components/games/MergeGamesDialog.tsx` - duplicate-review presentation.
- `src/lib/catalog-operations.ts`, `src/actions/catalog-operations.ts` - availability deduplication and merge execution, only if inspection confirms a defect.
- `src/lib/today-data-health.ts`, `src/components/games/LibraryHealthStrip.tsx` - current backlog-progress calculation and presentation.
- Adjacent `*.test.ts` files - focused logic coverage.

## Data / contracts

- No schema or migration is planned.
- Continue to use current authenticated server actions and Zod validation for title, personal-data, availability, and merge mutations. Never trust client identity.
- Preserve `LibraryEntry.playState` as the sole source for active backlog progress: `COMPLETED` contributes to completed and total, `NOT_STARTED` and `IN_PROGRESS` contribute to total, `ABANDONED` is excluded, and `completedBefore` alone does not count.
- Preserve availability identity used by duplicate merge: Steam rows are equivalent by Steam App ID, ROM is one built-in source, and alternative platforms are equivalent by `alternativeSourceId`. Retain maximum Steam playtime and newest Steam last-played value when merging duplicate Steam rows.
- Do not render or link compatibility where the existing compatibility gate is inactive, and do not add compatibility UI for a game without the existing eligible evidence state.

## Testing

- Add or update Vitest tests beside `src/lib/today-data-health.ts` for completed, abandoned, and prior-completion-only progress.
- Add or update tests beside `src/lib/catalog-operations.ts` or `src/actions/catalog-operations.ts` for identical and distinct availability rows and Steam-stat retention.
- Run `pnpm test` for logic-bearing steps, then `pnpm typecheck`, `pnpm test`, and `pnpm build` before `/complete`.
- Manual browser review after implementation: navigate Library cards with a ProtonDB badge, review a duplicate pair, use detail-page anchors, edit title and personal data, and check base-game, DLC, Linux, and all-Windows states.

## Notes for the AI

- Preserve existing semantic tokens, responsive patterns, `SectionCard`, accessibility labels, focus handling, and dark/light theme behavior.
- Use `Link` for internal navigation. Do not add browser APIs to server components.
- Do not turn the existing availability editor into source administration. Saved source creation, rename, and archival remain in Settings.
- Keep the current error shape, `{ success, data, error }`, for server actions. Avoid unrelated refactors and do not duplicate feedback between a child control and its parent.
- The active test gate is `pnpm test`; UI-only changes rely on the manual browser path plus build evidence.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9816,"specSha256":"5922f43e29c165f84f9beb098bb18843df0936cf868cf81c2233d7e0d8a34451","branch":"refs/heads/feature/library-and-game-detail-renewal","head":"afbff90a96b83c2668e9c2edffb5c034add4e36e","baseRef":"refs/heads/main","baseCommit":"afbff90a96b83c2668e9c2edffb5c034add4e36e","sourceTree":"e90fe2be94a4d8e9edde0d7f594a156048c5012d","absentOptional":[]} -->

## Manual try guide

### Start


tpnpm dev

Open http://localhost:3500 and sign in with the configured Google account.

### Review

1. Open /library and choose a game with a ProtonDB badge. Click the badge and expect /games/[id]#compatibility.
2. Open a base-game detail page. Confirm the primary hero action reads "Update play state / edit data".
3. Open More actions and confirm title, tags, platforms, DLC, compatibility, artwork, and red Delete actions are present only when applicable.
4. Open the personal-data section. Confirm Hidden from library and Planned for my handheld appear in the compact three-column marker grid.
5. Change a marker and a personal preference, then reload and confirm the values persist.
6. Open /library?duplicates=true and confirm both candidate compatibility summaries and existing merge and dismiss actions are visible.

### Watch for

- Duplicate success messaging in the IGDB panel.
- A Saved status pill above Personal data.
- Compatibility controls on an all-Windows setup.
- A missing red tint on Delete or a hero anchor that does not reach its section.

## Verification

- pnpm typecheck
- pnpm test (133 files, 1297 tests passed)
- pnpm build
- git diff --check

Browser review was not performed by the agent.

# Feature: Today taste setup and recommendation gating

**From build-plan:** feature 36
**Build attempt:** 1
**Branch:** `feature/today-taste-setup-and-recommendation-gating`
**Status:** verified

## Goal

Make Taste Setup the required, useful first source of recommendation signals: it starts only with a library of at least ten games, uses random choices, records independent personal signals, and keeps recommendation surfaces unavailable until it is saved. Remove the obsolete preferred-environment field and finish the specified Today visual cleanup.

## Design reference

`blueprint/reference/today-taste-setup-reference.png` is the visual reference for Tune's More filters. Its second-row controls and the personal-tag selector share the same plain field treatment. Remove the current tinted personal-tag container and its visual separator.

## In scope

- Gate Taste Setup on at least ten Library base games and randomize its selected games.
- Replace one exclusive answer with independent `Played before`, `Recommend more like this`, and `Would like to play soon` controls, plus a random non-negative replacement action.
- Persist prior completion, recommendation-learning evidence, and play-soon intent with the stated combined strong-signal rule.
- Hide and server-gate recommendation generation and display until Taste Setup is saved. Omit Buy recommendations when there are no wishlist entries.
- Remove preferred environment throughout the application and personal-data schema.
- Match More filters and personal tag shelf styling to the supplied reference.
- Allow personal-data import when the catalog and wishlist are empty but the app has initialized settings, sources, or recommendation state.
- Add a wishlist-wide IGDB re-enrichment flow for entries with and without existing metadata.

## Out of scope

- Changes to baseline recommendation ranking, retained role batches, Tune semantics, offer selection, or carousel behavior beyond the gating and empty-wishlist omission.
- A new recommendation profile model, new onboarding flow, or automatic recommendation generation.
- Any deployment, CI, push, or database reset action.

## Build loop

Work on `feature/today-taste-setup-and-recommendation-gating`. Implement one checked step at a time, show the focused diff and evidence for review, and wait for approval before the next step. Do not commit without approval. No project `verify` command exists, so the final automated gate is `pnpm typecheck && pnpm test && pnpm build`.

## Build steps

- [x] **1. Remove preferred environment as a personal field.** Remove its Prisma enum/field and create the Prisma migration with `prisma migrate dev`; remove validation, actions, exports/imports, profile derivation, environment-fit use, labels/help, merge handling, and every affected UI control. Preserve configured-device compatibility behavior and game experience.

  **Done when:** no application or export contract accepts or exposes `preferredEnvironment`; the generated Prisma client and migration are in sync; focused tests cover the affected personal-data/profile behavior; `pnpm typecheck` and `pnpm test` pass.

- [x] **2. Define and test the Taste Setup eligibility, random sampling, and persisted signal contract.** Make setup eligible only when the Library contains at least ten base games. Sample the selectable, non-hidden, non-main owned games without duplicate picks through a testable random seam. Treat prior completion as preselected state, persist `completedBefore` independently of current state, set `playSoon` independently, and record recommendation-interest evidence from the selected game metadata and personal data. A pick with both prior completion and recommendation interest must produce the documented stronger positive evidence. `Pick another` replaces from unused eligible games and records neither a negative event nor a negative personal-field change.

  **Done when:** unit tests cover the ten-game threshold, unique random replacement, preselected completion, independent combinations, strong combined signal, and no-negative replacement; invalid, hidden, DLC, duplicate, and insufficient-library submissions return the established safe action error shape; `pnpm test` passes.

- [x] **3. Build the accessible Taste Setup interface and recommendation gate.** Update Today to explain the ten-game requirement when setup is unavailable, show random selections when it is eligible, and use independently toggled, accessible controls with selected-state labels. Remove preferred environment and retain clarified game-experience selection. Prevent recommendation sections, Tune panels, empty-state update actions, and header update actions from rendering before setup is saved; enforce the same completion check in recommendation-update server actions. After setup, show Play Next normally and render Buy only when at least one wishlist entry exists, including when an earlier stored Buy run exists.

  **Done when:** saving Taste Setup refreshes Today and unlocks recommendation controls; a direct invalid recommendation-update request before completion is rejected; fewer than ten Library games expose no recommendation surface; an empty wishlist exposes no Buy surface; keyboard and screen-reader state identify every toggle and replacement action; focused action tests, `pnpm typecheck`, and `pnpm test` pass.

- [x] **4. Align Tune More filters with the reference.** Restyle the second row of More filters and the personal-tag selector to use the same neutral field treatment as the first row, removing the colored background and personal-tag shelf separator while preserving labels, any-match semantics, keyboard interaction, and responsive layout.

  **Done when:** the opened Tune panel has no tinted or separately bordered personal-tag shelf container, controls align with the reference at desktop and narrow widths, and the existing tag selection behavior remains intact; browser evidence is captured during `/check`, and `pnpm build` passes.

- [x] **5. Restore into an initialized empty catalog safely.** Let import proceed when only replaceable settings, alternative sources, tags, or recommendation state exist; continue refusing when games or wishlist entries exist. Clear the exported, replaceable domains inside the same transaction before restoring the validated document, preserving non-exported provider and authentication data.

  **Done when:** settings/source/recommendation rows alone do not block import; games or wishlist rows still return the established 409 error shape; replaceable rows are cleared in dependency-safe order before restore; focused import tests and the final automated gate pass.

- [x] **6. Re-enrich the wishlist through IGDB.** Add a wishlist-wide action that processes both entries without metadata and entries with existing metadata. Missing snapshots use the existing match flow; existing snapshots refresh through their persisted IGDB ID when one is available, with title/identity matching only as a fallback. Show progress, refresh the UI after completion, and keep per-entry failures from aborting the remaining work.

  **Done when:** Settings exposes one reachable bulk enrichment control; `/wishlist` does not expose that control; existing snapshots are replaced using their persisted IGDB ID when present; missing snapshots are filled through the normal enrichment path; DLC entries follow their existing DLC path; focused queue/action tests pass and the final automated gate passes.

- [x] **7. Repair independent-review findings.** Move Taste Setup replacement randomness behind the existing pure, testable random-selection seam so the client component passes the lint gate. Preserve the conservative DLC identity boundary in wishlist batch enrichment by omitting a missing persisted IGDB ID rather than passing `null`, and cover the no-Steam-ID, no-exact-relation DLC path.

  **Done when:** `pnpm lint` passes; the UI component does not invoke `Math.random()` directly; batch enrichment leaves `selectedIgdbId` absent for DLC entries with no persisted metadata ID; focused queue and DLC-enrichment tests cover the guard; F-01 and F-02 are marked `fixed` after their focused checks pass.

- [x] **8. Preserve prior completion for replacement picks.** Pass `completedBefore` for every Taste Setup candidate rendered by Today so replacing a pick retains the selected game's persisted prior-completion state.

  **Done when:** a replacement candidate with `completedBefore` set renders and saves with that signal preselected; focused Taste Setup coverage proves the random replacement helper preserves the source game; F-03 is marked `fixed` after focused checks pass.

## Files / areas

- `prisma/schema.prisma`, generated Prisma output, and a new Prisma migration.
- `src/actions/recommendations.ts`, recommendation update actions, and adjacent action tests.
- `src/lib/recommendations/taste-setup.ts`, profile/event helpers, recommendation pipeline inputs, data-health/export contracts, and focused tests.
- `src/app/(app)/today/page.tsx`, recommendation update affordances, and `src/components/recommendations/TasteSetupPanel.tsx`.
- `src/components/recommendations/TuneThisRunPanel.tsx`.
- Game-detail, merge, and personal-field help surfaces that still expose preferred environment.
- `blueprint/reference/today-taste-setup-reference.png`.
- `src/lib/import-restore.ts` and `src/app/api/import/route.ts`.
- `src/lib/wishlist-igdb-queue.ts`, wishlist IGDB actions, and the wishlist page enrichment control.

## Data / contracts

- Setup completion is durable recommendation-owned evidence, not client state. It is established only by a successful saved Taste Setup with at least one meaningful signal, and server-side recommendation operations must validate it.
- Library threshold counts Library base games. Random taste picks remain restricted to eligible non-hidden, non-main owned base games and never include DLC.
- A taste pick carries independent booleans for prior completion, recommend-more interest, and play-soon intent. Existing `completedBefore` initializes the first value. Saving `Played before` only sets `completedBefore`; it must not modify `playState`.
- `Recommend more like this` contributes a positive recommendation event/profile signal derived from the chosen game's existing metadata and personal fields. Pairing it with `Played before` has a stronger positive weight than either signal alone. `Would like to play soon` sets `LibraryEntry.playSoon`.
- Replacing a pick does not write an event, dismissal, interest reduction, or personal-field mutation.
- Preferred environment is removed from persistence and the export/import payload. No backward compatibility is needed because the pre-staging database will be rebuilt.

## Testing

- Add Vitest coverage next to Taste Setup and recommendation action/profile logic for all persisted and rejected states named above.
- Update or remove tests for preferred environment and adapt export/import fixtures to the new schema.
- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before the final review.
- Use `/check` after implementation for visual and live behavior against the provided reference.
- Add focused import-restore coverage for initialized singleton/recommendation state and preserve the all-or-nothing transaction boundary.
- Add focused wishlist enrichment coverage for filling missing snapshots and refreshing existing snapshots by their persisted IGDB ID.

## Notes for the AI

- Use the authenticated server action boundary and Zod validation. Never trust setup-completion, game IDs, or toggle values supplied by the browser.
- Keep current completion, prior completion, and replay rules intact. Do not make `Played before` change current play state.
- Keep manual interest authoritative. The stronger Taste Setup signal belongs in recommendation evidence/profile derivation, not by overwriting the stored interest value.
- Respect the existing no-`any`, Tailwind, accessible control, and user-facing action-error conventions.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12031,"specSha256":"34401d22ec40faddc09d157252ab789df6262ed0b5a97a631d0ea1808cbfbc40","branch":"refs/heads/feature/today-taste-setup-and-recommendation-gating","head":"50e8f20d77b98ff7e5ec47c3619ea3ec308bc36a","baseRef":"refs/remotes/origin/main","baseCommit":"dac7a9790722e67a203748c74f827d65ba3d5c7b","sourceTree":"00c59a46b5ded5436a0758cf2a3be7a00ff9ef94","absentOptional":[]} -->

## Findings

### 36/F-01 [P1] closed - Taste Setup replacement violates lint gate

**File:** src/components/recommendations/TasteSetupPanel.tsx:67
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** The React purity rule rejected direct Math.random usage inside the client component.
**Suggested fix:** Move random selection behind a pure helper or event-safe random seam.
**Resolution:** Independent review confirmed the component delegates replacement selection to selectRandomUnselectedItem; pnpm lint passes.

### 36/F-02 [P1] closed - Batch enrichment bypasses the conservative DLC match guard

**File:** src/lib/wishlist-igdb-queue.ts:37-44
**Found:** 2026-09-23 by /audit (scope: current; lens: security)
**Why it matters:** Passing null bypassed the established conservative DLC ambiguity guard.
**Suggested fix:** Omit selectedIgdbId when no persisted ID exists.
**Resolution:** Independent review confirmed the queue omits selectedIgdbId without a persisted ID and the focused DLC test reaches the guard.

### 36/F-03 [P1] closed - Replacing a Taste Setup game loses its persisted prior-completion state

**File:** src/app/(app)/today/page.tsx:280
**Found:** 2026-09-23 by /audit (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** Replacement candidates previously omitted completedBefore and could lose the persisted prior-completion signal.
**Suggested fix:** Pass completedBefore with every candidate and cover replacement behavior.
**Resolution:** Independent review confirmed Today supplies completedBefore and the replacement keeps the source game state.

## Independent review

**Status:** passed
**Target commit:** 50e8f20d77b98ff7e5ec47c3619ea3ec308bc36a
**Base commit:** dac7a9790722e67a203748c74f827d65ba3d5c7b
**Base ref:** origin/main
**Spec hash:** 34401d22ec40faddc09d157252ab789df6262ed0b5a97a631d0ea1808cbfbc40
**Prepared by:** codex
**Builder model:** unknown (runtime did not expose exact model)
**Requested reviewer:** codex
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-09-23T18:39:11Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** codex
**Reviewer model:** unknown (runtime did not expose exact model)
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-23T18:41:19Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- pnpm lint: pass
- pnpm typecheck: pass
- pnpm test: pass (133 files, 1295 tests)
- pnpm build: pass
- git diff --check base..target: pass

### Evidence

- Reviewed all code, migration, generated Prisma output, tests, configuration, and feature documentation in the target delta across quality, security, performance, and tests.
- Confirmed authentication, Zod validation, recommendation gating, import transaction clearing, wishlist batch behavior, and the replacement completion-state repair.

### Findings

- 36/F-01 closed
- 36/F-02 closed
- 36/F-03 closed
- No new findings

### Remaining risk

- No live browser/manual visual pass was run in this reviewer session; responsive rendering and supplied-reference comparison remain unobserved.

# Feature: Recommendation behavior renewal

**From build-plan:** feature 28
**Build attempt:** 1
**Branch:** feature/recommendation-behavior-renewal
**Status:** verified

## Goal

Renew Play Next behavior with a dedicated handheld role and a tab-local question-based Tune flow, while preserving the existing rotation, exposure, calibration, buy recommendations, and soft More-filter semantics.

## In scope

- Add a Handheld Pick Play Next role when a handheld is configured, selecting the highest-ranked play-eligible game explicitly marked handheld-suitable under the existing environment-fit rules.
- Omit the role and retain an observable explanation when no handheld-suitable candidate qualifies.
- Add a Handheld Tune toggle that strictly filters all Play Next roles to handheld-suitable games.
- Replace the current primary Tune controls with time, play-style, and familiarity choices. Keep the existing genres, tags, sequel posture, era, maturity, and source controls under More filters with their current soft, capped, any-match behavior.
- Keep active Tune state in browser tab session storage only. It survives a reload in that tab, is discarded when the tab closes, and affects a run only when the owner chooses Update recommendations.
- Keep named presets persisted, but load their values into tab-local state rather than server-side active tune state.

## Out of scope

- Changes to rotation, exposure cooldowns, calibration, recommendation-event retention, buy roles, compatibility or environment-fit rules, learned-profile calculation, or unrelated recommendation scoring.
- New browser-test infrastructure, deployment work, and deletion of the existing `RecommendationTuneState` storage model.

## Build loop

- Work one checked step at a time and present its diff and evidence for review before the next step.
- Add focused Vitest coverage with each logic-bearing step, then run `pnpm test` before requesting step approval.
- No configured `Verify` command exists. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` as the final automated gate.
- Do not commit without owner approval.

## Build steps

- [x] 1. Add the handheld role contract and assignment behavior.
  - Extend the Prisma recommendation-role enum and migration, generated role mappings, persisted role batches, rotation compatibility, labels, and Today role groups for `HANDHELD_PICK`.
  - Pass configured-handheld and `handheldSuitable` candidate information into role assignment. When a handheld exists, replace `BEST_FIT_2` with the highest-ranked qualifying handheld candidate without relaxing the existing eligibility or environment-fit filtering; omit the role and persist a clear role-empty explanation when no candidate qualifies. Keep the current second Best Fit when no handheld is configured.
  - Preserve non-overlapping displayed candidates and role-specific rotation batches.
  - **Done when:** a fresh Play Next run displays one Best Fit plus Handheld Pick on handheld setups when an eligible marked candidate exists, never displays Handheld Pick without a handheld, and visibly explains its absence when no eligible marked candidate exists; role assignment and pipeline tests cover selection, omission, fallback, and batches.

- [x] 2. Define and test the renewed Tune contract and candidate behavior.
  - Extend the validated Tune contract with time ranges `Any`, `Under 6h`, `6-20h`, `20-50h`, and `50+h`; play style `Any`, `Solo`, `Online with others`, and `Couch co-op`; familiarity `Familiar`, `Balanced`, and `Different`; and the Play Next-only handheld toggle.
  - Derive play-style eligibility from IGDB modes. Strictly exclude known conflicting modes, retain candidates with missing/unknown modes as caveated fallbacks, and preserve their stable ordering where no matching metadata exists.
  - Implement familiarity so Familiar boosts learned history and manual genre/tag preferences, Balanced preserves current ranking, and Different strictly selects outside those signals, leaving a role empty when no candidate remains.
  - Make the handheld toggle strictly filter every Play Next role and its rotation batches to explicitly handheld-suitable candidates. Preserve the existing soft, capped, any-match matching for More filters.
  - Accept legacy persisted preset payloads by normalizing absent new fields to neutral values before validation, so existing presets remain loadable. Do not read or write active tune state from `RecommendationTuneState`.
  - **Done when:** unit tests cover each time boundary, known and unknown play-style behavior, all familiarity modes, strict handheld filtering, thin or empty role outcomes, capped More filters, and legacy preset normalization; existing preset data is not rejected solely because it predates this feature.

- [x] 3. Move active Tune orchestration to the requesting tab.
  - Change Update recommendations to accept and server-validate the current tab's requested Play Next and Buy tune inputs, then persist those exact inputs only in the immutable recommendation-run context.
  - Replace active-tune save, clear, and preset-load server mutations with tab-local state operations. Preset save and delete remain authenticated persisted mutations; preset load returns validated data to the client without mutating database tune state.
  - Update Today data loading and action tests so no server-side active tune is used for initial rendering or later runs, and malformed client input returns the established action error shape.
  - **Done when:** refreshing the same tab restores its unsent Tune choices, a separate tab begins neutral, closing and reopening a tab begins neutral, and only Update recommendations uses the submitted choices; action tests prove validation, run-context persistence, and preset loading without an active-state database write.

- [x] 4. Rebuild the Tune interface and complete recommendation-surface integration.
  - Replace the plain Tune accordion with an accessible default question flow for time, play style, familiarity, and the combinable Play Next handheld toggle. Move retained controls into a clearly labeled More filters disclosure.
  - Preserve named-preset save, load, and delete controls, loading a preset into visible tab-local choices. Provide concise status and caveat feedback for empty handheld, strict Different, unknown play-style, and thin-pool results without changing existing error or loading behavior.
  - Update Play Next role presentation so Handheld Pick is labeled and ordered with the retained roles, and confirm Update recommendations uses the current tab state.
  - **Done when:** Today renders the new controls with labels, keyboard-operable choices, and associated feedback; a saved preset visibly populates only the current tab; the Handheld Pick card or its absence explanation is observable; `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma` and a new Prisma migration for the role enum.
- `src/lib/recommendations/types.ts`, `tune.ts`, `roles.ts`, `run-pipeline.ts`, and their colocated tests for contracts, selection, filtering, caveats, and persisted run context.
- `src/actions/recommendations.ts` and `src/actions/recommendations.test.ts` for authenticated validation, preset behavior, and run creation.
- `src/components/recomme
ndations/TuneThisRunPanel.tsx`, `RecommendationRoleLabel.tsx`, `ShowAnotherButton.tsx`, and recommendation cards as required for tab-local controls and role rendering.
- `src/app/(app)/today/page.tsx` for current-run loading, Tune wiring, role order, and absence feedback.

## Data / contracts

- `RecommendationRole` gains `HANDHELD_PICK`; existing historical roles remain valid.
- A Handheld Pick is eligible only when a handheld is configured and the candidate is already play-eligible under the current environment-fit pipeline and has `handheldSuitable === true`.
- A Handheld Tune is Play Next-only and is a strict candidate and rotation-batch filter, not a score boost.
- Active tune values are client session data. The server receives them only with Update recommendations, validates them with Zod, and stores the accepted values in the created run context for explanation and history.
- `RecommendationPreset.tune` remains persisted JSON. Its reader must normalize prior valid preset shapes to neutral values for newly introduced fields before current validation.
- Unknown play-mode metadata is never treated as a known match or known conflict. It can remain only as a caveated fallback.

## Testing

- `pnpm test` passed before planning: 127 files and 1,230 tests.
- Add colocated Vitest tests for role assignment, renewed tuning behavior, legacy-preset normalization, and server actions/run context.
- Final automated checks: `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Manual review: open Today in two tabs, set Tune values in one, reload it, verify the other remains neutral; update recommendations and inspect role labels, explanations, More filters, preset load behavior, and rotation.

## Notes for the AI

- Follow the established `requireUser`, Zod, and `{ success, data, error }` action conventions. Never trust client tune data without server validation.
- Use `sessionStorage`, not local storage, cookies, URL parameters, or a new persistence table for active Tune state.
- Do not alter existing recommendation-event, calibration, compatibility, environment-fit, or rotation semantics beyond filtering the candidate set where this feature explicitly requires it.
- Keep the default Tune questions concise. Status, errors, and caveats must remain factual under the Odyssey voice rules.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9621,"specSha256":"2e13e69bf1707aff0bf9449702b320a7aa4b959dd14b36ac46ca55a019e56ac7","branch":"refs/heads/feature/recommendation-behavior-renewal","head":"d0031e45dabe0fac49bfe6636c973d93844d2a50","baseRef":"refs/heads/main","baseCommit":"d0031e45dabe0fac49bfe6636c973d93844d2a50","sourceTree":"551f7738ffc36bb4a07ff82f17b869fd0ee355fb","absentOptional":[]} -->

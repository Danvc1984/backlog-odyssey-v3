# Fix: Batch audit findings F-03, F-04, F-12, and F-17 through F-25

**Type:** Fix

**Status:** verified

**Branch:** `fix/batch-audit-findings-f03-f04-f12-f17-f25`

**Fixes:** F-03, F-04, F-12, F-17, F-18, F-19, F-20, F-22, F-23, F-24, F-25

## The problem

Audit findings identify three focused usability or correctness concerns and three connected data-model renewals:

- Wallhaven matching may miss catalog imagery for title variants (F-03), and calculated IGDB series or franchise shelves may omit eligible games (F-04).
- The Settings recommendation profile exposes implementation diagnostics instead of useful health and learnings (F-12).
- Availability actions and source administration lack clear boundaries; redundant availability labels, catalog and wishlist notes, and oversized detail controls remain in product and persistence contracts (F-17 through F-20).
- Tags and manual collections duplicate grouping, personal tags cannot tune recommendations, and the current play-state model conflates completion history with current state (F-22 through F-25).

These areas correspond to the planned personal-data simplification, unified-tag shelves, and play-state renewal. The implementation must preserve personal data, source-of-truth boundaries, recommendation behavior, and export/import compatibility.

## The fix

Implement the listed repairs as five reviewable steps:

- Diagnose and correct only confirmed Wallhaven matching and calculated-shelf omissions, retaining provider fallbacks and avoiding arbitrary result caps.
- Replace raw recommendation profile diagnostics with owner-facing health and next actions, with learned signals in accessible collapsed disclosures.
- Complete the availability and personal-data simplification: Settings owns reusable sources, games assign active saved sources, canonical source names replace display labels, notes are removed, Library gets compact availability/delete actions, detail controls are compacted, and legacy import fields are discarded.
- Make tags the sole personal grouping model, migrate manual collections safely, retain calculated shelves, and add inactive-by-default personal-tag recommendation targets as distinct soft capped boosts.
- Separate current play state from prior completion using a completion-specific `completedBefore` field and `Completed before` copy, migrate legacy `PLAYED_BEFORE` rows safely, and avoid double-counting active replays.

Do not add public collaboration, change calculated IGDB shelf semantics, restore removed notes or display labels, or treat ordinary past play as completion history.

## Build steps

1. [x] **Validate and repair wallpaper matching and calculated shelves**
   - Inspect Wallhaven normalization, title variants, provider responses, and fallback selection for Horizon Zero Dawn Remastered; inspect enriched metadata, calculated-shelf derivation, and UI limits for series and franchises.
   - Make the smallest supported repair for each confirmed omission, including focused tests for changed pure matching or shelf logic.
   - **Done when:** the known title receives appropriate wallpaper query candidates or a documented provider fallback, and every eligible series or franchise game is represented without an unintended five-item limit.

2. [x] **Make recommendation-profile health understandable**
   - Replace timestamps, raw event names, counts, and unresolved-target diagnostics with a clear health indicator and actionable next steps.
   - Place learned era, tag, and related signals in accessible collapsed disclosures without exposing implementation-only event detail.
   - **Done when:** Settings communicates profile health and useful actions without raw internal diagnostics, while the learned signals remain available on demand.

3. [x] **Simplify availability and personal data**
   - Migrate away per-game availability display labels and catalog/wishlist notes; update schema, validation, actions, forms, details, acquisition, recommendation inputs, and versioned export/import so legacy fields are discarded.
   - Use reusable-source canonical names throughout. Keep source create, rename, and archive in Settings, while game surfaces assign only saved active sources and link to Settings.
   - Show each game card's current platform with its source icon alongside metadata, keep platform changes on the game detail page behind a `Change platform` action, and use red icon-only trash actions for deletion with the existing confirmation and Undo flow. Compact retained game-detail personal controls with accessible information controls; keep wishlist destructive actions visually consistent and provide a conditional Library `Clear filters` action.
   - **Done when:** no product path reads or writes removed fields, source administration is Settings-only, cards show platform identity without an availability setup action, game details provide `Change platform`, common Library actions need no detail navigation, and legacy exports/imports cannot restore removed data.

4. [x] **Unify personal tags and collection shelves**
   - Migrate manual collections to normalized same-named tags, union memberships on collisions, remove the separate manual Collection model and detail editor, generate a browsable shelf for every tag, list personal tag names with platform and metadata chips, allow tag removal from game details, and provide a clear warning before deleting a tag shelf and its memberships.
   - Preserve calculated system and IGDB shelves as read-only. Add distinct, inactive-by-default personal-tag Tune targets that apply a soft capped any-match boost and persist through presets, run context, explanations, reset, and export/import.
   - **Done when:** tags are the only editable personal grouping, each tag has a shelf, Library filtering remains intact, and selected personal tags transparently and safely influence recommendation runs.

5. [x] **Separate current state from prior completion**
   - Replace `PLAYED_BEFORE` with `COMPLETED` plus the independent completion-specific `completedBefore` field, shown as `Completed before`.
   - Migrate legacy rows, then update all state controls, bulk and taste setup, shelves, counts, recommendation eligibility/profile/events, acquisition, export/import, and tests without double-counting active replays.
   - **Done when:** an entry can be `IN_PROGRESS` and `completedBefore` simultaneously, migrated legacy rows preserve completion evidence, and completion history is never inferred from ordinary past play.

## Verify

- Run focused Vitest coverage for changed matching, shelf derivation, migrations, import/export, tag recommendation context, and play-state rules.
- Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- In the running app, verify Wallhaven behavior for Horizon Zero Dawn Remastered, complete calculated shelves, Settings profile disclosures, Settings-only source administration, Library overflow actions and Undo, compact personal controls, tag shelves and Tune influence, and an in-progress replay marked Completed before.
- Confirm legacy imports discard notes and availability display labels, collection memberships migrate to tags without loss, and `PLAYED_BEFORE` imports or migrated rows become `COMPLETED` with `completedBefore` enabled.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7267,"specSha256":"b200cd1c48014b393bc76e5d2994067f856046db1ee21dc137e2713bbb7a81bd","branch":"refs/heads/fix/batch-audit-findings-f03-f04-f12-f17-f25","head":"a9893c5124c5b325520226d6da913fa425a563b0","baseRef":"refs/heads/main","baseCommit":"a9893c5124c5b325520226d6da913fa425a563b0","sourceTree":"81df6240cc34efacab94bcf776029381ad428b8e","absentOptional":[]}

## Manual try guide

### Start

pnpm dev

Open http://localhost:3500 and sign in.

### Review

1. Open /library. Confirm cards show platform icons and names, metadata genres, durations, and personal tag names on the same chip row. Activate a filter and use Clear filters.
2. Open /games/[id]. Confirm Change platform opens the Platforms section. Add a tag, then remove it with its x control.
3. Open /collections and choose a personal tag shelf. Confirm Delete this tag opens a warning with the affected game count. Cancel, then confirm deletion and verify the games remain.
4. Open /wishlist. Confirm ProtonDB badges sit below ratings and delete uses the red icon-only action.

### Expected

Platform identity is visible without an availability setup button on cards. Tag removal changes membership only; tag deletion removes the tag from its games without deleting the games.

### Gaps

No live browser walkthrough was performed during completion; external provider behavior requires representative local data.

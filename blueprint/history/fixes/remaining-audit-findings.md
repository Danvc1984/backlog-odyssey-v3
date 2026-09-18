# Fix: Remaining audit findings

**Type:** Fix
**Status:** verified
**Branch:** `fix/remaining-audit-findings`
**Fixes:** F-07, F-25, F-26, F-27, F-28, F-29, F-30

## The problem

The remaining audit findings include two documentation/UI contract inconsistencies alongside the repaired migration, export, and dead-code findings:

- The collection-to-tag migration can create duplicate tags for names that differ only by case or surrounding whitespace, duplicating migrated memberships and shelves.
- Personal-data export opens a transaction but reads through the global Prisma client, so concurrent changes can produce a mixed snapshot.
- Compatibility settings and game-name form code contain unused compatibility-panel values, props, and imports, leaving lint warnings and dead code.
- `SectionCard` retains an unused `eyebrow` prop while callers continue passing decorative labels that are not rendered.
- The durable project plan and adjacent Blueprint planning documents use `playedBefore`, contradicting the runtime contract's `completedBefore` name.

## The fix

- Make the collection migration choose one canonical `PersonalTag` ID per normalized name, reuse that ID for migrated memberships, add a follow-up migration for databases that already ran the original migration, and execute coverage for both fresh and repaired collision scenarios.
- Pass the interactive transaction client into every export query and add a focused test proving export reads use that client rather than the global Prisma client.
- Remove the unused compatibility-panel contract and constants, update its settings call site, and remove the unused `Label` import from `GameNameForm`.

Do not change the surrounding tag migration behavior, export schema, or visible retry behavior beyond what is required to remove the findings.

## Build steps

- [x] **Harden tag migration and export snapshot reads.** Normalized tag collisions resolve to one canonical tag and all export reads run through the transaction client, with focused tests covering both cases.
- [x] **Remove dead compatibility and form code.** The affected components and call sites contain no unused values or imports and preserve the existing visible behavior.
- [x] **Repair already-applied tag migrations and execute collision coverage.** The follow-up migration merges duplicate normalized tags in existing databases, and an executable PostgreSQL test proves fresh migration and repair behavior with colliding names.
- [x] **Remove the unused SectionCard eyebrow contract.** `SectionCard` no longer declares `eyebrow`, and no SectionCard caller passes it.
- [x] **Align the durable completion terminology.** The project plan consistently uses `completedBefore` and completion-specific copy without changing runtime behavior.
- [x] **Refresh adjacent Blueprint planning context.** The pending feature 32 build-plan item and generated project overview use `completedBefore`, while historical archives retain their original terminology.
- [x] **Run verification.** Typecheck, tests, lint, and the documented build complete successfully, with no new warnings.

## Verify

- Run `pnpm typecheck`.
- Run `pnpm test`.
- Run `pnpm lint` and confirm it is warning-free.
- Run `pnpm build`.
- Review the migration SQL and focused tests for case-only and whitespace-only tag collisions, and confirm the export test observes the transaction client for every read.
- Search for remaining `SectionCard` eyebrow props and contradictory `playedBefore` plan terminology in active planning documents; historical archives may retain original terminology.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3588,"specSha256":"c772572541f455c8e0bd184922734212099f77738f241e4e45953f417d59f8b3","branch":"refs/heads/fix/remaining-audit-findings","head":"a2c9099c77f94996d0c3d03019f0ac9a01c25319","baseRef":"refs/heads/main","baseCommit":"a2c9099c77f94996d0c3d03019f0ac9a01c25319","sourceTree":"9bb4ecbe3ef28f0cbbe2fa37e7529edbb8ef50ff","absentOptional":[]} -->

## Findings

# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass moves
> them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] closed - Recommendation updates can fail

**Area:** Today recommendation update flow
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** The main decision workflow cannot be trusted when a requested run fails without a clear recovery path.
**Suggested fix:** Reproduce the failure, preserve the prior valid run, show a useful error, and cover the confirmed root cause with focused tests.
**Resolution:** Updated recommendation refresh feedback to explain that the prior valid lists remain available and offer a clear retry path. The existing transaction boundary preserves the prior run on failure.

### F-02 [P2] closed - Recent Steam activity failure handling is incomplete

**Area:** Today recent Steam activity
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Provider failures currently leave an unclear or broken dashboard state.
**Suggested fix:** Preserve the last usable cache, distinguish fresh-empty from stale-on-error, and present retry or sync guidance inside the activity section.
**Resolution:** Activity refreshes now record unexpected provider exceptions as stale-on-error while retaining the last cached entries; focused tests cover the thrown-provider-failure path.

### F-03 [P3] closed - Wallhaven does not find imagery for Horizon Zero Dawn Remastered

**Area:** Wallhaven wallpaper matching
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** A known catalog title produces no expected wallpaper candidates.
**Suggested fix:** Inspect query normalization, title variants, provider responses, and fallback behavior before changing the matching strategy.
**Resolution:** Wallhaven refresh now retries recognized edition-title suffixes using the base title only after the original query has no results. Focused tests cover the Horizon Zero Dawn Remastered fallback.

### F-04 [P3] closed - Series and franchise shelves appear limited to about five results

**Area:** Collections calculated IGDB shelves
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** The Collections page may be truncating or failing to derive shelves from available library metadata.
**Suggested fix:** Compare enriched library evidence with the shelf query and UI limits, then fix only if eligible series or franchises are omitted.
**Resolution:** Confirmed calculated shelf derivation has no five-result cap. Focused coverage now proves all seven distinct eligible series are returned.

### F-05 [P2] closed - Compatibility is duplicated and its target platform is unclear

**Area:** Catalog and wishlist detail compatibility
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Repeated compatibility values can imply separate evidence while failing to explain which configured device they apply to.
**Suggested fix:** Present Linux evidence once for its configured target devices and show Windows fallback in a separate labeled row only when configured and relevant.
**Resolution:** Removed the repeated ProtonDB tier from the catalog environment row, deduplicated wishlist environment rows, and labeled Linux compatibility for the configured PC/handheld target.

### F-06 [P3] closed - User-facing copy still exposes internal app structure

**Area:** Cross-app copy and empty states
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Text such as provider-record preservation and repeated eligibility messages explains implementation rather than helping the owner act.
**Suggested fix:** Remove structural explanations, deduplicate equivalent empty-state copy, and keep only consequences or next actions meaningful to the owner.
**Resolution:** Replaced implementation-oriented recommendation and Steam activity empty-state copy with concise outcomes and retry guidance, and corrected the purchase empty-state text.

### F-07 [P3] closed - Decorative technical labels and eyebrows remain redundant

**Area:** Today, Collections, and detail section cards
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Repeated eyebrows and technical labels add visual noise without adding hierarchy.
**Suggested fix:** Remove section-card eyebrows and redundant root-page technical labels while retaining labels that communicate real evidence or status.
**Resolution:** Fixed on `fix/remaining-audit-findings`: removed the unused `SectionCard.eyebrow` prop and removed decorative eyebrow arguments from all SectionCard callers. Evidence/status eyebrows owned by other components remain unchanged.

### F-08 [P3] closed - Today hero does not use the library card information hierarchy

**Area:** Today hero
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Plain text and non-linked titles make the dashboard's primary game surface less useful than Library cards.
**Suggested fix:** Make titles link to details and present the most useful game data with the established Library-card hierarchy.
**Resolution:** Fixed on `fix/today-dashboard-hierarchy-and-empty-states`: Today hero titles now link to game details and show interest, description, and genre hierarchy.

### F-09 [P2] closed - Empty recommendation sections render without a run

**Area:** Today Play These Next and Recommended Purchases
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Rendering result sections before a recommendation run suggests missing content or a failed calculation.
**Suggested fix:** Hide each result section when its corresponding run does not exist and keep the explicit update action in the surrounding dashboard state.
**Resolution:** Fixed on `fix/today-dashboard-hierarchy-and-empty-states`: recommendation result sections are rendered only when their corresponding run exists.

### F-10 [P3] closed - Operations status is separated from Data Health

**Area:** Today supporting sections
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Two operational surfaces fragment related health and recovery information.
**Suggested fix:** Remove the standalone Operations Status section and compose actionable background status into Data Health.
**Resolution:** Fixed on `fix/today-dashboard-hierarchy-and-empty-states`: operation and provider status now appears inside Data health, with no standalone Today operations block.

### F-11 [P2] closed - Tune initializes with active-looking state and expanded controls

**Area:** Today Tune flow
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** A tuning surface that appears preselected can imply constraints the owner did not choose.
**Suggested fix:** Start Tune collapsed with no active filters, selected checkboxes, or non-neutral choices; loading a preset remains an explicit action.
**Resolution:** Tune remains collapsed by default with a neutral empty context; active tab-local choices and explicit preset loading are preserved.

### F-12 [P3] closed - Recommendation profile exposes raw implementation details

**Area:** Settings recommendation profile
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Rebuild timestamps, raw event names, event counts, and unresolved-target counts obscure useful profile health.
**Suggested fix:** Replace raw diagnostics with a clear health indicator and next actions; place era, tag, and other learned signals in collapsed disclosures.
**Resolution:** Settings now shows owner-facing profile health and next actions, while learned signals are behind an accessible collapsed disclosure without rebuild timestamps, event names, counts, or unresolved-target totals.

### F-13 [P3] closed - Wishlist detail actions and offer hero lack focus

**Area:** Wishlist detail hero and actions
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Core wishlist decisions are visually secondary and the offer hierarchy under-emphasizes title, final price, and discount.
**Suggested fix:** Create a focused action area similar to Library play-state controls, expose selected actions in the hero, link and strengthen the title, color the discounted price, and emphasize the discount percentage.
**Resolution:** Fixed on `fix/wishlist-detail-purchase-flow-and-artwork`: wishlist detail now foregrounds the selected offer and acquisition action, with linked seller title and stronger price and discount hierarchy.

### F-14 [P2] closed - Mexico keyshop activation warning is detached from the main price

**Area:** Wishlist selected offer
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Regional activation risk may be missed when it is not adjacent to the price that motivates purchase.
**Suggested fix:** Place the keyshop activation warning directly below the selected offer price while keeping the seller page authoritative.
**Resolution:** Fixed on `fix/wishlist-detail-purchase-flow-and-artwork`: the Mexico keyshop warning now appears directly below the selected offer price and the seller link remains available.

### F-15 [P3] closed - Acquisition confirmation lacks a distinctive completion moment

**Area:** Wishlist Acquire modal
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** A major catalog transition feels visually generic.
**Suggested fix:** Add cover artwork and restrained celebratory motion with reduced-motion and reduced-data fallbacks, without delaying confirmation.
**Resolution:** Fixed on `fix/wishlist-detail-purchase-flow-and-artwork`: successful acquisition now keeps an accessible confirmation open with cover-art and reduced-data fallback plus reduced-motion celebration.

### F-16 [P3] closed - Wishlist and Add Game forms need layout cleanup

**Area:** Manual creation forms
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Inconsistent density and unnecessary one-control rows make related fields harder to scan.
**Suggested fix:** Clean up the Wishlist add form using the Library form's composition without adding catalog-only availability to wishes. Separately, align Interest with Availability in the Add Game form where responsive space permits.
**Resolution:** Grouped Wishlist type and interest controls responsively, expanded the modal fields, changed Add Game availability to a dropdown containing only Steam, ROM, and active Settings sources, and removed the Add Game display-name field without adding availability to Wishlist.

### F-17 [P2] closed - Availability administration and destructive actions have weak navigation boundaries

**Area:** Library cards and game-detail availability
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Common per-game actions take unnecessary navigation, while reusable source administration appears in the wrong context.
**Suggested fix:** Add Library-card overflow actions for Edit availability and Delete; keep reusable-source create/rename/archive in Settings and link there from detail availability.
**Resolution:** Library cards now expose availability and delete actions, while game availability links reusable-source administration to Settings and no longer creates sources in place.

### F-18 [P2] closed - Per-game availability display labels duplicate source identity

**Area:** Availability data model and all availability surfaces
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** Two names for one reusable source create inconsistent labels and unnecessary form, migration, export, and rendering paths.
**Suggested fix:** Remove the display-label field from the schema and every contract, use the reusable source's canonical name, and discard legacy labels during migration/import.
**Resolution:** Removed `displayName` from the Prisma model, migration, validation, actions, forms, merge planning, and export/import contract. Availability uses the reusable source name.

### F-19 [P2] closed - Catalog and wishlist notes are no longer part of the product

**Area:** LibraryEntry, WishlistEntry, forms, details, acquisition, and export/import
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** Retaining an intentionally removed field increases UI density and leaves unsupported personal data contracts.
**Suggested fix:** Remove notes from the data model and every read/write/transfer/export path, with an explicit migration and legacy-import policy.
**Resolution:** Removed catalog and wishlist notes from the Prisma model, migration, actions, forms, details, imports, exports, and acquisition paths. Legacy import values are discarded.

### F-20 [P3] closed - Game-detail personal fields use too much space

**Area:** Game detail personal controls
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Persistent descriptions and one-input-per-row composition overwhelm the retained controls.
**Suggested fix:** Use compact responsive groups and accessible information controls for optional explanations, preserving breathing room only where needed.
**Resolution:** Removed the retired notes control, compacted the personal profile surface, and replaced the permanent source helper with a Settings link.

### F-21 [P3] closed - Detail artwork carousels are slow and lack fullscreen viewing

**Area:** Game and wishlist detail artwork
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Artwork exploration feels sluggish and cannot adapt framing to the source image resolution.
**Suggested fix:** Modestly increase carousel movement speed and add an accessible fullscreen viewer with contain-aware framing, keyboard controls, and reduced-motion behavior.
**Resolution:** Fixed on `fix/wishlist-detail-purchase-flow-and-artwork`: shared detail artwork now advances faster and opens in an accessible contain-aware fullscreen viewer with keyboard controls and reduced-data behavior.

### F-22 [P2] closed - Tags and manual collections duplicate personal grouping

**Area:** Data model, Collections, Library filters, and game detail
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** Two overlapping manual grouping systems create redundant editing and unclear ownership of shelves.
**Suggested fix:** Make tags the sole manual grouping model, generate a shelf per tag, migrate manual collections into tags, support multiple tags per game, and remove the separate detail collection editor.
**Resolution:** Migrated editable collection memberships into normalized personal tags, removed the manual collection models and editors, generated read-only tag shelves, and kept calculated shelves intact.

### F-23 [P2] closed - Personal tags cannot explicitly tune recommendations

**Area:** Tune More filters and recommendation run context
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Owner-defined groupings cannot currently influence a requested recommendation run independently from provider metadata.
**Suggested fix:** Add inactive-by-default personal-tag targets as a soft capped any-match boost, distinct from IGDB genres/themes/keywords and covered by presets and explanations.
**Resolution:** Added inactive-by-default personal-tag tune targets with distinct any-match soft boosts, persisted them through presets and run context, and included them in export/import.

### F-24 [P2] closed - PLAYED_BEFORE conflates current state with completion history

**Area:** LibraryEntry play state, shelves, recommendations, taste setup, and export/import
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** A replay cannot truthfully be both currently in progress and previously completed when prior completion is encoded as the current state.
**Suggested fix:** Replace `PLAYED_BEFORE` with current `COMPLETED` state plus an independent `playedBefore` checkbox, migrate existing rows, and prevent replay history from being double-counted.
**Resolution:** Retired `PLAYED_BEFORE`, added current `COMPLETED` plus independent `completedBefore`, migrated legacy rows, updated state controls and recommendation eligibility, and preserved replay completion history without double-counting.

### F-25 [P2] closed - Prior-completion semantics use a played-before name and prompt

**File:** blueprint/project-plan.md:134
**Found:** 2026-09-15 by `/audit` (scope: changed; lens: quality)
**Why it matters:** The plan defines `playedBefore` as proof that the game was completed, while taste setup labels the same mutation `I've played this`. Implementers could record partial past play as completion evidence, affecting completed shelves, backlog counts, and recommendation learning.
**Suggested fix:** Before feature 32 is specified, choose one contract. For the stated requirement, prefer a completion-specific field and label such as `completedBefore` / `Completed before`, while keeping ordinary past play as separate provider or event evidence.
**Resolution:** Fixed on `fix/remaining-audit-findings`: aligned `blueprint/project-plan.md` with the runtime `completedBefore` field and completion-specific terminology. This pass re-reviewed the project-plan contract and found the original contradiction removed.

### F-30 [P2] closed - Remaining planning documents use the retired prior-completion name

**Area:** Durable Blueprint context and pending build plan
**File:** blueprint/context/project-overview.md:45,71; blueprint/build-plan.md:689-693
**Found:** 2026-09-18 by `/audit` (scope: full; lens: quality)
**Why it matters:** The project plan now names the completion-specific field `completedBefore`, but the generated project overview and pending feature 32 still use `playedBefore`. Future implementation work can therefore follow contradictory durable contracts and reintroduce the retired terminology.
**Suggested fix:** Refresh the project overview and update the pending feature 32 build-plan wording to use `completedBefore` and completion-specific copy. Preserve historical archived specs as historical records.
**Resolution:** Fixed on `fix/remaining-audit-findings`: updated the pending feature 32 build-plan wording and regenerated the project overview with `completedBefore`; historical archives retain their original terminology by design. This pass confirmed the active planning documents contain no retired terminology and the overview source hash matches both plans.

### F-26 [P1] closed - Case-only tag collisions duplicate migrated collections

**File:** prisma/migrations/20260916130000_migrate_collections_to_tags/migration.sql:2-14
**Found:** 2026-09-18 by /audit (scope: full; lens: quality)
**Why it matters:** `PersonalTag.name` is unique only by its exact value, while the migration identifies existing tags and joins memberships with `lower(trim(name))`. If an existing tag differs from a collection only by case or whitespace, `ON CONFLICT ("name")` does not prevent inserting a second tag and the join can attach every former collection membership to both tags. This violates the required normalized-collision union and leaves duplicate shelves and tuning targets after migration.
**Suggested fix:** Resolve one canonical tag ID per normalized name before inserts, reuse it for migrated memberships, and add migration-level coverage for an existing case-variant tag plus a colliding collection.
**Resolution:** The original migration now handles fresh applications, and follow-up migration `20260918150000_reconcile_personal_tag_collisions` repairs already-applied databases by merging normalized tag memberships before deleting duplicate tags. The executable PostgreSQL test passed for both paths, and this audit confirmed the repaired code removes the original collision risk.

### F-27 [P1] closed - Personal-data export does not use its transaction client

**File:** src/lib/export-data.ts:37-88
**Found:** 2026-09-18 by /audit (scope: full; lens: quality, security)
**Why it matters:** The callback opens an interactive transaction but every read uses the global `prisma` client instead of the callback transaction client. Concurrent catalog mutations can therefore produce a mixed export, including relation rows whose parents are absent. The restore endpoint validates and inserts that document atomically, so a mixed snapshot can fail to restore or omit personal data despite the export's snapshot guarantee.
**Suggested fix:** Accept the transaction client in the callback and run every export query through it. Add a focused test that verifies the callback client, rather than the global client, supplies all export reads.
**Resolution: Export reads now use the interactive transaction client throughout, with a focused test proving global Prisma delegates are not used.**

### F-28 [P2] closed - Lint warnings leave dead compatibility-panel and form code

**File:** src/components/games/CompatibilitySweepPanel.tsx:21,40,81; src/components/games/GameNameForm.tsx:9
**Found:** 2026-09-18 by /audit (scope: full; lens: quality)
**Why it matters:** The project lint signal reports four unused imports, constants, or props. This violates the no-unused-code standard and makes it less clear which retry and failed-job paths are actually supported.
**Suggested fix:** Remove the unused values, or wire each into the intended visible behavior, then keep lint warning-free.
**Resolution:** Removed the unused compatibility-panel retry values and failed-job prop, updated the Settings call site, and removed the unused `Label` import from `GameNameForm`.

### F-29 [P2] closed - Migration collision test only checks SQL text

**File:** src/lib/personal-tag-migration.test.ts:1-123
**Found:** 2026-09-18 by `/audit` (scope: current; lens: tests, quality)
**Why it matters:** The new migration test asserts that selected SQL fragments exist, but it never executes the migration or supplies an existing case-variant `PersonalTag` alongside a colliding `Collection`. It can pass while the SQL is syntactically invalid or while the resulting tag and membership union is wrong.
**Suggested fix:** Add a database-backed migration test against a disposable schema, or another executable fixture that runs the migration with an existing case/whitespace-variant tag and verifies one canonical tag plus the unioned memberships.
**Resolution:** Replaced the SQL-text assertions with an executable PostgreSQL test using temporary tables. It verifies fresh collection migration, pre-existing normalized duplicates, membership union, and duplicate cleanup. This audit reran the focused test successfully.

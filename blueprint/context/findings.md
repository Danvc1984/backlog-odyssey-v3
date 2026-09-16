# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass moves
> them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] open - Recommendation updates can fail

**Area:** Today recommendation update flow
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** The main decision workflow cannot be trusted when a requested run fails without a clear recovery path.
**Suggested fix:** Reproduce the failure, preserve the prior valid run, show a useful error, and cover the confirmed root cause with focused tests.
**Resolution:**

### F-02 [P2] open - Recent Steam activity failure handling is incomplete

**Area:** Today recent Steam activity
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Provider failures currently leave an unclear or broken dashboard state.
**Suggested fix:** Preserve the last usable cache, distinguish fresh-empty from stale-on-error, and present retry or sync guidance inside the activity section.
**Resolution:**

### F-03 [P3] unverified - Wallhaven does not find imagery for Horizon Zero Dawn Remastered

**Area:** Wallhaven wallpaper matching
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** A known catalog title produces no expected wallpaper candidates.
**Suggested fix:** Inspect query normalization, title variants, provider responses, and fallback behavior before changing the matching strategy.
**Resolution:**

### F-04 [P3] unverified - Series and franchise shelves appear limited to about five results

**Area:** Collections calculated IGDB shelves
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** The Collections page may be truncating or failing to derive shelves from available library metadata.
**Suggested fix:** Compare enriched library evidence with the shelf query and UI limits, then fix only if eligible series or franchises are omitted.
**Resolution:**

### F-05 [P2] open - Compatibility is duplicated and its target platform is unclear

**Area:** Catalog and wishlist detail compatibility
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Repeated compatibility values can imply separate evidence while failing to explain which configured device they apply to.
**Suggested fix:** Present Linux evidence once for its configured target devices and show Windows fallback in a separate labeled row only when configured and relevant.
**Resolution:**

### F-06 [P3] open - User-facing copy still exposes internal app structure

**Area:** Cross-app copy and empty states
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Text such as provider-record preservation and repeated eligibility messages explains implementation rather than helping the owner act.
**Suggested fix:** Remove structural explanations, deduplicate equivalent empty-state copy, and keep only consequences or next actions meaningful to the owner.
**Resolution:**

### F-07 [P3] open - Decorative technical labels and eyebrows remain redundant

**Area:** Today, Collections, and detail section cards
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Repeated eyebrows and technical labels add visual noise without adding hierarchy.
**Suggested fix:** Remove section-card eyebrows and redundant root-page technical labels while retaining labels that communicate real evidence or status.
**Resolution:**

### F-08 [P3] open - Today hero does not use the library card information hierarchy

**Area:** Today hero
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Plain text and non-linked titles make the dashboard's primary game surface less useful than Library cards.
**Suggested fix:** Make titles link to details and present the most useful game data with the established Library-card hierarchy.
**Resolution:**

### F-09 [P2] open - Empty recommendation sections render without a run

**Area:** Today Play These Next and Recommended Purchases
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Rendering result sections before a recommendation run suggests missing content or a failed calculation.
**Suggested fix:** Hide each result section when its corresponding run does not exist and keep the explicit update action in the surrounding dashboard state.
**Resolution:**

### F-10 [P3] open - Operations status is separated from Data Health

**Area:** Today supporting sections
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Two operational surfaces fragment related health and recovery information.
**Suggested fix:** Remove the standalone Operations Status section and compose actionable background status into Data Health.
**Resolution:**

### F-11 [P2] open - Tune initializes with active-looking state and expanded controls

**Area:** Today Tune flow
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** A tuning surface that appears preselected can imply constraints the owner did not choose.
**Suggested fix:** Start Tune collapsed with no active filters, selected checkboxes, or non-neutral choices; loading a preset remains an explicit action.
**Resolution:**

### F-12 [P3] open - Recommendation profile exposes raw implementation details

**Area:** Settings recommendation profile
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Rebuild timestamps, raw event names, event counts, and unresolved-target counts obscure useful profile health.
**Suggested fix:** Replace raw diagnostics with a clear health indicator and next actions; place era, tag, and other learned signals in collapsed disclosures.
**Resolution:**

### F-13 [P3] open - Wishlist detail actions and offer hero lack focus

**Area:** Wishlist detail hero and actions
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Core wishlist decisions are visually secondary and the offer hierarchy under-emphasizes title, final price, and discount.
**Suggested fix:** Create a focused action area similar to Library play-state controls, expose selected actions in the hero, link and strengthen the title, color the discounted price, and emphasize the discount percentage.
**Resolution:**

### F-14 [P2] open - Mexico keyshop activation warning is detached from the main price

**Area:** Wishlist selected offer
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Regional activation risk may be missed when it is not adjacent to the price that motivates purchase.
**Suggested fix:** Place the keyshop activation warning directly below the selected offer price while keeping the seller page authoritative.
**Resolution:**

### F-15 [P3] open - Acquisition confirmation lacks a distinctive completion moment

**Area:** Wishlist Acquire modal
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** A major catalog transition feels visually generic.
**Suggested fix:** Add cover artwork and restrained celebratory motion with reduced-motion and reduced-data fallbacks, without delaying confirmation.
**Resolution:**

### F-16 [P3] open - Wishlist and Add Game forms need layout cleanup

**Area:** Manual creation forms
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Inconsistent density and unnecessary one-control rows make related fields harder to scan.
**Suggested fix:** Clean up the Wishlist add form using the Library form's composition without adding catalog-only availability to wishes. Separately, align Interest with Availability in the Add Game form where responsive space permits.
**Resolution:** 2026-09-15 `/audit changed` clarified the two distinct form requirements; the product work remains open.

### F-17 [P2] open - Availability administration and destructive actions have weak navigation boundaries

**Area:** Library cards and game-detail availability
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Common per-game actions take unnecessary navigation, while reusable source administration appears in the wrong context.
**Suggested fix:** Add Library-card overflow actions for Edit availability and Delete; keep reusable-source create/rename/archive in Settings and link there from detail availability.
**Resolution:** Planned in feature 29.

### F-18 [P2] open - Per-game availability display labels duplicate source identity

**Area:** Availability data model and all availability surfaces
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** Two names for one reusable source create inconsistent labels and unnecessary form, migration, export, and rendering paths.
**Suggested fix:** Remove the display-label field from the schema and every contract, use the reusable source's canonical name, and discard legacy labels during migration/import.
**Resolution:** Planned in feature 29.

### F-19 [P2] open - Catalog and wishlist notes are no longer part of the product

**Area:** LibraryEntry, WishlistEntry, forms, details, acquisition, and export/import
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** Retaining an intentionally removed field increases UI density and leaves unsupported personal data contracts.
**Suggested fix:** Remove notes from the data model and every read/write/transfer/export path, with an explicit migration and legacy-import policy.
**Resolution:** Planned in feature 29.

### F-20 [P3] open - Game-detail personal fields use too much space

**Area:** Game detail personal controls
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Persistent descriptions and one-input-per-row composition overwhelm the retained controls.
**Suggested fix:** Use compact responsive groups and accessible information controls for optional explanations, preserving breathing room only where needed.
**Resolution:** Planned in feature 29.

### F-21 [P3] open - Detail artwork carousels are slow and lack fullscreen viewing

**Area:** Game and wishlist detail artwork
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Artwork exploration feels sluggish and cannot adapt framing to the source image resolution.
**Suggested fix:** Modestly increase carousel movement speed and add an accessible fullscreen viewer with contain-aware framing, keyboard controls, and reduced-motion behavior.
**Resolution:**

### F-22 [P2] open - Tags and manual collections duplicate personal grouping

**Area:** Data model, Collections, Library filters, and game detail
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** Two overlapping manual grouping systems create redundant editing and unclear ownership of shelves.
**Suggested fix:** Make tags the sole manual grouping model, generate a shelf per tag, migrate manual collections into tags, support multiple tags per game, and remove the separate detail collection editor.
**Resolution:** Planned in feature 30.

### F-23 [P2] open - Personal tags cannot explicitly tune recommendations

**Area:** Tune More filters and recommendation run context
**Found:** 2026-09-15 by owner report (planning triage)
**Why it matters:** Owner-defined groupings cannot currently influence a requested recommendation run independently from provider metadata.
**Suggested fix:** Add inactive-by-default personal-tag targets as a soft capped any-match boost, distinct from IGDB genres/themes/keywords and covered by presets and explanations.
**Resolution:** Planned in feature 30.

### F-24 [P2] open - PLAYED_BEFORE conflates current state with completion history

**Area:** LibraryEntry play state, shelves, recommendations, taste setup, and export/import
**Found:** 2026-09-15 by owner decision (planning triage)
**Why it matters:** A replay cannot truthfully be both currently in progress and previously completed when prior completion is encoded as the current state.
**Suggested fix:** Replace `PLAYED_BEFORE` with current `COMPLETED` state plus an independent `playedBefore` checkbox, migrate existing rows, and prevent replay history from being double-counted.
**Resolution:** Planned in feature 31.

### F-25 [P2] open - Prior-completion semantics use a played-before name and prompt

**File:** blueprint/project-plan.md:134
**Found:** 2026-09-15 by `/audit` (scope: changed; lens: quality)
**Why it matters:** The plan defines `playedBefore` as proof that the game was completed, while taste setup labels the same mutation `I've played this`. Implementers could record partial past play as completion evidence, affecting completed shelves, backlog counts, and recommendation learning.
**Suggested fix:** Before feature 31 is specified, choose one contract. For the stated requirement, prefer a completion-specific field and label such as `completedBefore` / `Completed before`, while keeping ordinary past play as separate provider or event evidence.
**Resolution:**

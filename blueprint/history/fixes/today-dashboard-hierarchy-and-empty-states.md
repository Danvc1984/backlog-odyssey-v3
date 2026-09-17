# Fix: Today dashboard hierarchy and empty states

**Type:** Fix
**Status:** verified
**Branch:** fix/today-dashboard-hierarchy-and-empty-states
**Fixes:** F-07, F-08, F-09, F-10

## The problem

The app exposes redundant technical eyebrows across shared section cards, while Today also presents its hero game with less useful hierarchy than a Library card, renders empty recommendation result sections before their runs exist, and separates operation recovery information from Data Health.

## The fix

Remove the eyebrow row from the shared SectionCard component so every section card in the app uses its title as the primary heading. Keep the eyebrow prop accepted for compatibility while no longer rendering it. Preserve meaningful labels inside card content. Also refine the Today dashboard: make hero titles link to their game details and use the established Library-card information hierarchy, hide recommendation result sections without a matching run, and move actionable operation status into Data Health. Do not change recommendation calculations or provider behavior.

## Build steps

1. [x] **Simplify section-card and Today hierarchy.** Remove eyebrows from every shared SectionCard while retaining meaningful content labels, remove redundant Today technical labels, link hero game titles to their detail pages, and compose hero data using the useful Library-card hierarchy.

   **Done when:** No rendered SectionCard includes an eyebrow row, and the Today hero provides a linked, scannable game summary with remaining labels that convey meaningful status or evidence.

2. [x] **Make empty and operational states actionable.** Hide Play These Next and Recommended Purchases result sections until their corresponding runs exist; integrate background operation status and recovery guidance into Data Health, removing the standalone Operations Status section.

   **Done when:** No empty recommendation result section appears without its run, and all actionable background status is available from Data Health.

## Verify

- Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- In the running app, open Today and another route with section cards. Confirm section-card eyebrows are absent, the hero title opens the game detail page, absent runs render no empty result sections, and Data Health contains any operation guidance without a separate Operations Status section.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2384,"specSha256":"2b9b1746f78b0754d63fd4b608ab25e6a05a2dc4a70410c568e491578933edcc","branch":"refs/heads/fix/today-dashboard-hierarchy-and-empty-states","head":"34a00eabaf46cff02ae4f7baf7af12ab1830f097","baseRef":"refs/heads/main","baseCommit":"34a00eabaf46cff02ae4f7baf7af12ab1830f097","sourceTree":"b3cc7feee9341ecc41115d05f460026af402aad4","absentOptional":[]} -->

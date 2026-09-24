# Fix: Unify library interest and priority

**Type:** Fix
**Status:** verified
**Branch:** fix/unify-library-interest-and-priority

## The problem

Owned base games currently expose both `LibraryEntry.interest` (1-5) and `priority` (None/Low/Medium/High). The Preferences form asks for both, while Play Next scores and explains both independently. This makes one play-intent decision look like two signals and double-counts it. "Interest" reads more naturally as a wishlist or buying signal.

## The fix

Use one owned-game **Play priority** control, with 1-5 stars and an unset state. Retain the existing numeric `LibraryEntry.interest` column as the stored value, but present it everywhere as Play priority. Drop the redundant enum `LibraryEntry.priority` column with the normal Prisma schema migration; do **not** backfill, merge, or preserve its values. The three existing library entries keep their current numeric `interest` values (if any) and lose only the obsolete enum values, not the entries themselves. Keep `WishlistEntry.interest` and its wording/Buy scoring unchanged. `playSoon` remains a distinct near-term flag, not another priority picker.

Make stars on every owned-game surface, including library grid/list cards and the game-detail hero, explicitly rate **Play priority**: update accessible labels, button names, feedback toasts, and any read-only stars, not just the Preferences form. All of these controls must save the same numeric value and show updates after reload. Update library create/edit/import/acquisition/merge paths and export/restore schema as applicable; do not change wishlist controls or stars. Play Next should award **one** factor for Play priority, never sum old interest and priority, and retain existing dismissal calibration against that single numeric signal. Today profile coverage should consider a visible game incomplete when Play priority is unset, rather than requiring the removed enum field. Preserve readability of already saved recommendation explanations. Since this is a development-only schema break, document that older personal-data exports containing `priority` may need a fresh export rather than adding a data-preservation conversion.

## Build steps

- [x] 1. **Remove the redundant field.** Drop `LibraryEntry.priority` via the standard Prisma migration with no backfill; remove its form picker and update owned-game create/edit/import/acquisition/merge/export/restore paths. Done when the three existing library entries remain intact, retain their numeric stored values, and no longer have an independent enum priority; wishlist interest and `playSoon` are unaffected.
- [x] 2. **Unify Play Next and stars.** Remove the separate priority score and current explanation, use the canonical 1-5 library value as the sole Play priority contribution, and label every library star picker/readout, Preferences field, and related help/feedback as Play priority. Done when Play Next shows at most one Play priority reason per candidate, calibration still adjusts it, Today coverage no longer depends on the removed enum, and changing stars on a library card or detail page updates the same value after reload.

## Verify

- Unit tests for creation/edit, export/restore schema behavior, and Play Next scoring/explanations/calibration. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm prisma migrate status` after the schema migration.
- In the running app, confirm all three existing library games remain; inspect their Play priority stars, change stars on a card and on the detail page, reload, and generate a Play Next run with one priority reason. Check that a wishlist entry still says Interest and Buy recommendations remain unchanged. **User-reported verification:** card/detail star changes persist after reload, and Play Next shows the expected single priority reason. **Independent review:** explicitly waived by the user for this fix.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3912,"specSha256":"baa0c521ad0065e63dade9ad9e62a044a8a5d9e3cf5ad68b5647cd8d5685dc98","branch":"refs/heads/fix/unify-library-interest-and-priority","head":"ba04a7c6642d558c89b20d3bf0608911808e9b2e","baseRef":"refs/heads/main","baseCommit":"ba04a7c6642d558c89b20d3bf0608911808e9b2e","sourceTree":"d57410e661e8b1bfedc7d74a3562d5ea98ddea73","absentOptional":[]} -->

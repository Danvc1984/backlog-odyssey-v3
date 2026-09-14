# Feature: Add Game dialog with IGDB suggestion and interest

**From build-plan:** feature 26
**Build attempt:** 1
**Branch:** feature/add-game-dialog-with-igdb-suggestion-and-interest
**Status:** verified

## Goal

Let a user manually add an owned base game with an explicit 1-5 interest value (default 3) and optionally select an IGDB match before saving, so the new catalog game is created with the selected enrichment work queued from the start.

## In scope

- Extend the Library Add game dialog, including its empty-library and duplicate-review entry points, with the existing wishlist-style optional IGDB candidate search, selection, and paged results.
- Add an interest selector with the existing 1-5 values and default of 3.
- Persist the manual game, availability, library interest, and selected IGDB enrichment job atomically when a match is selected.
- Preserve the existing manual creation path when no IGDB match is selected.

## Out of scope

- Changing Steam imports, wishlist creation, DLC creation, source selection, duplicate detection, or recommendation behavior.
- Changing the existing catalog IGDB runner, provider contract, rate limits, snapshot shape, retries, or metadata replacement behavior.
- Creating an automatic IGDB match or synchronously waiting for provider enrichment before the game is saved.
- Schema migrations or changes to the existing 1-5 interest range.

## Build loop

Implement one checked step at a time. Run its focused Vitest coverage and the applicable lint or typecheck check, present the diff and results for review, and wait for approval before the next step. No Blueprint configuration file supplies checkpoint-commit settings; do not create checkpoint commits. `/complete` creates the final feature commit.

## Build steps

- [x] 1. Extend the authenticated catalog creation contract in `src/actions/games.ts` so a manual base game accepts an optional, validated 1-5 interest value and an optional positive selected IGDB ID. Keep the existing name, availability, and alternative-source validation and error shape. When an IGDB ID is supplied, create the catalog game and its existing IGDB `EnrichmentJob` in its initial queued state with that selected ID in the same Prisma transaction; when omitted, create no new job. Preserve the current default interest of 3 server-side rather than trusting the client default.
  - Done when a valid manual request creates the base `Game`, availability, and `LibraryEntry` with its selected interest, and an optional selected ID produces one queued catalog IGDB job tied to that new game; malformed interest or ID returns `Invalid input` without a write, and existing source error behavior is unchanged. Focused `src/actions/games.test.ts` coverage passes.

- [x] 2. Update `src/components/games/CreateGameDialog.tsx` to collect interest with the existing 1-5 selector, default it to 3 on open and reset, and offer the optional wishlist-style IGDB search flow for manual base games: explicit search from the entered name, selectable candidates with cover and release-date fallback, selection clearing, deduplicated 30-result paging, searching/submitting disabled states, and actionable in-dialog errors. Selecting a candidate may update the submitted name as the wishlist dialog does; clearing or skipping selection still allows normal creation. Submit the selected interest and ID through the extended action, close and refresh only after a successful create, and communicate that catalog creation succeeded while enrichment is queued when applicable.
  - Done when every Library Add game trigger opens the enhanced dialog, a user can add a game at any allowed interest with or without an IGDB selection, and search, no-result, provider-error, paging, selection, clearing, submission-error, and close/reset states leave the form understandable and usable. The existing source picker keyboard behavior remains intact; lint and typecheck pass.

- [x] 3. Add or update focused action tests for the new server contract, including default and explicit interest, invalid interest and IGDB ID rejection before database work, no-job creation without a selection, and atomic job creation with the selected ID. Run the affected suite and the full declared unit-test command.
  - Done when the action tests prove the persisted transaction shape and validation boundaries, `pnpm test` passes, and no UI component test is added for browser-only interaction.

## Files / areas

- `src/components/games/CreateGameDialog.tsx` - Library manual-create form and optional IGDB candidate UI.
- `src/actions/games.ts` - authenticated, Zod-validated atomic create and optional initial IGDB job persistence.
- `src/actions/games.test.ts` - server-action contract coverage.
- Existing catalog IGDB job types/selectors in `src/lib/igdb-job.ts` and the Prisma `EnrichmentJob` model - reuse only as required by the existing queued-job contract; no provider or schema change is planned.

## Data / contracts

- `interest` is an optional server-action input constrained to an integer from 1 through 5. Its absence persists 3, matching the shipped manual-creation default and wishlist selector.
- `selectedIgdbId` is optional and, when present, is a positive integer. It is not a new durable identity field.
- A selected ID creates the existing catalog `EnrichmentJob` for provider `IGDB` in its normal queued matching state, with `selectedIgdbId` set. The existing job runner remains the sole writer of IGDB identity, snapshot, derived artwork, and later provider evidence.
- The game, availability, library entry, and optional initial job share one transaction. A failure to create the job rolls back the game creation; later provider-job failure does not roll back a successfully created game.
- Server actions continue to call `requireUser`, validate unknown client input with Zod, and return `{ success, data, error }`. The authenticated allowed account is the trusted actor; no client identity is accepted.
- Candidate display text is rendered as React text, not HTML. Cover URLs remain decorative background imagery with no user-supplied HTML rendering.

## Testing

- Add focused Vitest assertions in `src/actions/games.test.ts` for default and supplied interest, invalid values, and optional queued-job persistence.
- Run `pnpm test` after the logic-bearing changes. There is no configured combined Verify command and no repository-owned browser-test command.
- During implementation, use the owner-run live browser review described in the coding standards to confirm the dialog flow, persisted interest, queued enrichment status, and reload behavior. This spec does not claim that live evidence has been run.

## Notes for the AI

- Reuse the candidate presentation and paging semantics from `AddWishlistDialog`, but keep catalog creation on the catalog IGDB job pipeline rather than calling wishlist actions or writing wishlist snapshots.
- The existing catalog action already defaults manual interest to 3; the UI must expose that value without weakening server-side validation.
- Do not add an automatic match, a new route, an API route, a migration, or a synchronous provider request to the submit path.
- Keep user-visible status, errors, and provider caveats factual. Associate labels with form controls and make failed validation or action feedback perceivable without relying only on toast messages.

<!-- blueprint:completion {"schemaVersion":1,"specBytes":7380,"specSha256":"50d49a40c5cf83e0033b9277ce0e9560cdd7f5319e14df2479ebc3df88db5b31","branch":"refs/heads/feature/add-game-dialog-with-igdb-suggestion-and-interest","head":"d81b3674793fa9b924186e63cd91a46c0668c785","baseRef":"refs/heads/main","baseCommit":"d81b3674793fa9b924186e63cd91a46c0668c785","sourceTree":"996fb9960cc29716c87f5d69fd71cd315af7ee76","absentOptional":[]} -->
## Manual try guide

1. Start the app with `pnpm dev` and open `/library` while signed in.
2. Open **Add game**, enter a game name, choose an interest value, and optionally select **Search** to choose an IGDB candidate.
3. Submit the game. Confirm the success message, the new library entry, the selected interest, and the queued IGDB enrichment status after refresh.
4. Repeat without selecting a candidate to confirm ordinary manual creation still succeeds.

Expected failures: an empty search reports no matches, provider errors remain in the dialog, and invalid submission leaves the dialog open with an actionable error.

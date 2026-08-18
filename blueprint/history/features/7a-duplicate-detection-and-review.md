# Feature: Duplicate detection and review

**From build-plan:** feature 7a
**Status:** not started

## Goal

Detect games with duplicate or near-duplicate names, create `PossibleDuplicate`
records with evidence and confidence, and provide a review UI where the owner can
browse findings and dismiss false positives. This is the detection and review half
of feature 7; merge and delete land in 7b.

## Design reference

None (no visual target).

## In scope

- `detectDuplicates()` server action: scans all base games, finds pairs with
  normalized name collisions (case-insensitive, punctuation-stripped), creates
  `PossibleDuplicate` records (status=OPEN) with evidence and confidence, skips
  pairs that already exist (OPEN or DISMISSED)
- Duplicates review UI: filter or section on `/library` showing open duplicate
  pairs with evidence, confidence, and links to both games
- `dismissDuplicate()` server action: sets status=DISMISSED and reviewedAt
- Duplicate warning on `/games/[id]` when the game has open duplicates

## Out of scope

- Merge and delete actions (deferred to 7b)
- Fuzzy or Levenshtein-based name matching (deferred; normalized exact match
  covers the common Steam-import-vs-manual case)
- Automatic detection on import (detection runs on-demand for now)
- Cross-namespace ExternalGameId collision detection (deferred)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - detectDuplicates action** - Create `src/actions/duplicates.ts`
  with `detectDuplicates()`. Calls `requireUser()`, fetches all base games
  (`type=BASE_GAME`) with their names. Normalizes each name (lowercase, strip
   non-alphanumeric, collapse whitespace). Groups by normalized name. For each
   group with 2+ games, creates `PossibleDuplicate` records for all pairwise
   combinations within the group, with `gameAId < gameBId` (the schema's unique
   constraint orders the pair),
  `confidence: 1.0` for exact normalized match, `evidence: { method: "name_match", normalizedName }`.
  Skips pairs where a record already exists (any status). Returns
  `{ success, data: { scanned, duplicatesFound }, error }`.
  *Done when:* the action compiles; unit tests pass for: two games with identical
  names create a pair, same pair is not duplicated on re-scan, dismissed pair is
  not overwritten, games with different names are not paired.

- [x] **Step 2 - dismissDuplicate action** - Add `dismissDuplicate(duplicateId)`
  to `src/actions/duplicates.ts`. Calls `requireUser()`, validates the duplicate
  exists and is OPEN, updates status to DISMISSED and sets reviewedAt. Returns
  `{ success, data: { id }, error }`.
  *Done when:* unit tests pass for: dismissing an OPEN duplicate, rejecting a
  non-existent ID, rejecting an already-DISMISSED duplicate.

- [x] **Step 3 - duplicates review UI** - Add a duplicates view to the library
  page. When a `duplicates=true` search param is set, the library page shows
  open `PossibleDuplicate` records instead of the normal game list. Each row
  shows both game names (linked), confidence, evidence method, and a "Dismiss"
  button that calls `dismissDuplicate()`. A "Scan for duplicates" button at the
  top calls `detectDuplicates()` and refreshes. Empty state: "No duplicates
  found" with a scan prompt. The normal library filters (source, state,
  collection) are hidden in duplicates mode.
  *Done when:* navigating to `/library?duplicates=true` shows open pairs after
  scanning; clicking Dismiss removes the pair from the list and shows a success
  toast; the "Scan for duplicates" button triggers detection and refreshes.

- [x] **Step 4 - duplicate warning on game detail** - On `/games/[id]`, query
  for any OPEN `PossibleDuplicate` where `gameAId` or `gameBId` matches the
  current game. If found, show a warning banner at the top of the page: "This
  game may be a duplicate of [other game name]" with a link to
  `/library?duplicates=true`. Dismissible per-page-load (no persistence).
  *Done when:* viewing a game with an open duplicate shows the warning with the
  other game's name and a link to the review page; viewing a game with no
  duplicates shows no warning.

## Files / areas

- `src/actions/duplicates.ts` (new) - detectDuplicates, dismissDuplicate
- `src/actions/duplicates.test.ts` (new) - unit tests
- `src/app/(app)/library/page.tsx` (modify) - duplicates mode via search param
- `src/components/games/DuplicatesList.tsx` (new) - duplicate pair list component
- `src/components/games/DuplicateWarning.tsx` (new) - game detail warning banner
- `src/app/(app)/games/[id]/page.tsx` (modify) - include DuplicateWarning

## Data / contracts

- `PossibleDuplicate` (existing schema):
  - `gameAId` / `gameBId` - ordered pair, `gameAId < gameBId` enforced by unique
    constraint
  - `evidence: Json` - `{ method: "name_match", normalizedName: string }` (load-bearing:
    7b may add merge evidence; future fuzzy matching will use different methods)
  - `confidence: Float` - 1.0 for exact normalized match
  - `status: DuplicateStatus` - OPEN / DISMISSED
  - `reviewedAt: DateTime?` - set when dismissed (or when merge/delete lands in 7b)
- Cascade delete on `Game` means deleting a game automatically removes its
  `PossibleDuplicate` rows (both as gameA and gameB). This is correct behavior.

## Testing

- Vitest configured, test gate on.
- **In-scope logic to test:**
  - `detectDuplicates()` - name normalization, pair creation with correct
    ordering, idempotent re-scan (no duplicates of duplicates), skip dismissed
  - `dismissDuplicate()` - success, not-found, already-dismissed
  - `normalizeName()` helper (if extracted) - punctuation stripping, whitespace
    collapse, case folding
- **Not unit-tested (UI/integration):**
  - Duplicates list rendering and dismiss flow - verified via browser
  - Game detail warning banner - verified via browser

## Notes for the AI

- Follow the `{ success, data, error }` return pattern.
- `requireUser()` before any DB access.
- The `PossibleDuplicate` unique constraint is `@@unique([gameAId, gameBId])`.
  Always order the pair so the lesser ID is gameAId. Use a helper like
  `orderedPair(id1, id2)` that returns `[min, max]`.
- The `evidence` field is `Json?` in Prisma. Store structured data, not a string.
- Detection fetches all base games in one query, then does in-memory grouping.
  For a single-user library (hundreds to low thousands of games) this is fine;
  no batching needed.
- The library page currently has no search-param-driven mode switching. The
  `duplicates=true` param should coexist with the existing `q`, `source`, `state`,
  `sort`, `collection` params. When `duplicates=true`, ignore the other filters
  and show the duplicates view instead.
- The DuplicatesList component needs a client wrapper for the Dismiss button
  (server action call + toast + router.refresh). Keep the list rendering in a
  server component and wrap only the button in a client component.

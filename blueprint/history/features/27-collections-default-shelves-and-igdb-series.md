# Feature: Collections: default shelves and IGDB series

**Status:** verified

**From build-plan:** feature 27
**Build attempt:** 1
**Branch:** feature/collections-default-shelves-and-igdb-series

## Goal

Expand calculated collections with the five planned default shelves and dynamic IGDB series and franchise shelves, while keeping manual collections and existing calculated shelves intact.

## In scope

- Add calculated In progress, Completed, Backlog, Handheld picks, and Games with DLC shelves.
- Derive series and franchise shelves dynamically from valid current IGDB metadata snapshots for catalog library games.
- Show dynamic shelves on Collections and make their detail pages routable and read-only.
- Preserve existing manual collections and calculated shelves: Play soon, Replay candidates, Favorites, Hidden, and Abandoned.
- Keep calculated collections usable anywhere the existing system-collection list is used, including the Library collection filter.

## Out of scope

- Persisting, pinning, editing, or manually curating series or franchise shelves.
- Changing IGDB enrichment, snapshot schemas, DLC acquisition, library grid/list behavior, recommendation logic, or personal collection actions.
- Adding game membership rows for calculated shelves.

## Build loop

- Implement one checked step at a time and stop for review after its focused tests and applicable checks pass.
- Checkpoint commits are disabled. `/complete` creates the feature commit after all steps are approved.
- Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before final completion because no combined Verify command exists.

## Build steps

- [x] **Step 1 - Define calculated shelf contracts and queries.** Extend `src/lib/system-collections.ts` with the five planned default shelf definitions alongside the existing ones, and a dynamic series/franchise shelf resolver based only on successfully parsed IGDB snapshots for games with a library entry. Use stable provider-qualified IDs that distinguish an IGDB collection from an IGDB franchise even when their names match. In progress maps to `IN_PROGRESS`, Completed to `PLAYED_BEFORE`, Backlog to `NOT_STARTED`, Handheld picks to `handheldSuitable: true`, and Games with DLC to base games with at least one acquired catalog DLC. Dynamic shelves disappear when no current matching library evidence remains. Add focused Vitest coverage for definitions, malformed or absent snapshot handling, duplicate evidence grouping, stable IDs, names, counts, and each membership filter.
  - **Done when:** The collection helper returns all existing and planned calculated shelves plus only current, valid IGDB-derived series/franchise shelves, and `pnpm test` passes for the helper coverage.

- [x] **Step 2 - Support dynamic calculated shelf routes and filtering.** Update the calculated collection lookup and game-query paths so `/collections/[id]` resolves the new default shelves and provider-qualified dynamic series/franchise shelves, returns their matching library base games with the existing card data, and safely treats unknown or malformed IDs as unavailable. Keep all calculated shelf detail pages read-only and preserve the existing search, sorting, accessibility labels, empty state, compatibility, duration, and card behavior. Update the Library collection-filter source where necessary so the expanded calculated shelf set is selectable without reinterpreting its URL contract. Add focused tests for route-facing resolver/query inputs and invalid IDs where the repository's current test seams permit.
  - **Done when:** Each calculated shelf can be opened and shows only its calculated games, an invalid calculated ID does not expose data, and relevant focused tests plus `pnpm typecheck` pass.

- [x] **Step 3 - Present calculated series and default shelves.** Update `/collections` to show the expanded default calculated shelves and a distinct dynamic IGDB series/franchise shelf section, with factual labels, counts, deterministic ordering, and the existing accessible link/card treatment. Empty series/franchise evidence must render an explanatory empty state rather than an empty decorative section. Do not expose edit or delete controls for calculated shelves. Run the full automated fallback gate.
  - **Done when:** Collections visibly separates built-in, dynamic IGDB, and personal shelves; dynamic shelves reflect the current library evidence; manual collections remain editable; and `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Files / areas

- `src/lib/system-collections.ts` and `src/lib/system-collections.test.ts` - calculated shelf definitions, dynamic IGDB parsing/grouping, counts, and game queries.
- `src/app/(app)/collections/page.tsx` - calculated shelf sections, cards, empty states, and icon mapping.
- `src/app/(app)/collections/[id]/page.tsx` - read-only calculated shelf resolution and matching game list.
- `src/components/games/LibraryFilters.tsx` and `src/app/(app)/library/page.tsx` - consume the expanded calculated shelf list only as required by the existing filter path.
- Existing IGDB payload parser and metadata snapshot schema - reuse as read-only evidence, with no migration.

## Data / contracts

- Calculated shelves remain code-owned views. They create no `Collection` or `CollectionMembership` records and cannot be edited or deleted.
- Default calculated shelves retain stable system IDs. Dynamic IDs must encode `series` or `franchise` plus the positive IGDB entity ID, not the display name.
- A dynamic shelf is derived only from a `MetadataSnapshot` with provider `IGDB` whose payload passes `parseIgdbMetadataPayload`; null, malformed, stale replacement, or non-library evidence contributes nothing.
- A shelf groups current library base games by its parsed `collection` or `franchise` object. The display name comes from that IGDB evidence, and a duplicate game/evidence contribution is counted once.
- Games with DLC includes catalog base games with one or more acquired `Game` DLC records. DLCs themselves remain outside library and calculated shelf result cards because they have no `LibraryEntry`.
- Calculated route IDs are server-resolved. Unknown IDs, malformed IDs, and unknown IGDB entity IDs must not return catalog data.

## Testing

- Add Vitest tests adjacent to the system-collection logic for all new default filters, valid and invalid IGDB payload parsing, dynamic grouping, ID stability, empty evidence, and query selection.
- Extend route/helper tests only through existing repository seams. Do not add browser tooling.
- Before completion run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- Manual review after implementation: open `/collections`, verify all three shelf groups and a populated dynamic shelf, open a default and a dynamic shelf, search and sort each, verify calculated shelves expose no edit/delete actions, and confirm a personal shelf stays editable.

## Notes for the AI

- The user chose dynamic enumeration: series and franchise shelves are derived from current library evidence and are not pinned.
- Reuse `parseIgdbMetadataPayload` rather than trusting JSON snapshot payloads. Keep dynamic resolution server-side and avoid N+1 count or membership queries.
- Preserve the existing Odyssey visual system, semantic tokens, reduced-motion/reduced-data behavior, keyboard focus treatment, and factual status copy.
- All protected server entry points must continue to obtain the trusted owner through the established authentication guard. Never accept collection identity or membership data from the client for calculated results.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7585,"specSha256":"5ff903bec342ed01da256f1deed1b429bdb02586319f848875b404f544f5e586","branch":"refs/heads/feature/collections-default-shelves-and-igdb-series","head":"9b1627cbbe56e2397c75a98a4df984dc72dc0ffe","baseRef":"refs/heads/main","baseCommit":"2d8f607c279dbcee03526e446156a459d016f4df","sourceTree":"77a521de05210a4cba49afdb2fa1f5e4512e7f60","absentOptional":[]} -->

## Verification

- Automated: pnpm test passed with 142 files and 1,362 tests; pnpm typecheck, pnpm build, and git diff --check passed.
- Manual acceptance: the user verified /collections, built-in and dynamic calculated shelves, calculated shelf detail routing, search and sorting, Library collection filtering, calculated read-only controls, and personal collection editing.
- Independent review: none requested.

## Manual try guide

### Start

Run pnpm dev from the project root and open http://localhost:3500.

### Review

1. Open /collections. Expect separate built-in, IGDB series/franchise, and personal collection sections.
2. Open a default shelf and a populated igdb-series-<id> or igdb-franchise-<id> shelf. Search and sort both; expect only matching library base games.
3. Confirm calculated shelves have no edit or delete controls, while a personal shelf remains editable.
4. Open /library and select a calculated shelf from Collection filters. Expect the same calculated membership.

### Watch For

- Malformed or unknown calculated IDs must not expose catalog data.
- Empty IGDB evidence should show an explanatory empty state rather than an empty shelf grid.

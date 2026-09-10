# Feature: Handheld-suitable personal flag (22a)

**From build-plan:** feature 22a
**Status:** not started

## Goal

Let the owner mark any catalog game or wishlist entry as a handheld option with
a nullable personal flag on `LibraryEntry` and `WishlistEntry`. A checked mark
means the owner selected it as a handheld option; null means it is unmarked.
It is stored and editable now so feature 22b can consume a settled contract;
nothing in this feature changes recommendations, eligibility, or any engine
behavior.

## Design reference

Not a replication feature. All affordances mirror the existing personal-field
patterns: the checkbox toggles in `PlayStateSection` (game detail) and
`EditWishlistDialog`, and the read-only `Experience:` line in
`WishlistDetailHero`. No prototypes or reference images exist; none are needed.

## In scope

- Nullable `handheldSuitable Boolean?` on `LibraryEntry` and `WishlistEntry`
  plus one Prisma migration. `true` means the owner selected it as a handheld
  option; `null` means unmarked (default for all existing rows).
- Edit affordance on game detail: "Handheld option" checkbox beside the other
  toggles in `PlayStateSection`, saved through `updatePersonalFields`.
- Edit affordance on wishlist: the same checkbox in `EditWishlistDialog`, saved
  through `updateWishlistEntry`. Editable for base-game and DLC wishes alike
  (no type gating, mirroring `gameExperience`).
- Read-only display on wishlist detail: a line in `WishlistDetailHero` shown
  only when the flag is not null.
- Library filter: a "Handheld" select inside the existing "More filters"
  popover with Any / Marked / Unmarked, backed by a
  `handheld` search-param value.
- Export/import: the flag flows into the personal-data JSON export and is
  restored by the Zod-validated import.

## Out of scope

- Any recommendation behavior: no boost, caveat, rescue, floor, explanation,
  profile dimension, tune option, or eligibility change (feature 22b).
- No Library card badge, no Wishlist card display, no Wishlist filter.
- No data-health completeness counting, no quick-create or bulk-edit surfaces.
- No OS-setup or compatibility-gate changes; the flag is pure personal data.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Schema and migration** - add `handheldSuitable Boolean?` to
  `LibraryEntry` (after `gameExperience`) and `WishlistEntry` (after
  `gameExperience`) in `prisma/schema.prisma`, then run
  `pnpm prisma:migrate -- --name add_handheld_suitable`. No app code changes.
  *Done when:* the migration applies cleanly to the dev database, the Prisma
  client regenerates, `pnpm typecheck` passes, and both columns exist nullable
  with no default.
- [x] **Step 2 - Game detail editing** - extend `updatePersonalFieldsSchema`
  in `src/actions/game-detail.ts` with `handheldSuitable:
  z.boolean().optional().nullable()` and persist it; add the "Handheld option"
  checkbox beside the other toggles in `PlayStateSection`, saved through
  `updatePersonalFields`. *Done when:* checking and unchecking the mark on a
  game detail page persists true and null across a reload, and `pnpm typecheck`
  passes.
- [x] **Step 3 - Wishlist editing and read-only detail display** - extend
  `updateWishlistEntrySchema` in `src/actions/wishlist.ts` with the same
  optional nullable boolean and persist it; add the checkbox to
  `EditWishlistDialog`; add `handheldSuitable` to the shared `entry` prop
  shape in `WishlistEntryActions` and `EditWishlistDialog` and pass it from
  both call-site pages (select the column in `/wishlist` and
  `/wishlist/[id]` queries); show a read-only "Handheld option" line in
  `WishlistDetailHero` only when marked.
  *Done when:* editing a wish's flag from the list and from the detail page
  persists across reload; the detail hero shows the line when marked and
  nothing when unmarked; `pnpm typecheck` passes.
- [x] **Step 4 - Library handheld filter** - add
  `src/lib/library-handheld-filter.ts` exporting
  `parseHandheldSuitabilityFilter(value?: string): true | null | undefined`
  (accepts `marked`, `unmarked`; anything else → undefined) with unit tests;
  read the `handheld` param in
  `LibraryFilters.tsx` and add a "Handheld" select in the More filters
  popover (Any / Marked / Unmarked), including it in
  `hasHiddenFilters`; map the param through the parser in
  `src/app/(app)/library/page.tsx` into the `LibraryEntry` where clause
  (`true` / `null` respectively) and into the empty-state "has filters"
  condition. *Done when:* the filter narrows the grid and list to marked or
  unmarked games; unknown values behave as no
  filter; the More filters button highlights while active; clearing resets;
  `pnpm test` passes including the new parser tests.
- [x] **Step 5 - Export and import** - add `handheldSuitable:
  z.boolean().nullable().optional()` to `libraryEntrySchema` and
  `wishlistEntrySchema` in `src/lib/export-schema.ts` (optional so v2 export
  documents written before this feature keep importing; `EXPORT_VERSION`
  stays 2); the export writer needs no change because rows are read whole.
  Update `export-schema.test.ts`, `export-schema-doc.test.ts`, and
  `import-restore.test.ts` fixtures: the flag round-trips true/null,
  and an old document without the key still imports, restoring null.
  *Done when:* exporting after flagging a game shows the field in the JSON;
  importing that export into an empty schema restores the value; importing a
  fixture without the key succeeds; `pnpm test` passes.
- [x] **Step 6 - Full verification** - run `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, and `pnpm build`, and walk the manual path end to end. *Done
  when:* all commands pass and the walkthrough below behaves as described.

## Files / areas

- `prisma/schema.prisma` + new migration (Step 1)
- `src/actions/game-detail.ts` (Step 2)
- `src/components/games/PlayStateSection.tsx` (Step 2)
- `src/lib/personal-field-help.ts` (Step 2: help entry; labels if needed)
- `src/actions/wishlist.ts` (Step 3)
- `src/components/wishlist/EditWishlistDialog.tsx`,
  `src/components/wishlist/WishlistEntryActions.tsx`,
  `src/components/wishlist/WishlistDetailHero.tsx` (Step 3)
- `src/app/(app)/wishlist/page.tsx`, `src/app/(app)/wishlist/[id]/page.tsx`
  (Step 3: select + entry object)
- `src/lib/library-handheld-filter.ts` (new, Step 4) +
  `src/lib/library-handheld-filter.test.ts`
- `src/components/games/LibraryFilters.tsx`,
  `src/app/(app)/library/page.tsx` (Step 4)
- `src/lib/export-schema.ts`, `src/lib/export-schema.test.ts`,
  `src/lib/export-schema-doc.test.ts`, `src/lib/import-restore.test.ts` (Step 5)

## Data / contracts

- **Load-bearing for 22b:** `handheldSuitable: Boolean?` on both models with
  binary mark semantics - `true` = owner selected the game as a handheld
  option, `null` = unmarked. 22a attaches no engine meaning.
- Server-action inputs (both optional + nullable, additive):
  `updatePersonalFields(gameId, { handheldSuitable?: boolean | null, ... })`
  and `updateWishlistEntry({ id, handheldSuitable?: boolean | null, ... })`.
- Library search param: `handheld` ∈ `marked` | `unmarked`
  (absent or unrecognized = no filter).
- Export document (version stays 2): `libraryEntries[].handheldSuitable` and
  `wishlist[].handheldSuitable` as `boolean | null`, always written by the
  exporter, tolerated absent by the importer.

## Testing

Vitest is configured (`pnpm test`); logic-bearing steps ship tests.

- Unit: `parseHandheldSuitabilityFilter` - both known values, absent, and
  unrecognized input (Step 4).
- Unit: export/import - round-trip of true/null and the pre-feature
  document without the key importing as null (Step 5).
- Manual walkthrough: mark a game as a handheld option on its detail page;
  clear it; reload to confirm persistence; edit a base-game
  wish and a DLC wish from the list and from detail; verify the read-only
  hero line appears only when set; filter the Library by marked, unmarked, and
  an unknown value; export, mark something else, import into a
  throwaway empty schema (or verify via the fixtures), and confirm values
  restore. Full manual path per step in "Done when" above.

## Notes for the AI

- Server-side first: schema, actions, and parsing are server concerns; only
  the form, dialog, filter bar, and hero line are client components. All
  actions already gate through `requireUser()` - keep it that way.
- Mirror the existing play-state toggles: a checkbox where checked maps to
  `true` and unchecked maps to `null`, `.optional().nullable()` Zod fields,
  spread-only update objects (`...(x !== undefined && { x })`), and help text from
  `PERSONAL_FIELD_HELP`. Field help stays plain and factual (voice rules);
  do not promise recommendation effects that ship in 22b.
- The import schema addition must be `.optional()`: documents exported before
  this feature lack the key, and restore is a disaster-recovery path that
  must keep accepting them. Do not bump `EXPORT_VERSION`.
- Do not touch engine, profile, tune, eligibility, or data-health code in
  this feature - grep hits for `gameExperience` in `src/lib/recommendations/`
  and `src/lib/today-data-health.ts` are 22b/other territory.
- No code comments unless asked; follow `blueprint/context/coding-standards.md`.

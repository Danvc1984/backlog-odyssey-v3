# Feature: Source selection, details, and Library browsing

**From build-plan:** feature 12e-b
**Status:** not started

## Goal

Make the reusable alternative sources from 12e-a usable day to day. Game
detail gets checkbox-based availability selection (Steam, ROM, and each saved
alternative source) with type-ahead create-or-reuse, every source value gains
its icon, and Library gains individually filterable alternative sources with
real source names instead of repeated "Other platform" labels.

## Design reference

None. Functional UI under the current look; feature 14 owns visual redesign.

## In scope

- Checkbox-based availability editor on game detail: one checkbox for Steam,
  one for ROM, and one per saved alternative source; checked means the game
  has that availability row; unchecking removes the row. Checking adds it.
- New server actions to add and remove availability rows with the same
  integrity rules as every other row-creating path.
- Type-ahead create-or-reuse for alternative sources on the game-detail
  editor and in quick-create: typing a known label or alias reuses it, a new
  name creates a custom source, then the row is added.
- Icon-decorated source values on game detail (chips and rows) using the
  known-source icons from 12e-a plus icons for the built-ins Steam and ROM.
- Library and collection-detail availability columns showing real source
  names (Epic Games Store, GOG) instead of repeated "Other platform".
- Library source filter extended with "All alternatives" and one individually
  selectable entry per saved active alternative source, each with its icon.
- Accessible fallback-icon treatment: custom sources render the shared
  fallback icon `aria-hidden` beside visible text; nothing is icon-only.
- Unit tests for all new logic (Vitest gate is on).

## Out of scope

- Play-next source tuning, tune/preset context extension, hidden-game
  evidence retention, and second-chance replay candidates (12e-c).
- Wishlist-side source selection; the acquire dialog keeps its current
  Steam/Other platform/ROM choice (edited after acquisition on game detail).
- Source management (create, rename, archive) stays in the Settings card
  from 12e-a; no destructive deletion anywhere.
- Visual redesign, theming, and wallpaper (feature 14 and 15).
- Changing `updateGameAvailability` semantics; its source-move path stays for
  compatibility but the new UI changes sources by checking and unchecking.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Built-in source presentation** - In
  `src/lib/sources/known-sources.ts` (client-safe, no Prisma) add
  `availabilitySourcePresentation(source, alternativeSourceName)` returning
  `{ label, iconName }`: `STEAM` and `ROM` get fixed built-in labels and lucide
  icons (Steam: `MonitorPlay`, ROM: `Disc3`; exact picks may adjust),
  `OTHER_PLATFORM` resolves through `resolveSourcePresentation` on the related
  source name, and a null name falls back to "Other platform" with the
  fallback icon. *Done when:* tests cover built-ins, alternative resolution,
  and the null-name fallback; `pnpm test` and `pnpm typecheck` green.
- [x] **Step 2 - Add and remove availability actions** - In
  `src/actions/game-detail.ts` add `addGameAvailability(gameId, input)` and
  `removeGameAvailability(availabilityId)` following `{ success, data, error }`.
  Add accepts exactly one of: `{ source: "STEAM" }`, `{ source: "ROM" }`, or
  `{ source: "OTHER_PLATFORM", alternativeSourceId: string }`; rejects a
  duplicate built-in row or a duplicate alternative row with a friendly
  message and falls back to the P2002 catch; verifies the game exists and,
  for alternatives, that the source exists and is not archived (archive
  prevents new selection). Remove rejects a STEAM row that carries any
  synchronized statistic (`steamAppId`, `steamPlaytimeTotal`, or
  `steamLastPlayed` non-null) with "Steam statistics are synchronized";
  ROM and alternative rows delete freely. *Done when:* `game-detail.test.ts`
  covers each add variant, duplicate guards (STEAM, ROM, alternative), a
  missing source id, an archived-source rejection, the protected-Steam-row
  rejection, and successful removals; `pnpm test` green.
- [x] **Step 3 - Checkbox availability editor** - Add a shadcn-style
  `src/components/ui/checkbox.tsx` (radix, already installed) and extract
  `src/components/sources/SourceIcon.tsx` from the Settings card. Replace
  `AvailabilityRowForm` on game detail with an `AvailabilityEditor` client
  component: a checkbox list of Steam, ROM, and every saved source; a checked
  box means a row exists, toggling calls the step-2 actions; a synced Steam
  row renders a disabled checkbox with an explanatory title; each checked row
  keeps an optional display-name input saved via `updateGameAvailability`
  (displayName only, explicit Save button); every row shows its icon and
  label from step 1; archived sources appear only when the game still has
  their row: checked, removable, never re-creatable; zero rows shows an
  empty state. Server page passes the game's rows and the full saved-source
  list. *Done when:* manual walkthrough checks and unchecks Steam, ROM, and
  a saved alternative source with state persisting after reload; a synced
  Steam row cannot be unchecked; an archived source's existing row can still
  be removed; display names still save; icons show on every row;
  `pnpm build` green.
- [x] **Step 4 - Type-ahead create-or-reuse** - Add a pure
  `suggestSources(query, savedSources)` to `src/lib/sources/known-sources.ts`:
  case-insensitive contains over known labels and aliases not yet saved, all
  known suggestions on an empty query, and a flag for whether the query
  matches an existing saved source. Below the checkbox list render an
  "Add a source not listed" input with a keyboard-operable suggestion list
  (arrow keys move, Enter or click selects, Escape closes) built from
  existing primitives, no new dependencies. Selecting a suggestion or
  submitting free text calls `createAlternativeSource` (alias-aware
  create-or-reuse) then `addGameAvailability`; a name colliding with an
  archived source surfaces the action's friendly error instead of creating a
  duplicate. *Done when:* `suggestSources` tests cover alias matches ("EGS"
  suggests Epic Games Store), existing-source detection, and empty-query
  behavior; manual walkthrough types "EGS" to add Epic, types a new custom
  name to create source plus row, and both persist after reload; `pnpm test`
  and `pnpm build` green.
- [x] **Step 5 - Library filters and real source labels** - On
  `/library` load the saved non-archived sources and pass them into
  `LibraryFilters`; extend the source Select with "All alternatives"
  (`OTHER_PLATFORM`) and an "Alternative sources" group with one
  icon-decorated entry per source. Accept an `alt=<sourceId>` search param
  that takes precedence over `source` and filters
  `availability: { some: { source: "OTHER_PLATFORM", alternativeSourceId } }`;
  include `alt` in the no-results message condition. In the library and
  `collections/[id]` tables include `alternativeSource` on the availability
  rows and render labels via `availabilitySourcePresentation` so multiple
  alternative rows no longer repeat "Other platform". *Done when:* manual
  walkthrough filters by one specific source and sees only its games, "All
  alternatives" shows every alternative game, Steam/ROM filters behave as
  before, the column shows "Epic Games Store" not "Other platform", and
  bookmarked filter URLs survive reload; `pnpm build` green.
- [x] **Step 6 - Quick-create source picker** - In `CreateGameDialog` replace
  the three-option Select with the same picker primitives: built-in Steam
  (default) and ROM options plus the step-4 suggestion list of saved and
  known sources. Submit maps a built-in to `availabilitySource` and an
  alternative to `availabilitySource: "OTHER_PLATFORM"` with the source
  resolved through `createAlternativeSource` first. Extend the `createGame`
  schema with an optional `alternativeSourceId` honored only for
  `OTHER_PLATFORM`; when it is absent keep the current Unspecified fallback.
  *Done when:* `games.test.ts` covers create with an alternative source id,
  create falling back to Unspecified for `OTHER_PLATFORM` without one, and
  unchanged Steam/ROM behavior; manual walkthrough quick-creates a game on a
  chosen alternative source and the detail page shows it; `pnpm test` and
  `pnpm build` green.
- [x] **Step 7 - Verification** - Run `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, and `pnpm prisma migrate status`. Manual pass:
  the full check/uncheck flow with icons, type-ahead reuse of an alias, a
  custom source creation, synced-Steam protection, Library individual
  filters and labels, quick-create with an alternative source, and Settings
  archive behavior still excluding archived sources from new selection.
  *Done when:* all commands green and every observation above holds.
- [x] **Step 8 - Remove unused alternative sources** - Add a server action to
  permanently remove an alternative source only when it has zero associated
  availability rows; reject invalid or in-use source ids with friendly errors
  and preserve archive behavior for sources still in use. In Settings, show a
  `Remove` control only for sources with `0 in use`, require the existing
  confirmation pattern, refresh the list after success, and cover the action
  and UI state with tests. *Done when:* an unused custom source can be removed
  from Settings, an in-use source cannot be removed, and the removed source no
  longer appears in new source pickers; `pnpm test` and `pnpm build` green.

## Files / areas

- `src/lib/sources/known-sources.ts` (+ test): built-in presentation and
  `suggestSources`
- `src/actions/game-detail.ts` (+ test): add/remove row actions
- `src/actions/sources.ts` (+ test): create, archive, and remove unused
  alternative sources
- `src/actions/games.ts` (+ test): `createGame` alternative-source input
- `src/components/ui/checkbox.tsx` (new)
- `src/components/sources/SourceIcon.tsx` (new),
  `AlternativeSourcesCard.tsx` (reuse the extracted icon)
- `src/components/games/AvailabilityEditor.tsx` (new, replaces
  `AvailabilityRowForm.tsx`), `LibraryFilters.tsx`, `CreateGameDialog.tsx`
- `src/app/(app)/games/[id]/page.tsx`, `src/app/(app)/library/page.tsx`,
  `src/app/(app)/collections/[id]/page.tsx`

## Data / contracts

Load-bearing: 12e-c stores alternative-source IDs in the play tune context;
the add/remove actions below are the canonical row-mutating paths and any
future path must reuse them, as 12e-a did for row creation.

- `addGameAvailability(gameId, input)` where input is
  `{ source: "STEAM" } | { source: "ROM" } |
  { source: "OTHER_PLATFORM", alternativeSourceId: string }`, returning
  `{ success, data: GameAvailability, error }`.
- `removeGameAvailability(availabilityId)` returning
  `{ success, data: { id }, error }`; guard: reject STEAM rows carrying any
  synchronized statistic.
- `deleteAlternativeSource(id)` returning `{ success, data: { id }, error }`;
  guard: only sources with zero `GameAvailability` rows may be deleted.
- `availabilitySourcePresentation(source: AvailabilitySource,
  alternativeSourceName: string | null)` returning `{ label, iconName }`.
- `suggestSources(query: string, savedSources: readonly { name: string }[])`
  returning `{ known: KnownSource[], matchesSaved: boolean }`.
- URL contract (UI-only): `/library?alt=<alternativeSourceId>` filters one
  alternative source; `source=OTHER_PLATFORM` means all alternatives;
  `alt` wins when both are present.
- `createGame` accepts optional `alternativeSourceId`, honored only with
  `availabilitySource: "OTHER_PLATFORM"`; absent keeps the Unspecified
  fallback. STEAM and ROM rows always keep `alternativeSourceId` null.
- No schema or migration changes; 12e-a's models are final for this feature.

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `known-sources.ts`: built-in presentation, alternative resolution, null
  fallback, `suggestSources` alias matching, saved detection, empty query.
- `game-detail.ts`: add variants and guards, protected Steam row, removals.
- `games.ts`: `createGame` with and without an alternative source id.
- UI steps (3 to 6) and step 7 ride on the running app plus `pnpm build`,
  per the Browser Verification standard; no Playwright.

## Notes for the AI

- Single-user app: `requireUser()` at every action entry; Zod-validate all
  inputs; follow `{ success, data, error }`; use `prisma migrate status` only
  to confirm nothing drifted (no migration in this feature).
- `known-sources.ts` must stay Prisma-free so client components can import
  it; server helpers live in `src/lib/sources/store.ts` (server-only).
- Removing a source row is not deleting a source: `AlternativeSource`
  records are never deleted; `onDelete: Restrict` stays the safety net.
- Never infer a source from `displayName`; it stays a per-game label.
- Synced Steam rows are protected: removal guard checks the three statistic
  fields, matching 7c's protection of synchronized provider statistics.
- Archived sources: never newly selectable; existing rows keep rendering
  with icon and name; a create attempt on a colliding archived name shows
  the friendly error, never a duplicate record.
- Icons render `aria-hidden` with visible text labels everywhere; custom
  sources use the shared `Box` fallback icon.
- No new package dependencies; build the suggestion list from existing
  primitives.
- Branch: `feature/source-selection-and-library-browsing`.

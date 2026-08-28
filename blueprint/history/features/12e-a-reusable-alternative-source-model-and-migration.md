# Feature: Reusable alternative-source model and migration

**From build-plan:** feature 12e-a
**Status:** not started

## Goal

Replace per-game free-form "Other platform" availability with reusable,
single-user alternative-source records. A catalog game can then carry several
store sources (Steam plus Epic, GOG, and so on) with stable identities, which
12e-b renders as icon-decorated selection, detail chips, and Library filters,
and 12e-c uses for soft play-next source tuning. This feature delivers the
model, the code-owned known-source registry, integrity in every row-creating
or row-moving path, the conservative migration of existing `OTHER_PLATFORM`
rows, and a Settings management surface (create, rename, archive; no delete).

## In scope

- `AlternativeSource` model plus `GameAvailability.alternativeSourceId` and a
  `(gameId, source, alternativeSourceId)` unique constraint.
- One migration: collapse per-game duplicate `OTHER_PLATFORM` rows, insert the
  `Unspecified other source` record, backfill every `OTHER_PLATFORM` row to it.
- Code-owned known-source registry: ten known sources with canonical labels,
  aliases, and lucide icon names; name normalization; presentation resolver.
- Integrity in the row-creating and row-moving paths: quick-create, wishlist
  acquisition, detail-page source edits, and merge union dedupe.
- Settings "Alternative sources" card: list with icon, usage count, and
  archived state; create (alias-aware create-or-reuse), rename, archive and
  unarchive; no delete anywhere.
- Unit tests for all new logic (Vitest gate is on).

## Out of scope

- Checkbox-based source selection, type-ahead create-or-reuse on game forms,
  icon-decorated detail values, and individual Library filters (12e-b).
- Play-next source tuning, tune/preset context extension, hidden-game
  evidence retention, and second-chance semantics (12e-c).
- Destructive source deletion or a reassignment flow; archived sources stay
  referenced and resolvable forever.
- Display changes on existing surfaces: the "Other platform" label and the
  current detail-page availability presentation stay until 12e-b.
- Wishlist-side availability (wishes have no availability rows) and any
  non-Steam store import (excluded from the MVP).

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
these off as it finishes them.

- [x] **Step 1 - Schema and migration** - Add the `AlternativeSource` model
  and `GameAvailability.alternativeSourceId` (nullable FK, `onDelete:
  Restrict`) plus `@@unique([gameId, source, alternativeSourceId])`. Generate
  the migration with `--create-only`, then extend its SQL: fold duplicate
  `OTHER_PLATFORM` rows per game into the oldest row (`addedAt`, tiebreak
  `id`), copying `displayName` over when the kept row has none; insert the
  `Unspecified other source` record; set `alternativeSourceId` on every
  remaining `OTHER_PLATFORM` row. No store is inferred from display names.
  *Done when:* `pnpm prisma:migrate` applies cleanly, `pnpm prisma migrate
  status` is up to date, every existing `OTHER_PLATFORM` row references the
  `Unspecified other source` record in Prisma Studio with its display name
  verbatim, and `pnpm typecheck` plus `pnpm build` are green.
- [x] **Step 2 - Known-source registry** - `src/lib/sources/known-sources.ts`
  (client-safe, no Prisma imports): the ten known sources (key, canonical
  label, aliases, lucide icon name), `UNSPECIFIED_OTHER_SOURCE_NAME`,
  `normalizeSourceName` (trim, collapse whitespace, lowercase),
  `matchKnownSource(name)` matching canonical names and aliases, and
  `resolveSourcePresentation` returning label plus icon name with a fallback
  icon for custom sources.
  *Done when:* tests cover normalization, alias matches ("EGS" resolves to
  Epic Games Store, "Origin" to EA app), non-matches, and the custom-source
  fallback; `pnpm test` green.
- [x] **Step 3 - Server store and row-creation wiring** -
  `src/lib/sources/store.ts` (server-only): `getOrCreateUnspecifiedSource(tx)`
  and `findOrCreateSourceByKnownKey(tx, key)`. Wire `createGame` so an
  `OTHER_PLATFORM` availability row attaches the unspecified source, and wire
  wishlist acquisition the same way for both the base-game flow and the DLC
  default. STEAM and ROM rows keep `alternativeSourceId` null.
  *Done when:* action tests in `games.test.ts` and
  `wishlist-acquisition.test.ts` show created `OTHER_PLATFORM` rows carrying
  the source id and STEAM/ROM rows leaving it null; `pnpm test` green.
- [x] **Step 4 - Availability edit rules** - `updateGameAvailability`: a
  source change to `OTHER_PLATFORM` attaches the unspecified source; a change
  away clears `alternativeSourceId`; a duplicate guard rejects moving a row
  onto a source the game already has (built-ins by source, alternatives by
  source plus source id) with a friendly message instead of a raw DB error.
  *Done when:* `game-detail.test.ts` covers ROM to OTHER_PLATFORM (attaches),
  OTHER_PLATFORM to ROM (clears), a second STEAM row rejected, and a duplicate
  alternative rejected; `pnpm test` green.
- [x] **Step 5 - Merge dedupe** - Extend the availability union in
  `src/lib/catalog-operations.ts`: a discarded row whose
  `(source, alternativeSourceId)` already exists on the survivor is folded,
  mirroring the STEAM-by-appId handling (delete with snapshot, survivor
  `displayName` filled from the duplicate when the survivor has none).
  Distinct sources still union normally.
  *Done when:* `catalog-operations.test.ts` covers same-source ROM and
  OTHER_PLATFORM folds (with and without a display-name fold), different
  sources kept, and the undo snapshot containing the deleted rows; `pnpm test`
  green.
- [x] **Step 6 - Source management actions** - `src/actions/sources.ts` with
  Zod-validated `createAlternativeSource`, `renameAlternativeSource`, and
  `setAlternativeSourceArchived`, following the `{ success, data, error }`
  pattern. Create resolves typed names through `matchKnownSource`: a known
  match creates (or reuses) the registry source with its canonical name and
  key; a custom name must not collide on `normalizedName`. Rename never
  touches `knownKey`.
  *Done when:* action tests cover alias create-or-reuse ("Epic" resolves to
  the existing Epic record unchanged), normalized-name collision errors on
  create and rename, and archive idempotence; `pnpm test` green.
- [x] **Step 7 - Settings card** - Add an `AlternativeSourcesCard` to
  Settings listing sources with icon, name, known/custom marker, usage count,
  and archived badge; create from free text or one-click known sources not
  yet created; inline rename; archive/unarchive; no delete control. Match the
  existing Settings sections' structure and styling.
  *Done when:* a manual walkthrough creates, renames, archives, and
  unarchives a custom source and the list reflects it after reload;
  `pnpm build` green.
- [x] **Step 8 - Verification** - Run `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, and `pnpm prisma migrate status`. Manual pass:
  a migrated game's row shows the unspecified source; quick-create with
  Other platform links the record; acquiring a DLC wish creates a linked row;
  the Settings flows from steps 6 and 7 work; archived and active states
  persist after reload.
  *Done when:* all commands green and every manual observation above holds.

## Files / areas

- `prisma/schema.prisma` plus one new migration
- `src/lib/sources/known-sources.ts` (new) + `known-sources.test.ts` (new)
- `src/lib/sources/store.ts` (new)
- `src/actions/sources.ts` (new) + `sources.test.ts` (new)
- `src/actions/games.ts` (+ test), `src/actions/game-detail.ts` (+ test),
  `src/actions/wishlist.ts` (+ `wishlist-acquisition.test.ts`)
- `src/lib/catalog-operations.ts` (+ `catalog-operations.test.ts`)
- `src/app/(app)/settings/page.tsx` and
  `src/components/sources/AlternativeSourcesCard.tsx` (new)

## Data / contracts

Load-bearing: 12e-b renders icons and builds selection/filtering from the
registry and the new FK; 12e-c stores registry keys and alternative-source IDs
in the play tune context. Lock these now.

- `AlternativeSource`: `id`, `name`, `normalizedName` (unique), `knownKey`
  (nullable, unique; set only from a registry match), `archivedAt` (nullable;
  not null means archived), timestamps. No user relation (single-user app).
  Catalog-owned: `Restart recommendations` never touches it.
- `GameAvailability`: plus nullable `alternativeSourceId` FK with
  `onDelete: Restrict`. Invariant: set if and only if `source` is
  `OTHER_PLATFORM`, enforced in the actions (not by a DB constraint, see
  notes). `@@unique([gameId, source, alternativeSourceId])` prevents duplicate
  alternative rows per game; built-in uniqueness (one STEAM, one ROM row per
  game) is enforced in code because Postgres treats NULLs as distinct.
- Registry keys and canonical labels: `EPIC_GAMES_STORE` (Epic Games Store),
  `GOG` (GOG), `EA_APP` (EA app), `UBISOFT_CONNECT` (Ubisoft Connect),
  `BATTLE_NET` (Battle.net), `XBOX_MICROSOFT_STORE` (Xbox/Microsoft Store),
  `ITCH_IO` (itch.io), `AMAZON_GAMES` (Amazon Games), `HUMBLE_BUNDLE`
  (Humble Bundle), `ROCKSTAR_GAMES_LAUNCHER` (Rockstar Games Launcher). Each
  entry carries aliases and a lucide icon name; exact icon picks may adjust
  during implementation, keys and labels may not.
- `UNSPECIFIED_OTHER_SOURCE_NAME = "Unspecified other source"` (normalized
  `unspecified other source`), a custom record (no known key) inserted by the
  migration. Creation paths resolve it by exact normalized name; if the owner
  renamed it, a fresh record with this name is created.
- Actions: `createAlternativeSource({ name })`,
  `renameAlternativeSource(id, { name })`,
  `setAlternativeSourceArchived(id, { archived })`, each returning
  `{ success, data, error }`.

## Testing

Vitest is the gate; logic-bearing steps ship tests in the same diff.

- `known-sources.ts`: normalization, alias resolution, fallback presentation.
- `store.ts` and the wired actions: unspecified-source attachment, duplicate
  guards, transition rules, alias create-or-reuse, collisions, archive.
- `catalog-operations.ts`: merge folds and snapshot contents.
- Step 1 rides on the applied migration plus Studio evidence; steps 7 (UI) and
  8 ride on the running app plus the build.

## Notes for the AI

- Single-user app: `requireUser()` at every action entry; Zod-validate all
  inputs; follow `{ success, data, error }`.
- Do not add raw-SQL database objects beyond the generated migration
  (partial indexes, CHECK constraints). The next `prisma migrate dev` diffs
  the schema against replayed migrations and would silently drop anything
  Prisma cannot express. The PSL unique constraint plus action guards are the
  deliberate integrity mechanism.
- `knownKey` is code-owned: never user-editable, only set through a registry
  match, never changed by rename.
- Archive never deletes and nothing in this feature deletes a source;
  `onDelete: Restrict` is the safety net, not a flow.
- No inference from `displayName` anywhere: the migration copies it verbatim
  and it stays a per-game label, never source identity.
- Keep every existing label and presentation unchanged ("Other platform"
  stays); 12e-b owns presentation.
- `known-sources.ts` must stay Prisma-free so 12e-b can import it from client
  components; server helpers live in `store.ts` (server-only).
- Branch: `feature/alternative-source-model`.

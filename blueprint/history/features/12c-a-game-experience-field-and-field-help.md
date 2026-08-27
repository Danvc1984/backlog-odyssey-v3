# Feature: Game experience field and field help

**From build-plan:** feature 12c-a (sub-feature of 12c, adaptive recommendation orchestration)
**Status:** not started

## Goal

Add the personal `gameExperience` field — the session a game best suits: PC
gaming, multiplayer & co-op, couch gaming, or on the go — to catalog games and
wishlist entries, and add concise visible field help to the personal-field
surfaces. This field is the experience dimension that 12c-c (derived profile),
12c-d (re-ranking), and 12c-f (tune-this-run) will consume; it must exist and
be user-editable before any of them can use it.

## Design reference

None — not a visual or replication feature. Follow the existing form
conventions (shadcn/ui `Label` + `Select`, muted helper text under labels).

## In scope

- `GameExperience` enum: `PC_GAMING`, `MULTIPLAYER_COOP`, `COUCH_GAMING`,
  `ON_THE_GO`.
- Nullable `gameExperience` on `LibraryEntry` and `WishlistEntry` (one
  migration).
- Game detail: `PersonalFieldsForm` gains a Game experience select (Not set +
  the four values), persisted through `updatePersonalFields`.
- Wishlist edit: `EditWishlistDialog` gains a Game experience select for base
  games and DLC, persisted through `updateWishlistEntry`; the value is shown
  read-only on `/wishlist/[id]` when set.
- Contextual field help: one-line helper text under each personal field on
  game detail (priority, interest, rating, preferred environment, game
  experience, notes) and in the wishlist edit dialog (interest, game
  experience), sourced from one shared copy module.

## Out of scope

- Using `gameExperience` in scoring, re-ranking, profiles, or tune-this-run
  (12c-c/d/f). This feature stores and displays the field only.
- Quick-create and bulk-edit surfaces. The plan's field-help wording names
  them, but neither exists in the codebase yet (quick-create has no personal
  fields; there is no bulk edit). The shared copy module lets them reuse the
  same text when they land. Flagged as a plan/code gap.
- `createWishlistEntry` / `AddWishlistDialog` — the quick-add flow stays
  fast; the field is set via Edit afterward.
- Any other new personal fields.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema: `GameExperience` enum + nullable fields** - add the
      `GameExperience` enum and nullable `gameExperience` to `LibraryEntry` and
      `WishlistEntry` in `prisma/schema.prisma`; run the migration and
      regenerate the client. *Done when:* `pnpm prisma:migrate` applies
      cleanly, `pnpm typecheck` passes, and `pnpm test` is green with the new
      field unused.
- [x] **Step 2 - Actions accept `gameExperience`** - extend
      `updatePersonalFields` (`src/actions/game-detail.ts`) and
      `updateWishlistEntry` (`src/actions/wishlist.ts`, a `.strict()` schema)
      to accept `gameExperience` as optional enum-or-null: omitted leaves the
      value untouched, `null` clears it, a valid value persists. *Done when:*
      `game-detail.test.ts` and `wishlist.test.ts` each cover valid value,
      null-clear, invalid value rejected, and omitted-untouched; `pnpm test`
      green.
- [x] **Step 3 - Shared field help + game detail form** - add
      `src/lib/personal-field-help.ts` with the shared label/help copy; add
      the Game experience select (with a "Not set" option that submits null)
      and one-line help text under every personal field in
      `PersonalFieldsForm`; pass `gameExperience` through from
      `src/app/(app)/games/[id]/page.tsx`. *Done when:* on the dev server the
      detail page shows the new select plus help text under priority,
      interest, rating, environment, experience, and notes; saving a value and
      clearing it back to Not set both persist across reload; `pnpm build`
      green.
- [x] **Step 4 - Wishlist edit + detail display** - add the Game experience
      select (base games and DLC) and interest help text to
      `EditWishlistDialog`, threading `gameExperience` through
      `WishlistEntryActions` and the page's `select`; show the set value
      read-only on `/wishlist/[id]`. *Done when:* editing a base-game wish and
      a DLC wish persists the value (visible on the detail page after reload);
      `pnpm build` green.

## Files / areas

- `prisma/schema.prisma` (+ one migration)
- `src/actions/game-detail.ts`, `src/actions/wishlist.ts` (+ their test files)
- `src/lib/personal-field-help.ts` (new)
- `src/components/games/PersonalFieldsForm.tsx`
- `src/app/(app)/games/[id]/page.tsx`
- `src/components/wishlist/EditWishlistDialog.tsx`
- `src/components/wishlist/WishlistEntryActions.tsx`
- `src/app/(app)/wishlist/[id]/page.tsx`

## Data / contracts

- `enum GameExperience { PC_GAMING MULTIPLAYER_COOP COUCH_GAMING ON_THE_GO }`
  — **load-bearing**: 12c-c profile dimension, 12c-d re-ranking factor, and
  12c-f tune dimension all key off these exact values.
- `LibraryEntry.gameExperience GameExperience?` and
  `WishlistEntry.gameExperience GameExperience?` — nullable; unset means
  "unclassified, still eligible with less signal", never disqualifying.
- `src/lib/personal-field-help.ts` — single source for field help copy,
  imported by both surfaces — **load-bearing** for any future quick-create or
  bulk-edit surface.
- `updatePersonalFields` / `updateWishlistEntry` inputs gain
  `gameExperience?: GameExperience | null` (optional = don't touch, null =
  clear).

## Testing

- Test gate is on (Vitest). Step 2 ships the logic tests: both action schemas
  with valid enum value, `null` (clears), invalid value (rejected with
  `success: false`), and omitted (leaves stored value untouched).
- Steps 1, 3, 4 are schema/UI: verified by typecheck + build + a dev-server
  walkthrough (save, reload, clear) per the done-whens.

## Notes for the AI

- Single-user app; the existing `requireUser()` in each action is the only
  auth needed — no user-scoped query changes.
- `updateWishlistEntry` uses a `.strict()` zod schema: add the new key to the
  schema or the dialog submission fails validation.
- `EditWishlistDialog` always sends `interest: Number(interest)` — don't
  change that behavior, only add the experience field.
- `PersonalFieldsForm` nullable-select pattern: `""` means null (see
  `preferredEnvironment`).
- Keep help copy to one concise line per field. The copy must make the
  interest-vs-priority distinction (durable desire vs short-term play-next
  urgency) and state that game experience is session fit, not platform or
  compatibility.
- No scoring or recommendation changes in this feature.

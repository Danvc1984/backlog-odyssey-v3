# Feature: 19a - OS preferences and first-login onboarding

**From build-plan:** feature 19a
**Status:** not started

## Goal

Replace the fixed BAZZITE / STEAM_DECK / WINDOWS display strings with a
structured, owner-chosen OS setup captured at first login: primary OS
(Linux or Windows), an optional Windows fallback, and an optional handheld
OS. Onboarding ends with an optional taste-setup offer, and editing the
setup in Settings asks for confirmation, then immediately re-derives
compatibility synthesis and synchronously regenerates recommendation runs.
This is the data and onboarding layer of feature 19; 19b gates compat flows
on it and 19c makes recommendations OS-aware.

## In scope

- Prisma migration: `Environment` enum rename `BAZZITE` → `LINUX`
  (data-preserving `ALTER TYPE RENAME VALUE`), plus structured AppSettings
  columns replacing the three legacy display strings, mapped from existing
  data (BAZZITE/STEAM_DECK/WINDOWS → LINUX primary, LINUX handheld, fallback
  true; `onboardingCompleted = true` for the existing row).
- `src/lib/os-setup.ts`: typed setup model, Zod schemas, and helpers
  (fallback derivation, `linuxTargetsExist`, trivial-path check).
  Load-bearing contract for 19b and 19c.
- Server action `updateOsSetup`: validate, update fields, re-derive compat
  synthesis (catalog + wishlist derived rows from stored ProtonDB/AWAY
  snapshots), synchronously regenerate recommendation runs reusing the
  existing Update-recommendations logic (normal run semantics: fresh run
  record replaces the previous tuned run; retained batches/exposure
  cooldowns belong to run context already).
- Confirmation dialog flow on the Settings EnvironmentCard describing the
  consequence before the action runs.
- `/welcome` onboarding page behind an onboarding-completion gate: primary
  OS, fallback offered only when primary is Linux, handheld; trivial path
  on all-Windows (no compatibility explanation step); ends with an optional
  start-now / not-now taste-setup offer.
- Seed reset to minimal singletons (`onboardingCompleted = false`, no
  pre-decided environment) so a fresh `migrate reset` lands in onboarding.
- Export/import schema: version bump to the new settings shape, accepting
  the prior version by mapping the legacy string environment.

## Out of scope

- Gating compatibility flows per setup and the four-state card tags (19b).
- OS-aware recommendation scoring, floors, and the no-fallback play-role
  hard exclusion (19c).
- Re-fetching provider evidence during re-derivation (only stored snapshots
  are re-synthesized).
- The deployment cron, Vercel config (21).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Prisma migration: Environment rename and structured AppSettings** -
  New enum value `LINUX` (rename of `BAZZITE`), AppSettings gains
  `primaryOs PrimaryOs`, `hasWindowsFallback Boolean`,
  `handheldOs HandheldOs`, `onboardingCompleted Boolean`; migration maps
  existing row (BAZZITE/STEAM_DECK/WINDOWS → LINUX/LINUX/true/completed)
  then drops `desktopOs`/`portableDevice`/`fallbackOs`. Regenerate client.
  *Done when:* `prisma migrate status` clean, `pnpm build` passes, existing
  row mapped, app compiles with type errors only where consumers reference
  removed columns.
- [x] **Step 2 - Linux wording in compat synthesis and fallback** -
  `compat-synthesis.ts` rows keyed on `LINUX`; fallback derivation logic
  and source strings reworded to Linux; status mapping unchanged.
  *Done when:* existing compat sections render Linux rows; unit tests for
  synthesis/fallback pass.
- [x] **Step 3 - Remaining BAZZITE consumers** -
  Display labels ("Bazzite" → "Linux"), `WishlistCompatibilityBlock` order,
  `PersonalFieldsForm`, `TasteSetupPanel`, and the Zod enums in
  `game-detail` and `recommendations` actions. *Done when:*
  `grep -rn BAZZITE src` finds only the export-schema legacy mapping;
  settings, game detail, wishlist detail, and taste setup work.
- [x] **Step 4 - Export/import schema version bump** -
  Settings shape → `primaryOs`/`hasWindowsFallback`/`handheldOs`/
  `onboardingCompleted`; `preferredEnvironment` enum updated; prior export
  version accepted by mapping legacy string environment; import-restore
  tests cover both versions. *Done when:* export produces the new shape;
  importing a prior-version export maps correctly; tests pass.
- [x] **Step 5 - `src/lib/os-setup.ts` typed contract** -
  Setup model, Zod schemas, `deriveWindowsFallbackExists`,
  `linuxTargetsExist` (primary LINUX or handheld LINUX), trivial-path check,
  consequence summary builder for the dialog. Unit tests. Flag load-bearing
  for 19b/19c. *Done when:* helpers tested, no route imports yet.
- [x] **Step 6 - `updateOsSetup` server action** -
  Validate with Zod, persist, re-derive compat synthesis from stored
  snapshots for catalog and wishlist (absent snapshots stay UNKNOWN; no
  provider fetch), regenerate recommendation runs synchronously by reusing
  the existing Update-recommendations entry point. *Done when:* changing
  fields recomputes derived rows for all snapshotted games and replaces the
  latest runs; empty-catalog and absent-snapshot cases handled gracefully.
- [x] **Step 7 - Settings confirmation dialog and edit form** -
  EnvironmentCard becomes an editable form; on setup change the client
  dialog describes the consequence (re-derivation + run regeneration);
  approve runs Step 6's action. *Done when:* dialog shows the summary;
  approve → fields saved, runs replaced; cancel → nothing changes.
- [x] **Step 8 - `/welcome` onboarding and gate** -
  New route capturing primary OS, fallback (only offered when primary is
  Linux), and handheld; all-Windows path skips compatibility explanation;
  ends with the taste-setup offer: start now when the library has five or
  more games (routes to the existing taste setup), otherwise suggests
  Library/import; not-now proceeds to `/today`. Gate redirects
  un-onboarded sessions from `(app)` routes to `/welcome` (sign-out and
  `/welcome` exempt). *Done when:* a session with `onboardingCompleted=false`
  lands in `/welcome`; completing it marks the setting and proceeds;
  `/today` un-onboarded redirects.
- [x] **Step 9 - Seed reset to minimal singletons** -
  `prisma/seed.ts` creates AppSettings with `onboardingCompleted=false` and
  neutral defaults (LINUX primary, no fallback, no handheld) plus the
  WallpaperState singleton; no pre-decided environment. *Done when:*
  `pnpm prisma migrate reset --force` + `pnpm db:seed` leaves only
  singletons and the app lands in `/welcome` after login.
- [x] **Step 10 - Full verification** -
  `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`; click through
  reset → login → onboarding (all three setup scenarios) → Settings edit
  with dialog. *Done when:* all checks pass and the three scenarios work
  from an empty database.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
- `src/lib/os-setup.ts` (new), `src/lib/compat-synthesis.ts`,
  `src/lib/compat-fallback.ts`, `src/lib/export-schema.ts`
- `src/actions/settings/` or `src/actions/` (new `updateOsSetup` action)
- `src/app/(app)/settings/page.tsx`, `src/components/settings/EnvironmentCard.tsx`
- `src/app/welcome/page.tsx` (new), `(app)/layout.tsx` (gate)
- Consumers: `src/components/wishlist/WishlistCompatibilityBlock.tsx`,
  `src/components/games/PersonalFieldsForm.tsx`,
  `src/components/recommendations/TasteSetupPanel.tsx`,
  `src/actions/game-detail.ts`, `src/actions/recommendations.ts`

## Data / contracts

- AppSettings: `primaryOs PrimaryOs (LINUX|WINDOWS)`,
  `hasWindowsFallback Boolean`, `handheldOs HandheldOs (NONE|LINUX|WINDOWS)`,
  `onboardingCompleted Boolean`. Load-bearing for 19b (gating) and 19c
  (recommendations) - defined here, consumed there.
- `Environment` enum: `LINUX|STEAM_DECK|WINDOWS` (BAZZITE renamed).
- `src/lib/os-setup.ts`: exported helpers + consequence-summary builder are
  the 19b/19c contract.
- Export schema: version bump; one-version-back mapping accepted.
- Interim state: until 19b, compat UI remains always-rendered even on
  all-Windows setups while rows already derive from the new fields.

## Testing

- Vitest (test gate enabled): os-setup helpers, updateOsSetup validation and
  re-derivation, export prior-version mapping, synthesis/fallback rewording.
- Click-through per step: reset → login → `/welcome` (all-Windows trivial,
  Linux-no-fallback, Linux-with-fallback + handheld scenarios) → Settings
  edit with dialog → runs replaced.

## Notes for the AI

- Server components by default; Server Actions for the settings/onboarding
  mutations; Zod-validate all action inputs.
- Single-user app: no per-user scoping; the auth guard already protects
  entries.
- The Environment rename is data-preserving: `ALTER TYPE RENAME VALUE` - do
  not drop/recreate the type.
- Compat re-derivation reads stored ProtonDB/AWAY snapshots only; never
  queue provider jobs from this action (queue re-eligibility stays 19b).
- The recommendation re-run reuses the existing Update-recommendations
  logic; do not fork a second run generator.
- The onboarding gate is a redirect in `(app)/layout.tsx` (or a shared
  guard), not middleware; sign-out and `/welcome` stay reachable.
- Interim asymmetry is intentional and documented: UI gating arrives in 19b.

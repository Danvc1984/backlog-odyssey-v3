# Feature: 19b Linux-gated compatibility flows

**From build-plan:** feature 19b
**Status:** not started

## Goal

Compatibility becomes setup-gated end to end: ProtonDB/AWAY evidence work
(auto-queue, sweeps, per-game and per-entry refresh, retries) and every
compatibility surface (card tags, game detail section, wishlist detail block,
settings sweep controls) exist only when the configured setup includes a Linux
device. All-Windows setups see no compatibility flow anywhere. On active
setups, compatibility appears only when it makes sense per game or wish, card
tags use four distinct states, and the fallback row reflects whether a Windows
fallback actually exists.

## Design reference

None. This is gating and state work over existing surfaces; tag states reuse
the current badge classes (stale borrows the amber treatment already used on
wishlist detail freshness).

## In scope

- One gate: `isCompatibilityActive(setup)` - active only when the primary OS
  or the handheld is Linux (`src/lib/os-setup.ts` already has the underlying
  `linuxTargetsExist`; this feature names and applies it).
- A server-side gate reader (`getCompatibilityGate()`) that loads AppSettings
  and returns the setup plus the active flag. Missing settings row means
  inactive (pre-onboarding is the trivial path).
- Server-side gates at every compatibility entry point: post-RAWG auto-queue,
  global catalog sweep, compat batch advance, per-game refresh, compatibility
  override, wishlist per-entry refresh, wishlist sweep, silent wishlist
  refreshes, and provider-job retry for compatibility providers.
- Display gating: game detail Compatibility section, wishlist detail
  compatibility block, settings sweep panel compatibility parts, and ProtonDB
  card tags on Library, Wishlist, and Collections.
- Four distinct card tag states: evidence, unknown/not-checked, stale (its own
  state, past the 180-day window), absent. Absent renders nothing - no hollow
  placeholders, and no tag without a confirmed App ID.
- Per-game display gating on game detail: confirmed-App-ID non-ROM base games
  get the full section; games without a confirmed App ID get only the
  "add Steam App ID" affordance; ROM-only games keep the short not-applicable
  note.
- Fallback display language: the Windows fallback row renders only when a
  fallback exists (`deriveWindowsFallbackExists`); otherwise it states no
  Windows fallback is configured. Windows primary never shows a fallback.
- The sweep no-op contract Feature 21's cron will consume (sweeps refuse
  cleanly while inactive).

## Out of scope

- 19c: OS-aware recommendation factors, floors, caveats, exclusions,
  buy/discovery penalties, preferred-environment adaptation.
- Feature 21: actual cron setup, Vercel config.
- Deleting or migrating stored compatibility rows on setup changes; data is
  preserved, only work and display are gated.
- Any visual redesign beyond the new tag states and the fallback row swap.
- EnrichmentQueueCard content (it only displays existing jobs; none are
  created while inactive).
- Today: compatibility context inside stored Play Next/Buy run items is
  engine output and belongs to 19c; Today renders what runs already store.
- Onboarding (19a, done) and Settings OS-preference editing (19a, done).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Gate helpers** - Add pure `isCompatibilityActive(setup)` to
  `src/lib/os-setup.ts` (delegating to `linuxTargetsExist`) and a server-only
  `src/lib/compat-gate.ts` with `getCompatibilityGate()` reading
  `prisma.appSettings.findUnique({ where: { id: 1 } })` and returning
  `{ setup: OsSetup | null; active: boolean }` (missing row: setup null,
  active false). *Done when:* unit tests cover the pure helper across the
  four meaningful setups (Linux primary, Windows primary + Linux handheld,
  Windows primary + Windows handheld, Linux primary with and without
  fallback) and `pnpm test` and `pnpm typecheck` pass.

- [x] **Step 2 - Catalog compatibility gates** - Gate new catalog work only:
  `queueCompatibilityForGame` returns null without queueing when inactive;
  `refreshGameCompatibility` and `setCompatOverride` refuse with a clear
  error; `startCompatibilitySweep` refuses without creating a batch. An
  already-running batch finishes its queued games (gating the advance route
  would strand it at RUNNING under overlap protection). *Done when:*
  extended Vitest cases prove each entry point no-ops or refuses while
  inactive and behaves unchanged while active; tests and typecheck pass.

- [x] **Step 3 - Wishlist compatibility gates** - Gate the wishlist pipeline:
  `runWishlistCompatibilityRefresh` refuses when inactive;
  `runWishlistCompatSweep` returns its refused reason without creating a run
  record; `silentlyRefreshWishlistCompatibility` no-ops (inherits the runner
  gate); `retryEnrichmentJob` refuses retries for compatibility providers
  (PROTONDB, AWAY) while inactive. *Done when:* extended Vitest cases prove
  the refusals and the unchanged active-path behavior; tests and typecheck
  pass.

- [x] **Step 4 - Card tag view model** - Add a pure `deriveCompatTag` next to
  `deriveCardTier` in `src/lib/protondb-tags.ts` returning
  `{ kind: "evidence" | "stale"; tier } | { kind: "unknown" } | null`:
  inactive setup, ROM-only, or missing App ID produce null (absent);
  a confirmed App ID with no usable tier produces unknown; a parsed tier past
  the 180-day window produces stale; otherwise evidence. Update `ProtonDbTag`
  to render the three visible states (stale keeps the tier with the stale
  treatment; unknown renders a muted "Not checked" badge). *Done when:*
  derivation tests cover the 180-day boundary, unknown, and all absent cases;
  tests and typecheck pass.

- [x] **Step 5 - Card surfaces consume the tag** - Library, Wishlist, and
  Collections pages replace the `protonDbTier` prop with the gated
  `compatTag` view (selecting the latest PROTONDB snapshot's result and
  `fetchedAt`; wishlist cards keep their eligibility preconditions). Cards
  render nothing when the tag is absent. *Done when:* on an active Linux
  setup cards show evidence, unknown, or stale tags and no tag for App-ID-less
  or ROM-only games; on an all-Windows setup no card shows any tag anywhere;
  `pnpm build` passes.

- [x] **Step 6 - Game detail gating** - The game detail page reads the gate:
  inactive renders no Compatibility section at all; active renders the
  section for base games, with the confirmed-App-ID check showing only the
  "add Steam App ID" affordance for App-ID-less non-ROM games (no empty
  evidence rows or badges), ROM-only keeping the not-applicable note, and the
  Windows row driven by `hasWindowsFallback` (fallback exists: current
  derived row; none: explicit "no Windows fallback configured" language).
  *Done when:* a walkthrough shows the full section on an active setup,
  only the affordance for an App-ID-less game, nothing on an all-Windows
  setup, and the correct fallback row in both fallback states; `pnpm build`
  passes.

- [x] **Step 7 - Wishlist detail gating** - The wishlist detail page reads the
  gate: inactive renders no compatibility block; ineligible wishes (DLC,
  unconfirmed identity) render nothing instead of the explanatory card; the
  eligible block filters its stored WINDOWS environment row unless a fallback
  exists, using the same no-fallback language. *Done when:* a walkthrough
  shows the block only for eligible wishes on an active setup, nothing for
  DLC or identity-less wishes, and nothing on an all-Windows setup;
  `pnpm build` passes.

- [x] **Step 8 - Settings sweep panel gating** - `CompatibilitySweepPanel`
  receives the gate: while inactive it hides the "Sweep compatibility"
  button, the compat batch status area, and `WishlistCompatSweepPanel`,
  keeping the RAWG controls; while active it is unchanged. *Done when:* a
  walkthrough shows no compatibility controls in Settings on an all-Windows
  setup and the unchanged panel on an active setup; `pnpm build` passes.

## Files / areas

- `src/lib/os-setup.ts` - pure gate helper (+ tests).
- `src/lib/compat-gate.ts` - new server-only gate reader (+ tests).
- `src/lib/compat-queue.ts`, `src/actions/compatibility.ts`,
  `src/actions/compat-batch-enrichment.ts` - catalog gates.
- `src/lib/wishlist-compatibility-runner.ts`, `src/lib/wishlist-compat-sweep.ts`,
  `src/actions/wishlist-compatibility.ts`, `src/actions/enrichment-retry.ts` -
  wishlist and retry gates.
- `src/lib/protondb-tags.ts`, `src/components/games/ProtonDbTag.tsx` - tag
  view model and rendering.
- `src/app/(app)/library/page.tsx`, `src/app/(app)/wishlist/page.tsx`,
  `src/app/(app)/collections/[id]/page.tsx`, `src/components/games/LibraryGameCard.tsx`,
  `src/components/wishlist/WishlistCard.tsx` - card surfaces.
- `src/app/(app)/games/[id]/page.tsx`, `src/components/games/CompatibilitySection.tsx` -
  game detail gating and fallback row.
- `src/app/(app)/wishlist/[id]/page.tsx`, `src/components/wishlist/WishlistCompatibilityBlock.tsx` -
  wishlist detail gating.
- `src/app/(app)/settings/page.tsx`, `src/components/games/CompatibilitySweepPanel.tsx` -
  settings gating.

## Data / contracts

- No schema changes and no migration.
- **Load-bearing for 19c:** `isCompatibilityActive(setup)` (pure) and
  `getCompatibilityGate()` returning `{ setup: OsSetup | null; active: boolean }`.
  The 19c engines will read the same gate to decide environment factors; the
  shape is locked here.
- `CompatTag` = `{ kind: "evidence" | "stale"; tier: ProtonDbCardTier } |
  { kind: "unknown" } | null`. Produced only by `deriveCompatTag`; consumed by
  Library, Wishlist, and Collections cards. Replaces the `protonDbTier` card
  prop end to end.
- Inactive refusals keep the existing `{ success, data, error }` action shape;
  sweep refusals reuse the existing no-run/overlap result paths with a
  compatibility-inactive reason rather than new result kinds.

## Testing

Vitest is the declared runner: Steps 1-4 are logic-bearing and ship tests in
the same diff (gate helper, catalog refusals, wishlist refusals, tag
derivation including the 180-day boundary). Steps 5-8 are UI wiring and ride
on `pnpm build` plus a manual walkthrough: with a Linux primary set, confirm
evidence/unknown/stale tags, the full detail section, and the Settings panel;
switch the setup to all-Windows in Settings (confirmation dialog from 19a),
confirm compatibility disappears from Library, Wishlist, Collections, both
detail pages, and Settings, and that refresh buttons are gone rather than
dead; switch back and confirm evidence reappears unchanged.

## Notes for the AI

- `CompatibilitySection` is a client component: pass gate-derived booleans
  (`hasWindowsFallback`) as props from the server page; never import the
  server gate into client code. `deriveWindowsFallback` and
  `isCompatibilityActive` are pure and safe to share.
- Single-user app: no per-user query scoping; `requireUser` already guards the
  actions. Keep it.
- Do not delete compatibility rows on setup changes; gating is display and
  work only. A batch in flight when the setup switches to all-Windows may
  finish its queued games; new entry points refuse. That is accepted behavior,
  not a bug.
- The Windows primary + fallback combination is invalid per the 19a schema;
  the fallback row's existence is exactly `deriveWindowsFallbackExists`.
- Factual copy only for evidence labels and the no-fallback line (no Odyssey
  voice here; that is 20e). No em dashes in user-visible copy per coding
  standards.
- Feature 21's cron will call the sweep entry points; their inactive refusal
  is the no-op contract - keep error strings stable and specific.


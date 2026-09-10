# Feature: 21e Settings and onboarding

**From build-plan:** feature 21e (Settings and onboarding sub-item of 21,
pre-deployment polish)
**Status:** complete

## Goal

Finish the pre-deployment polish for Settings and onboarding: group the
Settings page by concern instead of one flat card list, fix the hydration
mismatch that a hard reload triggers when visual preferences are stored, offer
the app theme (palette family and mode) during first-login onboarding, and
store Steam-provided game names without trademark and copyright symbols from
import time onward, while keeping large Steam wishlist imports within the
provider's request limits.

## Design reference

None. Layout reordering (Settings groups), one hydration fix, a new onboarding
control block, and name normalization; all judged in the running app against
the existing Dawn/Sunset tokens.

## In scope

- Rearranging `src/app/(app)/settings/page.tsx` into concern groups with
  group headings; cards keep their internals unchanged.
- Fixing the hard-reload hydration mismatch: `VisualPreferencesProvider` must
  render SSR-stable defaults on first paint and adopt stored preferences
  after mount, so consumers (covers, screenshots, theme scope, wallpaper)
  stop mismatching on hard reload with stored preferences.
- An app theme block (family Dawn/Sunset plus mode System/Light/Dark) in the
  welcome onboarding, applying immediately and persisting through the
  existing non-migrating preference mechanism.
- A pure helper that strips trademark/copyright symbols from names, applied
  when Steam games are imported from the Settings Steam connection card.
- Rate-limit-safe Steam wishlist metadata retrieval for large wishlists,
  including named DLC results when optional parent resolution is unavailable.
- Unit tests for the strip helper (Vitest gate).

## Out of scope

- Redesigning any Settings card's internals, controls, or copy beyond the
  group headings and ordering.
- Changing the visual-preference storage mechanism (localStorage keys and
  pre-paint script stay as the non-migrating contract).
- A backfill or rename of already-stored game/wishlist names; the helper
  applies at import time only.
- Wishlist Steam import names (feature 10c flow) - excluded, see
  interpretation decisions.
- OS setup semantics, taste setup, export/import schema, and cron work.

## Interpretation decisions (owner review)

- **Settings groups** (proposed order; adjust freely): "Account" (session,
  OS environment), "Steam and catalog sources" (Steam connection, wishlist
  import status, unresolved DLC review, alternative sources), "Provider
  queues" (price status, enrichment queue, compatibility sweep),
  "Appearance" (theme, wallpaper), "Recommendations" (learned profile and
  reset), "Personal data" (export, empty-schema import). Group headings are
  simple `h2`s. Owner revision (2026-09-09): Account combines SessionCard +
  EnvironmentCard, Personal data combines DataExportCard + DataImportCard,
  and the EnrichmentQueueCard is cut with its failed-jobs list folded into
  CompatibilitySweepPanel (the card and the panel read the same
  `EnrichmentJob` rows and showed largely duplicate counts; the fold keeps
  retry, wishlist-game visibility, and AWAY coverage inside the panel).
- **Hydration fix** targets the real defect: `VisualPreferencesProvider`
  reads localStorage synchronously in its `useState` initializer, so the
  first client render differs from the server render whenever stored
  preferences are non-default. The fix initializes with the SSR defaults and
  adopts stored preferences in the mount effect; the pre-paint script keeps
  the painted attributes correct before that.
- **Welcome theme placement**: the theme block sits in the setup form above
  the save button (family and mode segmented controls, applied on change).
  It persists via the existing mechanisms (next-themes mode, localStorage
  family) and needs no schema or save wiring.
- **Symbol scope**: strip `TM` (U+2122), registered (U+00AE), and copyright
  (U+00A9) symbols anywhere in the name, collapsing leftover trailing
  whitespace; a name that would become empty keeps its original.
- **Sync queue parity (in scope unless cut)**: owned sync also writes raw
  Steam names into the unresolved-DLC queue (src/actions/steam-sync.ts:89),
  which would reintroduce symbols after the first sync, so the same helper
  applies at that call site. Owner revision (2026-09-09): the wishlist Steam
  import path (src/actions/steam-import-wishlist.ts) now strips too, so
  wishlist entries, review candidates, and its unresolved-DLC queue rows all
  store clean names at import time.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Group Settings by concern** - restructure
  `src/app/(app)/settings/page.tsx` rendering: keep every card's props and
  behavior identical, wrap them under six `h2`-headed groups in the order
  Account, Steam and catalog sources, Provider queues, Appearance,
  Recommendations, Personal data. Within a group, combine the two small
  related pairs into a single card each: Account merges SessionCard and
  EnvironmentCard, Personal data merges DataExportCard and DataImportCard.
  Fold the EnrichmentQueueCard away: move its failed-jobs list (any provider,
  retryable or not, up to 10) into CompatibilitySweepPanel as a
  `failedJobs` prop and delete the card. Do not rename component ids (Today
  deep-links `/settings#steam-connection-card` and the OAuth callback lands
  on `/settings?steam=connected|error`). *Done when:* the page shows the six
  groups in order with headings, the merged Account and Personal data cards
  keep both source cards' internals and copy working, failed enrichment jobs
  render with per-job retry inside the sweep panel, the Today "Steam
  activity" link still lands on the Steam connection card, and a
  `?steam=connected` reload still shows its toast.
- [x] **Step 2 - Hydration-safe visual preferences** - in
  `VisualPreferencesProvider.tsx` initialize state with the SSR defaults
  (`system`/`system`/`dawn`) instead of `readStoredPreferences()`, and change
  the mount effect to `commit(readStoredPreferences())` so stored values are
  adopted after hydration (keeping the pre-paint attributes intact until
  then). Nothing else changes: the storage-event listener, setters, and
  `AppearanceSection`'s hydration gate keep working. *Done when:* a hard
  reload with stored preferences (e.g. Sunset family, reduced data, reduced
  motion) shows no hydration mismatch in the browser console on
  `/wishlist/[id]` and `/settings`, covers/screenshots reflect reduced data
  right after load, the family and favicon match the stored choice, and
  soft navigation is unchanged.
- [x] **Step 3 - App theme choice in welcome onboarding** - extract the
  segmented control from `AppearanceSection.tsx` into
  `src/components/preferences/SegmentedControl.tsx` (same markup; both files
  import it) and add an "App theme" block to `WelcomeSetupForm` above the
  save button: family (Dawn/Sunset) via `setFamily` from
  `useVisualPreferences`, and mode (System/Light/Dark) via `useTheme()`
  gated behind a mounted flag so SSR and first client render agree. Changes
  apply immediately and persist through the existing mechanisms; the OS
  setup save flow is untouched. *Done when:* on `/welcome` picking Sunset
  repaints the page immediately, picking Light/Dark/System applies
  immediately, both survive a reload, no hydration warnings appear with
  stored or default preferences, and saving the setup still completes with
  the taste-setup offer.
- [x] **Step 4 - Trademark strip helper** - add `stripTrademarkSymbols(name)`
  to `src/lib/steam-utils.ts`: removes U+2122, U+00AE, and U+00A9 anywhere
  in the string, trims trailing whitespace left behind, and returns the
  original unchanged when the result would be empty. Unit tests cover
  single and multiple symbols, symbols at start/end/middle, whitespace
  collapse, symbol-only names, and untouched plain names. *Done when:*
  `pnpm test` passes with the new tests and nothing else changed.
- [x] **Step 5 - Strip at Steam import** - in `steam-import.ts` map the
  fetched games through `stripTrademarkSymbols` once, right after
  `fetchOwnedGames`, so game names (DLC and base game creation paths) and
  the unresolved-DLC queue upserts from the import all store clean names;
  identity lookups and availability stay untouched. The wishlist path
  (`steam-import-wishlist.ts`) strips once after `fetchSteamWishlist` the
  same way, so wishlist entries, review candidates, and its unresolved-DLC
  queue rows store clean names too. *Done when:* importing (or re-importing
  a new title with) a Steam name like "Game Title(TM)" stores "Game Title"
  on the game and queue rows (owned and wishlist), existing catalog and
  wishlist names are not rewritten, and the import summary counts behave as
  before.
- [x] **Step 6 - Rate-limit-safe large wishlist import** - replace the
  per-App-ID Store `appdetails` phase used by `fetchSteamWishlist` with the
  authenticated `IStoreService/GetAppList` pages for non-DLC and DLC names,
  including software in the non-DLC page, then use Store `appdetails` only for
  the smaller DLC/parent-resolution set.
  Include a store-listed wishlist item even when its optional DLC detail call
  fails, preserving the name and DLC classification from the app-list filter;
  keep truly unavailable or delisted items out rather than inventing names.
  *Done when:* a wishlist over 200 items does not issue one `appdetails`
  request per item, a live 268-item wishlist returns all store-resolvable
  items without the observed 170-item cutoff, and a failed DLC detail request
  still produces a named DLC result; focused tests prove pagination,
  request-shape, and partial-detail behavior.
- [x] **Step 7 - Sync queue parity (flagged, cut if unwanted)** - in
  `steam-sync.ts` apply the same helper at the
  `upsertUnresolvedSteamDlc` call so queue rows created or reset by the
  owned sync also store clean names. *Done when:* a sync that adds a new
  unresolved DLC with a symbol in its Steam name stores the clean name in
  the queue, and game names are untouched (sync never renames).

## Files / areas

- `src/app/(app)/settings/page.tsx` (grouping and ordering only)
- `src/components/settings/AccountCard.tsx`, `PersonalDataCard.tsx` (new,
  merged from SessionCard+EnvironmentCard and DataExportCard+DataImportCard,
  which are deleted)
- `src/components/games/CompatibilitySweepPanel.tsx` (failed-jobs fold-in)
- `src/components/settings/EnrichmentQueueCard.tsx` (deleted; its
  failed-jobs list moves into the sweep panel)
- `src/components/preferences/VisualPreferencesProvider.tsx` (hydration-safe
  init)
- `src/components/preferences/SegmentedControl.tsx` (new, extracted)
- `src/components/settings/AppearanceSection.tsx` (imports the shared
  control)
- `src/components/onboarding/WelcomeSetupForm.tsx` (theme block)
- `src/lib/steam-utils.ts` + `src/lib/steam-utils.test.ts` (strip helper)
- `src/lib/steam-api.ts` + `src/lib/steam-api.test.ts` (rate-limit-safe
  wishlist metadata retrieval)
- `src/actions/steam-import.ts`, `src/actions/steam-import-wishlist.ts`,
  `src/actions/steam-sync.ts` (apply helper)

## Data / contracts

- Visual preference storage keys (`backlog-odyssey:motion|data|family`) and
  the pre-paint script are unchanged - they are the load-bearing
  non-migrating mechanism from feature 14; this feature only changes when
  the provider adopts stored values (after mount instead of during first
  render).
- No schema, migration, server-action signature, or API changes. The strip
  helper is pure text normalization on the import path only; stored names
  keep their existing shape and no history/backfill runs.

## Testing

- Unit (Vitest, required by the test gate): `stripTrademarkSymbols` in
  `steam-utils.test.ts` (single/multiple symbols, positions, whitespace,
  symbol-only guard, plain-name passthrough). If the existing
  `steam-import.test.ts` harness makes a name assertion cheap, add one case
  there; otherwise helper tests plus browser evidence satisfy the gate.
- Browser evidence (no E2E runner): per-step done-whens driven by hand with
  `pnpm dev` - Settings groups and deep links, hard-reload hydration check
  in the console on two routes, welcome theme controls, and a clean-name
  import if the Steam connection is live (otherwise verify via the helper
  tests and a review of the call sites).
- Steam wishlist API tests cover app-list pagination and partial DLC detail
  failures; a live diagnostic may confirm request counts without running the
  mutating import action.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` stay green
  before each approval.

## Notes for the AI

- Server component page; client components touched are the preferences
  provider, the extracted segmented control, and `WelcomeSetupForm`. The
  theme block is client-side only - no server action stores theme choices.
- Keep the Settings regrouping mechanical: no prop changes, no card edits,
  no new state. If a heading style is needed, match the page's existing
  `technical-label`/heading vocabulary.
- The provider fix must not lose the pre-paint behavior: attributes set
  before hydration stay until the mount effect re-commits stored values.
- Steam name stripping applies only to `name` fields written from
  `fetchOwnedGames` results during import (and the flagged sync queue call
  site); never rewrite existing rows or other fields.
- No em dashes anywhere; no comments unless they capture a non-obvious
  decision; functions under 50 lines.
- Keep each diff reviewable: grouping, provider, welcome form, helper,
  import call site, and sync call site are separate steps on purpose.

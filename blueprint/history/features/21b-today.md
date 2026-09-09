# Feature: 21b Today

**From build-plan:** feature 21b
**Status:** complete

## Goal

Fix and rebuild the Today section: the hero focus becomes a real focus
carousel over the main game and in-progress games, the wallpaper control
stops disappearing when the main game changes, the metrics sections become
honest and useful, and recommendation explanations read as natural language
instead of concatenated technical fragments.

## In scope

- **Focus carousel.** `TodayHeroGrid`'s `Spotlight` shows one static game.
  Rebuild it as a focus carousel (`Carousel` component) that switches focus
  between the main game (first slide) and the other in-progress games. The
  main-game slide offers only a "View details" button. Each in-progress
  slide adds a "Make main" button (client island calling
  `updatePlayState(id, { isMainGame: true })` from
  `src/actions/game-detail`, the same action the library health strip uses);
  state-change controls appear only on in-progress slides, per the standing
  spotlight rule. Keep the existing `SpotlightEmpty` when nothing qualifies.
- **Wallpaper bar persistence.** `WallpaperBackground` renders nothing when
  `selection` is null - which happens after the main game changes and the
  rebuilt pool is empty or fails, killing the bottom bar. Render the bar
  whenever wallpapers are enabled, desktop, reduced-data is off, and at
  least one wallpaper source game exists (main or in-progress; pass
  `hasSources` from `searchPlan.terms.length` in the app layout). With a
  selection it shows attribution + shuffle + View on Wallhaven as today;
  without one it shows a "Refresh wallpapers" button calling the existing
  `refreshWallpaper` server action (the Settings one, `force=true`).
- **Recent Steam activity.** Diagnose why it appears broken, then: add a
  manual refresh (new server action `refreshSteamActivityNow` that bypasses
  the 24h `isActivityRefreshDue` gate; a small client refresh button on the
  section header). Give entries without a RAWG catalog match a Steam CDN
  header image background
  (`https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg`)
  - `ArtworkBackdrop` is `unoptimized`, so no next.config change is needed.
- **Data health.** Drop the Abandoned tile (`TodayDataHealth` becomes two
  tiles) and replace the "Counts are actionable, not decoration." section
  description with a plain factual caption.
- **Provider freshness.** Steam always shows "never" because only
  `steamConnection.lastSyncAt` is read; use the recent-activity cache's
  `refreshedAt` (when `lastError` is null) as the Steam freshness signal,
  falling back to `lastSyncAt`. Show the Compatibility row only when the OS
  setup has Linux targets (`linuxTargetsExist`), hidden entirely on
  all-Windows setups.
- **No-fallback message gating.** Bug: with Windows primary + Linux
  handheld, `classifyPlayPracticality` still excludes games ("need Windows,
  no fallback") because both EXCLUDED branches check only
  `!fallbackExists`. Gate both EXCLUDED branches on
  `setup.primaryOs === "LINUX"`; on a Windows primary, anticheat-blocked and
  REQUIRED evidence become SOFT caveats (the game runs on the Windows
  device; the Linux handheld cannot). The Today message then lists the
  distinct stored exclusion reasons instead of one hardcoded sentence.
- **Recommendation numbering.** `RecommendationItemCard`'s rankLabel drops
  the ` / #02` part: show the role label only ("Best fit"), and omit the
  line when there is no role.
- **Tune accordion.** Both `TuneThisRunPanel` accordions retitle to
  "Tune recommendations (opt in)", gain a visible expand/collapse chevron
  icon, and get a header surface that stands out from the card background
  (panel body stays as is).
- **Natural-language factors.** Play and buy engines keep generating the
  same factor keys and points, but emit natural, informative labels
  (e.g. "Action affinity" -> "Matches your taste for action games";
  "Metacritic 88" -> "Critics rate it highly (Metacritic 88)"; "Runs well
  on Linux" -> "Runs well on your Linux devices"). Genre/tag and length
  affinity factors aggregate (one factor per key, points summed, fragments
  merged: "Matches your taste for action, roguelike, and singleplayer").
- **Reason ordering + factor presentation.** Factor chips order: positive
  factors strong-to-weak, then negative factors weak-to-strong (points
  descending numerically), then caveats. Factors with the same key are
  aggregated for presentation, with natural connectors and no redundant
  repeated openers. Generated card descriptions were removed at the owner's
  request; chips remain the explanation surface.

## Out of scope

- 21c-21e (Library, Wishlist, Settings/onboarding).
- Recommendation scoring, eligibility, roles, rotation, and calibration
  semantics - unchanged. Only explanation labels/ordering/copy and the
  no-fallback gating change.
- Schema migrations: run items keep storing factor/caveat arrays as JSON;
  older runs keep their stored labels (UI reads the latest run).
- Featured offers carousel, coverage dialogs, operations block layout.
- Steam import/sync behavior: activity stays a separate 24h cache that
  never imports; the manual refresh only refreshes that cache.
- The spotlight's "Start playing" flow (`startPlayingFromRecommendation`)
  is untouched.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Focus carousel** - convert `Spotlight` into carousel
      slides (main game first, then other in-progress games), main slide
      "View details" only, in-progress slides add a client "Make main"
      button reusing `updatePlayState`. *Done when:* the Today hero cycles
      between main and in-progress games with manual controls and slow
      auto-advance (manual under reduced motion); the main slide shows only
      View details; an in-progress slide's Make main swaps the main game
      and the carousel order updates on next load; with no main game the
      slides are the in-progress games.
- [x] **Step 2 - Wallpaper bar persistence** - extend
      `WallpaperBackground` + layout `hasSources` prop; render the bar with
      a Refresh wallpapers action when no selection exists. *Done when:*
      after switching the main game to a title with zero Wallhaven results,
      the bottom bar stays visible and Refresh wallpapers restores a
      background; with a loaded pool the bar behaves exactly as today;
      reduced-data still hides everything.
- [x] **Step 3 - Recent activity refresh and art** - add
      `refreshSteamActivityNow` + header refresh button; Steam CDN header
      background for entries without a RAWG match; first reproduce the
      reported breakage and record the cause in the step summary.
      *Done when:* clicking refresh updates the list even minutes after an
      automatic refresh; a RAWG-less entry shows its Steam header art as
      the card background; STALE_ERROR still shows cached rows plus the
      warning line.
- [x] **Step 4 - Data health and provider freshness** - two-tile data
      health with a new factual caption; Steam freshness from the activity
      cache; Compatibility row gated on Linux targets. *Done when:*
      Abandoned tile is gone and the caption changed; Steam shows a real
      timestamp after an activity refresh; on an all-Windows setup the
      Compatibility row does not render.
- [x] **Step 5 - No-fallback exclusion gating** - gate both EXCLUDED
      branches on Linux primary, SOFT caveats otherwise, Today message from
      stored reasons, unit tests for both setups. *Done when:* on Windows
      primary + Linux handheld nothing is hidden and no "not shown" message
      renders; on Linux primary without fallback the exclusion still hides
      games with the explained message; `pnpm test` covers both.
- [x] **Step 6 - Numbering and tune header** - drop ` / #02`, omit the
      rank line when roleless; retitle both tune accordions to
      "Tune recommendations (opt in)" with chevron and a more visible
      header. *Done when:* role cards read "Best fit" with no numbering;
      both accordions show the new title, an expand icon, and a header that
      no longer blends into the background.
- [x] **Step 7 - Play factor labels** - naturalize play-engine factor
      labels (baseline + rerank) with tests. *Done when:* new play runs
      store natural labels ("Matches your taste for action games", not
      "Action affinity"); `pnpm test` passes.
- [x] **Step 8 - Buy factor labels** - the same for the buy engine with
      tests. *Done when:* new buy runs read naturally ("It is 67% off right
      now", not "offer_discount +67"); `pnpm test` passes.
- [x] **Step 9 - Aggregation and ordering** - shared helper merging factors
      by key (sum points, merge fragments) and ordering chips
      (positive strong-to-weak, negative weak-to-strong, caveats last),
      applied in the card/chip presentation, with tests. *Done when:* a
      card with several genre/tag hits shows one aggregated factor; chips
      follow the order; `pnpm test` covers the helper's boundaries.
- [x] **Step 10 - Generated card copy** - removed the generated description
      from recommendation cards at the owner's request; explanation chips
      remain visible and are covered by Step 9 ordering and aggregation.

## Files / areas

- `src/components/today/TodayHeroGrid.tsx` (+ new client make-main island),
  `src/components/ui/Carousel.tsx` (reuse as is).
- `src/components/wallpaper/WallpaperBackground.tsx`,
  `src/app/(app)/layout.tsx`, reuses `refreshWallpaper` from
  `src/actions/wallpaper.ts`.
- `src/lib/steam-activity.ts`, `src/actions/` (new
  `refreshSteamActivityNow`), `src/components/today/RecentSteamActivity.tsx`
  (+ small client refresh button).
- `src/components/today/TodaySummary.tsx`,
  `src/app/(app)/today/page.tsx` (caption), `src/lib/today-operations.ts`.
- `src/lib/recommendations/environment-fit.ts` (+ tests),
  `src/app/(app)/today/page.tsx` (message).
- `src/components/recommendations/RecommendationItemCard.tsx`,
  `src/components/recommendations/FactorChips.tsx`,
  `src/components/recommendations/TuneThisRunPanel.tsx`.
- `src/lib/recommendations/` engines (play baseline/rerank, buy),
  `src/lib/recommendations/factor-presentation.ts` (+ tests).

## Data / contracts

- No schema changes. `ExplanationFactor` / `ExplanationCaveat` shapes are
  load-bearing and unchanged (keys and points keep their meaning; only
  labels, ordering, aggregation, and copy change) - game/wishlist detail
  calibration explanations and wishlist detail buy cards render the same
  structures and must keep working.
- RAWG `playtimeHours` is no longer used as a recommendation dimension or
  tune criterion. A dedicated duration provider and handheld-candidate play
  state toggle belong to a later feature.
- New server action `refreshSteamActivityNow` (no args, returns the same
  view shape as `refreshSteamActivityCacheIfStale`).
- `WallpaperBackground` gains an optional `hasSources: boolean` prop from
  the layout's search plan.

## Testing

- Vitest: Step 5 (both setups through `classifyPlayPracticality` + message
  source), Steps 7-8 (factor label maps), Step 9 (aggregation/ordering
  boundaries: empty, single, ties, negative ordering). Generated-copy tests
  were superseded when card descriptions were removed.
- Steps 1-4 and 6 are visual/interaction: manual verification per done-when
  in the running app plus `pnpm build`; the wallpaper step needs a real
  main-game switch against Wallhaven.

## Acceptance evidence

- `pnpm test` passed: 1222 tests across 124 files.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check` passed.
- Manual `/today` check observed the focus surface, wallpaper controls,
  recommendation chips, provider freshness, data health, and no Continue game
  control. `Show another` changed both recommendation title and artwork
  (Halo: The Master Chief Collection to Dome Keeper, with different RAWG image
  URLs). A RAWG-less Steam activity entry used the Steam CDN header.
- Manual Steam refresh reached the stale-error path during the check; cached
  rows remained visible with the warning. The owner confirmed the refresh
  behavior succeeded in the local app.
- The local manual rotation changed the current recommendation run as part of
  the interaction check.

## Notes for the AI

- Client vs server: `today/page.tsx`, the layout, `steam-activity.ts`, and
  `today-operations.ts` are server-side; the make-main, wallpaper, and
  activity-refresh controls are client islands calling server actions.
  `TodayHeroGrid` can stay server-rendered while hosting client children.
- Match existing conventions: no comments, `cn()` for conditional classes,
  Phosphor icons, factual copy for statuses/caveats (Odyssey voice only on
  expressive surfaces like openers and section headings).
- The standing spotlight rule: state-change controls only on in-progress
  games; the main-game slide never offers make-main or state changes.
- Reuse `refreshWallpaper` (force path) and `updatePlayState`; do not
  duplicate either behavior.
- The play-engine labels live near `SOFT_REASONS` / compat-context maps -
  keep the factor-key to label mapping in one shared place per engine so
  tests stay simple.

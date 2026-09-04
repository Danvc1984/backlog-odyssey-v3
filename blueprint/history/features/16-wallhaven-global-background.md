# Feature: Wallhaven global background

**From build-plan:** feature 16
**Status:** draft

## Goal

Add an optional desktop wallpaper layer behind the app, sourced from
Wallhaven's free SFW search API using the user's own catalog as the query set:
the main game title first, then in-progress game titles as extra alternatives.
A cached pool of roughly 10 candidates feeds a
deterministic daily rotation with a manual shuffle. The layer renders on
desktop widths only, hard-offs under reduced data, refreshes its pool through a
staleness-triggered queued job, falls back to the existing token background on
any failure, and attributes each wallpaper to Wallhaven.

## Design reference

- No prototype or reference image exists for this feature; it is behavioral
  rather than look-alike. Visual treatment follows the existing shared token
  system (`src/app/globals.css` from 14a) and the artwork/scrim conventions
  from `src/lib/detail-art.ts` and `src/components/ui/detail-hero-art.tsx`.
- Provider conventions follow the existing server-only clients
  (`src/lib/away-api.ts` error categories, `src/lib/steam-activity.ts`
  staleness + attempt-throttle cache pattern).

## In scope

- **Wallhaven search client** (server-only): one request per searched term
  against `https://wallhaven.cc/api/v1/search` with a normalized lowercase
  `q=<game title>` (trademark symbols removed),
  `categories=111` (all categories), `purity=100` (SFW), `sorting=random`,
  `atleast=1920x1080`. Validates and filters the response (jpg/png, sfw) into
  candidates. NETWORK / HTTP / MALFORMED_RESPONSE error categories mirroring
  `away-api.ts`. No API key (NSFW is unreachable for guests anyway; 45 req/min
  limit and at most 4 searches per refresh, throttled to one refresh attempt
  per hour).
- **Game-driven search plan:** each refresh searches the main game's title
  first, then all planned in-progress game titles (deterministic order, main
  game excluded, at most 3 of them), up to the per-refresh search cap. Results
  are deduplicated and interleaved in plan order until the pool reaches 10
  candidates, so every successful game query can contribute a wallpaper. A
  term returning zero results is not an error; the next term runs. With no
  main game and no in-progress games there is nothing to search, so the pool
  stays empty and the token background shows.
- **Pool storage:** the existing `WallpaperState` singleton stores candidate
  metadata (URLs and selection only, never image binaries), plus two new
  columns for refresh diagnostics (see Data / contracts). The pool carries a
  query-version marker so query-normalization changes invalidate old results.
- **Deterministic daily rotation:** a pure resolver picks today's image from
  the stored pool by hashing the local day string (America/Mexico_City), never
  repeating yesterday's index. Same day always resolves to the same image with
  no writes.
- **Manual shuffle:** a server action picks a different random index and
  persists it for the current day only; the next day the deterministic pick
  takes over again. The shuffle control lives in a small corner cluster on the
  background layer, desktop only.
- **Desktop-oriented display:** the image layer renders only at `md` and wider
  via a `matchMedia` gate evaluated before any image URL is assigned, so
  mobile never downloads wallpaper bytes.
- **Reduced-data hard-off:** when the resolved data preference is `on` (the
  existing `useVisualPreferences()` mechanism), the layer renders nothing and
  assigns no image URL. The server-side pool refresh still runs (metadata
  request only).
- **Staleness-triggered queued refresh:** when the app shell loads and the
  pool is due - older than 7 days, or the stored source set (main game plus
  searched in-progress titles) no longer matches the current one - a refresh
  is queued via Next.js `after()` so it never blocks rendering. In-process
  overlap guard plus the one-hour attempt throttle prevent duplicate work;
  failures keep the last usable pool and record a diagnostic. Main-game and
  in-progress changes refresh the app shell so the wallpaper set is refreshed
  immediately after the catalog mutation.
- **Fallback:** missing row, empty or malformed pool, provider failure, or
  reduced-data/mobile all fall back to the existing token background with no
  error UI and no console noise.
- **Attribution:** a discreet bottom-corner technical-label cluster shows the
  uploader (when present) and links to the wallpaper's Wallhaven page plus a
  "Wallhaven" mention.
- **Minimal enable/disable control:** one `Background` switch in Settings
  backed by the existing `AppSettings.wallpaperEnabled` column, so the feature
  is controllable before 18 expands the Wallhaven controls.

## Out of scope

- Settings Wallhaven controls beyond the enable/disable switch (manual
  refresh button, diagnostics display, query-source overrides): feature 18.
- Any scheduled/Cron refresh: feature 19 owns deployment scheduling; 16 ships
  the on-load staleness trigger only.
- Per-game dynamic themes (feature 17) and any integration with detail pages.
- Image proxying, caching of image binaries, or next/image remote patterns:
  the client uses a plain `<img>` consistent with existing RAWG artwork.
- API-key support: guest access only, so NSFW is unreachable and `purity=100`
  keeps results SFW.
- Recommendations, queues, or other provider behavior changes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema fields and pure wallpaper logic** - Prisma migration
      adding `lastAttemptAt DateTime?` and `lastError String?` to
      `WallpaperState`. Create `src/lib/wallpaper.ts` with the pure logic:
      stored-candidate and render-target Zod parsers (tolerant, malformed
      reads as absent), `dayStringInMexicoCity`, `dailyIndexFor` (stable hash,
      guaranteed different from yesterday's index), `resolveWallpaperSelection`
      (daily vs same-day shuffle, bounds-checked against a changed pool),
      `isPoolStale` (7-day staleness, stored-vs-current source-set
      comparison, 1-hour attempt throttle), `buildSearchPlan` (main game
      title first, then in-progress titles in deterministic name order, main
      game excluded, capped at `WALLPAPER_MAX_SEARCHES_PER_REFRESH` terms),
      and `pickShuffleIndex`. Tests in `src/lib/wallpaper.test.ts`.
      No app behavior yet. *Done when:* `pnpm test`, `pnpm typecheck`, and
      `prisma migrate status` are clean and the module is unused-but-present.
- [x] **Step 2 - Wallhaven API client** - `src/lib/wallhaven-api.ts`
      (server-only): `searchWallhaven(keyword, fetchFn)` returning
      `{ ok: true, items }` or a categorized error, response validated with
      Zod, filtered to valid jpg/png SFW candidates, capped at 10, with
      injectable `fetch` for tests. Tests in `src/lib/wallhaven-api.test.ts`
      covering success, filtering, cap, 429, non-OK, network, and malformed
      payloads. *Done when:* the client's tests pass and nothing imports it
      from the app yet.
- [x] **Step 3 - Refresh orchestration** - `src/lib/wallpaper-refresh.ts`
      (server-only): `refreshWallpaperPool(now)` implementing skip-if-fresh,
      attempt throttle upsert, execution of the search plan (main game first,
      then all in-progress terms; every planned term queried; deduped
      candidates interleaved and merged up to the pool cap; per-term failures
      and empty results logged, not fatal), candidate
      persistence with the searched source set (`candidates`, `cachedAt`,
      `lastError`), failure-preserves-pool, and a
      module-level in-flight promise guard for concurrent calls. Tests in
      `src/lib/wallpaper-refresh.test.ts` with mocked Prisma and client.
      *Done when:* its tests pass, the app still renders unchanged, and
      `pnpm build` passes.
- [x] **Step 4 - Shell wiring and background layer** - `(app)/layout.tsx`
      reads `AppSettings.wallpaperEnabled`, `WallpaperState`, and the current
      main game plus in-progress titles (small dedicated query), resolves the
      view model through the pure resolver, and queues
      `refreshWallpaperPool()` via `after()` from `next/server` only when
      enabled and stale. New `src/components/wallpaper/WallpaperBackground.tsx`
      (client): reduced-data hard-off, `matchMedia(min-width: 768px)` gate
      before assigning the image URL, fixed full-viewport image layer with a
      token-based scrim behind all content, and the bottom-corner attribution
      cluster (uploader, wallpaper page link, Wallhaven link). Page gaps show
      the image while cards and nav keep their opaque token surfaces. *Done
      when:* the dev server shows a daily wallpaper on desktop, nothing on
      mobile, nothing under reduced data, a fallback background with an empty
      or failed pool, and `pnpm build` + `pnpm test` pass.
- [x] **Step 5 - Shuffle and enable/disable controls** -
      `src/actions/wallpaper.ts` with `requireUser()` guards:
      `shuffleWallpaper()` (persists `selectedIdx` plus
      `renderTarget { day, source: "shuffle" }` and returns the new selection
      for direct client update, no revalidation) and
      `setWallpaperEnabled(enabled)` (upserts `AppSettings.wallpaperEnabled`).
      Shuffling with no stored pool returns a graceful error result. Add the
      shuffle icon button to the corner cluster and a minimal `Background`
      enable/disable card to Settings. Tests in
      `src/actions/wallpaper.test.ts`. *Done when:* shuffle changes the image
      immediately and survives reload for the rest of the day, the next day
      returns to the deterministic pick, the Settings switch turns the layer
      off and on across reloads, and `pnpm test` + `pnpm build` pass.
- [x] **Step 6 - Acceptance pass** - Live walkthrough: dark and light scrim
      legibility, desktop and mobile widths, reduced-data on/off, shuffle
      flow, attribution link target, pool-failure fallback (network blocked:
      last pool or token background persists, no crash, no console errors),
      a forced-stale load triggering exactly one queued refresh, a pool
      sourced from in-progress titles when no main game is set, a token
      fallback when the catalog has neither, and a main-game change producing
      a new wallpaper set on the next shell load. Run
      `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`. *Done when:*
      all states behave as specced and all four commands pass.

## Files / areas

- `prisma/schema.prisma` + migration - `WallpaperState.lastAttemptAt`,
  `WallpaperState.lastError`.
- `src/lib/wallpaper.ts` + `src/lib/wallpaper.test.ts` (new) - pure
  resolution, search-plan, staleness, and parsing logic.
- `src/lib/wallhaven-api.ts` + `src/lib/wallhaven-api.test.ts` (new) -
  server-only search client.
- `src/lib/wallpaper-refresh.ts` + `src/lib/wallpaper-refresh.test.ts` (new) -
  queued refresh orchestration.
- `src/actions/wallpaper.ts` + `src/actions/wallpaper.test.ts` (new) - shuffle
  and enable/disable actions.
- `src/components/wallpaper/WallpaperBackground.tsx` (new) - client layer.
- `src/app/(app)/layout.tsx` - singleton and main/in-progress game reads,
  view model, `after()` queue.
- `src/app/(app)/settings/page.tsx` + a small Settings card component -
  minimal Background enable/disable control.

## Data / contracts

- `WallpaperState.candidates` JSON payload (load-bearing; 18 reuses it for
  diagnostics):
  `{ queryVersion: 2, fetchedAt: string,
  searched: { gameId: string | null, name: string }[],
  items: WallpaperCandidate[] }` where `WallpaperCandidate` is
  `{ id, pageUrl, imageUrl, width, height, fileType, uploader: string | null }`.
  `searched` lists the terms actually queried in order (main game first);
  staleness compares its game ids against the current search plan.
  `pageUrl` is `https://wallhaven.cc/w/<id>` (attribution target), `imageUrl`
  is the full-size `path` URL.
- `WallpaperState.renderTarget` JSON payload (load-bearing):
  `{ day: "YYYY-MM-DD", source: "daily" | "shuffle" }`. Only shuffle writes
  it; the daily pick is computed statelessly and ignores it whenever its day
  differs from today.
- `WallpaperState.selectedIdx` stores today's shuffle target only; the
  resolver bounds-checks it against the current pool.
- Constants: `WALLPAPER_POOL_SIZE = 10`,
  `WALLPAPER_MAX_SEARCHES_PER_REFRESH = 4` (main game + up to 3 in-progress),
  `WALLPAPER_POOL_STALE_MS = 7 days`, `WALLPAPER_REFRESH_THROTTLE_MS = 1 hour`.
- Day strings are computed in the AppSettings time zone when available,
  defaulting to `America/Mexico_City` (existing app-wide default).
- No image binaries are ever stored; provider URLs are replaceable evidence.
- Action result shape follows the existing `{ success, data, error }` pattern;
  all actions guard with `requireUser()`.

## Testing

Vitest gate is on; the logic-bearing pieces ship tests in the same step:

- `wallpaper.test.ts` - day string, deterministic daily index (stable within a
  day, differs from yesterday), shuffle resolution and day expiry, bounds
  after pool replacement, search-plan ordering and cap (main game first,
  in-progress by name, main excluded), staleness and throttle math including
  source-set mismatch, tolerant parsers.
- `wallhaven-api.test.ts` - success parse, filtering and cap, every error
  category, 429 handling, injectable fetch.
- `wallpaper-refresh.test.ts` - skip-if-fresh, throttled attempts, successful
  persistence including the searched set, failure preserving the pool,
  per-term empty results advancing to the next term, all terms searched while
  respecting the pool cap, in-flight dedupe.
- `actions/wallpaper.test.ts` - shuffle persistence contract and
  enable/disable upsert with mocked Prisma.

UI surfaces (background layer, scrim, attribution cluster, Settings switch)
ride on `pnpm build` plus live dev-server evidence; no Playwright in this
project. Final gate: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Notes for the AI

- The refresh must never block or fail a page render: `after()` from
  `next/server` queues it post-response, and the refresh catches everything,
  recording diagnostics on the row instead.
- The client component renders nothing until the media query and data
  preference have been evaluated, avoiding hydration mismatch and any mobile
  download; server markup for the layer is empty by design.
- Use `useVisualPreferences()` for reduced data (manual override beats the OS
  setting), never the raw html attribute, matching 14d/15 artwork components.
- Attribution is a product requirement from the Wallhaven terms: always link
  the wallpaper page and mention Wallhaven; the uploader name is displayed
  when the API returns one.
- `purity=100` is the hard rule (NSFW is unreachable without an API key
  anyway). `categories=111` and `atleast=1920x1080` are defaults the live
  walkthrough validates against real game-title searches; adjust only with
  evidence and never below SFW.
- Game titles are normalized to lowercase query text with trademark symbols
  removed before fuzzy `q` searches; a title with no Wallhaven results simply
  yields nothing for that term and the next term runs.
- `sorting=random` needs no seed management at our scale (one page per
  refresh).
- Feature 18 will move or extend the enable/disable control into the fuller
  Wallhaven settings area; keep the action generic so it survives that move.

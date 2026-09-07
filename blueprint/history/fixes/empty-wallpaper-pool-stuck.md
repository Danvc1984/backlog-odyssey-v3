# Fix empty wallpaper pool stuck after fresh library

## Type: Fix

## The problem

On a fresh library, the auto refresh from `src/app/(app)/layout.tsx` runs
`refreshWallpaperPool` with no main/in-progress games, which stores a valid
but **empty** pool (`items: []` with `cachedAt` set). From then on
`isPoolStale` treats that empty pool as fresh: when the searched source plan
matches, it returns `false` until the 7-day staleness window
(`WALLPAPER_POOL_STALE_MS`), so the pool is never rebuilt automatically.
Every "Shuffle" then fails with `EMPTY_POOL_ERROR` ("No wallpaper pool is
available"), and Settings offers no way to manually rebuild the pool from
source — only the enable toggle and "Shuffle now", which both require an
existing pool.

## The fix

1. An empty pool is not a usable pool. `isPoolStale` gains an early check:
   when the stored pool has `items.length === 0`, report stale — but respect
   the existing 1-hour refresh throttle so a zero-result or failed refresh
   retries at most hourly instead of hammering Wallhaven on every request.
   Plan drift keeps overriding the throttle exactly as today, so adding games
   to an empty library still rebuilds immediately.
2. A manual rebuild path in Settings: `refreshWallpaperPool` gains an optional
   `force` argument that skips the staleness/throttle gates, a new
   `refreshWallpaperPool` server action wraps it (with `requireUser`), and
   `AppearanceSection` gets a "Refresh pool" button beside "Shuffle now" that
   rebuilds the pool from source and refreshes the status line / error text.

## Build steps

- [x] 1. Fix `isPoolStale` in `src/lib/wallpaper.ts`: after the
      `cachedAt`/parse guards, return `!isWallpaperRefreshThrottled(...)`
      when `storedPool.items.length === 0` (empty pool = stale unless we just
      tried), keeping the mode/plan-drift and 7-day checks after it for
      non-empty pools. Extend `src/lib/wallpaper.test.ts` with empty-pool
      cases (not throttled -> stale, throttled -> fresh, plan drift beats
      throttle). **Done when:** `pnpm test` passes, including the existing
      freshness suite unchanged.
- [x] 2. Add `force` support: `refreshWallpaperPool(now = new Date(), force =
      false)` and `runWallpaperRefresh(now, force)` skip the
      `!isPoolStale(...)` early return when `force`. Add a `refreshWallpaper`
      server action in `src/actions/wallpaper.ts` that calls
      `refreshWallpaperPool(undefined, true)`, requires the user, and maps
      `WallpaperRefreshResult` to `{ success, data: { status, itemCount },
      error }`. Extend `src/actions/wallpaper.test.ts`. **Done when:** `pnpm
      test` + `pnpm typecheck` pass; a throttled/fresh pool refreshed with
      `force` performs a real search and reports REFRESHED.
- [x] 3. Wire the "Refresh pool" button in
      `src/components/settings/AppearanceSection.tsx` next to "Shuffle now":
      optimistic transition disable, calls the new action, toasts the outcome
      (`Wallpaper pool refreshed (N images)` / error), and `router.refresh()`
      so `poolCachedAt` / `lastError` update. **Done when:** `pnpm build` +
      `pnpm lint` pass; in the running app, Settings can rebuild the pool and
      the "Pool updated" line refreshes.

## Verify

- Reproduce first: fresh DB (or set `wallpaperState.candidates.items = []`),
  enable wallpapers, confirm "Shuffle now" errors and the pool line is stuck.
- After step 1 only: within an hour of the empty-store, the pool stays put
  (throttled, no errors); after the throttle window or after adding an
  in-progress/main game, the pool rebuilds on its own and Shuffle works.
- After step 3: click "Refresh pool" in Settings — it rebuilds from source
  immediately even within the throttle window, reports the image count, and
  the status line updates; Shuffle then works.
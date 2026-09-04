# Fix: Reset and scope Wallhaven pools by main-game state

**Type:** Fix

## The problem

Changing or clearing the main game leaves the current `WallpaperState`
candidate pool intact until its asynchronous refresh finishes. A daily rotation
or manual shuffle can therefore continue showing artwork fetched for a previous
main game. The current refresh plan also mixes the main game with all
in-progress games and caps every pool at 10, so it cannot express the desired
main-only versus no-main behavior.

## The fix

- When a user actually assigns a different main game or clears the current main
  game through `updatePlayState`, clear `WallpaperState` in the same mutation
  path: remove candidates and render target, reset selection and diagnostics,
  and clear the attempt timestamp. The existing client `router.refresh()` then
  shows the token fallback while the queued shell refresh builds a replacement;
  it must never display the old pool after that mutation.
- Use mutually exclusive wallpaper search modes:
  - **Main game assigned:** query only that title and store at most 10 images.
    In-progress games do not contribute candidates.
  - **No main game:** query only visible in-progress games. Choose at most the
    six most recently updated `LibraryEntry` rows (`updatedAt` descending,
    stable name/id tie-break) so each selected game receives an equal quota of
    at least three images. The quota is `floor(20 / selectedGameCount)`, with
    no spillover from a game that returns fewer results; the resulting pool is
    at most 20 images.
- Raise the provider/result-parser ceiling only as needed for the no-main
  20-image pool, preserve SFW and image-type filtering, and persist enough
  pool metadata for the resolver and staleness checks to accept both 10- and
  20-image pools. Source comparison continues to be ordered, so switching
  modes or the selected recent games triggers a refresh.

## Build steps

- [x] **Step 1 - Clear the old pool on a manual main-game mutation.** Extend
      `updatePlayState` to detect an actual main-game assignment or clearing,
      update `WallpaperState` atomically with that mutation, and leave
      non-main play-state changes untouched. Extend the action tests for assign,
      clear, and no-op main flag paths. *Done when:* a successful manual
      assignment or clear leaves no candidate image available to shuffle or
      render before the next queued refresh; `pnpm test` and `pnpm typecheck`
      pass.

- [x] **Step 2 - Split main and no-main pool strategies.** Refactor the pure
      plan/validation logic, Wallhaven client limit, refresh runner, and shell
      query so a main game creates a main-only 10-image pool and no main game
      creates an equally apportioned, at-most-20-image pool from the six most
      recently updated visible in-progress entries. Add focused tests for
      quotas (1 through 6 games), recent-entry selection, main-only exclusion,
      20-image parsing/persistence, and stale source transitions. *Done when:*
      the runner calls Wallhaven with the correct per-game limit in both modes,
      desktop `/today` shows no old wallpaper immediately after a main-game
      change, and `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`
      pass.

## Verify

1. Set a new main game from Library or a game detail page. Confirm the previous
   wallpaper and shuffle candidates disappear immediately; reload once after
   the queued refresh and confirm the pool contains no in-progress-game source.
2. Clear the main game. Confirm the old main-only pool disappears, then reload
   after refresh. With 1 to 6 visible in-progress games, inspect the stored
   pool or shuffle through it to confirm equal per-game quotas and no more than
   20 images. With more than six, only the most recently updated six qualify.
3. Confirm mobile and reduced-data still assign no wallpaper image URL.

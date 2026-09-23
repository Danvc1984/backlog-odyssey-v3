# Fix: Remove obsolete Welcome taste-setup step

**Type:** Fix
**Status:** verified
**Branch:** `fix/remove-obsolete-welcome-taste-setup-step`

## The problem

After saving Welcome setup, `WelcomeSetupForm` presents a second, conditional screen that prompts the owner to start Taste Setup or continue. This extra step is no longer useful now that Taste Setup belongs on Today and has its own library eligibility rules.

## The fix

Make a successful Welcome save complete the flow directly to Today. Remove the conditional post-save Taste Setup and insufficient-library panels, their `gameCount` dependency, and no-longer-needed link import. Preserve the saved confirmation, all OS, price, theme, and optional Steam behavior, and the existing direct Today route.

## Build steps

- [x] Remove the post-save conditional Welcome screen and navigate to Today after a successful setup save. Simplify the component API and its call sites so no unused game-count query or prop remains.

  **Done when:** saving Welcome setup lands directly on Today regardless of library size; no Taste Setup prompt, Start now, Not now, or Library detour remains in Welcome; Steam connection and setup validation still work; `pnpm typecheck` and `pnpm build` pass.

## Verify

1. Start the app with `pnpm dev` and sign in with an incomplete onboarding state.
2. Complete the Welcome fields, with or without connecting Steam, then save.
3. Confirm navigation goes directly to `/today` and the removed second screen cannot appear.
4. Run `pnpm typecheck && pnpm build`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1545,"specSha256":"3ac17c67db7e67514bdb40d09a9ce5f944637ebb5cae3bd4350a7299a36ce603","branch":"refs/heads/fix/remove-obsolete-welcome-taste-setup-step","head":"99f63d36beae4a3d8b64f1aa1a4fe53cbe7c67f1","baseRef":"refs/heads/main","baseCommit":"99f63d36beae4a3d8b64f1aa1a4fe53cbe7c67f1","sourceTree":"66a8f5115fca48900cacd998b1b04c7beb173d9c","absentOptional":[]} -->

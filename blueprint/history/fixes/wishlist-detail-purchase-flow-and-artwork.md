# Fix: Wishlist detail purchase flow and artwork

**Type:** Fix
**Status:** verified
**Branch:** `fix/wishlist-detail-purchase-flow-and-artwork`
**Fixes:** F-13, F-14, F-15, F-21

## The problem

Wishlist detail does not clearly prioritize the decision to acquire a game. Its actions and selected offer hierarchy are weak, Mexico keyshop activation risk is separated from the price, acquisition ends without a distinct confirmation moment, and artwork browsing is slow without a fullscreen viewer.

## The fix

Make the wishlist detail screen a focused purchase-decision surface. Strengthen its hero and primary actions, keep activation risk beside the motivating offer, add a quick accessible confirmation moment, and improve artwork exploration. Preserve seller links as the authority, do not delay acquisition, and honor reduced-motion and reduced-data preferences.

## Build steps

- [x] **Step 1 - Focus the wishlist hero, selected offer, and actions.**
   - Link and emphasize the title, make the final price and discount prominent, expose focused acquisition actions in the hero, and place any Mexico keyshop activation warning directly below its selected price.
   - **Done when:** a wishlist detail makes the selected offer, its discount, activation risk, and next action immediately scannable without separating the warning from the relevant price.

- [x] **Step 2 - Add a distinct accessible acquisition confirmation.**
   - Show available cover artwork and restrained celebratory motion after confirmation, with reduced-motion and reduced-data fallbacks, without delaying the mutation or obscuring its result.
   - **Done when:** successfully acquiring an item has an immediate, clear completion moment that remains accessible with motion or remote-image reduction enabled.

- [x] **Step 3 - Improve wishlist and game detail artwork viewing.**
   - Increase carousel movement speed modestly and add an accessible fullscreen, contain-aware viewer with keyboard controls and reduced-motion behavior for both detail surfaces.
   - **Done when:** artwork opens in a usable fullscreen viewer, keyboard controls work, source image framing is preserved, and carousel behavior respects accessibility preferences.

## Verify

- Run focused Vitest coverage for added logic and `pnpm test`.
- Run `pnpm typecheck` and `pnpm build`.
- In the running app, inspect a wishlist item with a selected offer, including a keyshop offer, confirm the warning sits beside the price, acquire an item with normal and reduced-motion/reduced-data settings, and use the fullscreen viewer from game and wishlist detail pages with keyboard navigation.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2634,"specSha256":"fad341d1263f3e1e27921e2448116ff9845a8b7bd268447423c4441f9788de43","branch":"refs/heads/fix/wishlist-detail-purchase-flow-and-artwork","head":"59ccfc47918e6d73505b0a6b6b4a9081150df26a","baseRef":"refs/heads/main","baseCommit":"59ccfc47918e6d73505b0a6b6b4a9081150df26a","sourceTree":"a42b2fbd38bbdf8c1edc4b877cb7cc15a54db391","absentOptional":[]} -->

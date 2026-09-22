# Fix: Remove invalid nested markup from wishlist personal-fit labels

**Type:** Fix

**Status:** verified

**Branch:** fix/wishlist-detail-invalid-html

## The problem

The wishlist detail page renders `InfoPopover` inside `<p>` elements used as personal-fit field labels. `InfoPopover` renders a dialog `<div>` containing its own `<p>`, so the resulting HTML nests block elements and paragraphs inside paragraphs. Next.js reports hydration warnings for the Interest, Game experience, and Handheld suitability labels.

## The fix

Use a non-paragraph wrapper for the three personal-fit labels while preserving their existing flex layout and typography. Keep `InfoPopover`'s dialog structure and accessible behavior unchanged. Do not alter field values, actions, or visual spacing. Also compact the shared info tooltips used by wishlist detail and library personal fields by moving the close icon to the upper-right corner and removing the visible `Close` text.

## Build steps

- [x] Replace the three personal-fit label wrappers in `src/app/(app)/wishlist/[id]/page.tsx` with a block wrapper that can legally contain `InfoPopover`. Done when the labels retain their current appearance and the rendered wishlist detail markup contains no `<div>` or nested `<p>` descendant of a label paragraph.
- [x] Compact `src/components/ui/info-popover.tsx` for all wishlist and library usages. Done when the close control is an accessible icon-only button in the tooltip's upper-right corner, the visible `Close` text is gone, and opening and closing behavior remains unchanged.

## Verify

- Run `pnpm typecheck`.
- Run `pnpm build`.
- Open a wishlist detail page, inspect the console while opening each personal-fit info popover, and confirm no invalid-nesting or hydration warnings appear.
- Confirm each popover still opens and closes normally.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1839,"specSha256":"689ace1fdb1e133cc1e9216457147fb745d7d6105aa326c476e74ea6d08929c1","branch":"refs/heads/fix/wishlist-detail-invalid-html","head":"00495e713435b6ec171c2fc0d57bcc5fe0409257","baseRef":"refs/heads/main","baseCommit":"00495e713435b6ec171c2fc0d57bcc5fe0409257","sourceTree":"bc780c72d290587fdb6bdfa1c69e883aaf880f48","absentOptional":[]} -->

## How to try it

1. Start the app with `pnpm dev`, then open any library game detail page or wishlist detail page.
2. Open a personal-field information tooltip.
3. Confirm the tooltip is content-sized, uses compact padding, and shows an icon-only close control in the upper-right corner.
4. Close it with the icon, `Escape`, and an outside click. Confirm no invalid HTML nesting or hydration warning is reported in the browser console.

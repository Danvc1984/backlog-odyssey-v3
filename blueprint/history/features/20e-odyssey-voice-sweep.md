# Feature: Odyssey voice sweep

**From build-plan:** feature 20e
**Status:** complete

## Goal

Replace generic and placeholder copy on expressive surfaces with a warm,
adventurous Odyssey voice while keeping statuses, errors, evidence, freshness,
field help, caveats, navigation, and section identity factual.

## Scope delivered

- Landing page, metadata, onboarding, Today, Library, Wishlist, Collections,
  Settings, detail routes, empty states, recommendation openers, and
  non-destructive dialog copy were reviewed and updated.
- The Today placeholder was removed.
- Recommendation copy preserves the `opener: factual label` composition
  contract, with exact-string tests updated.
- Factual sentinels, operational labels, provider attribution, destructive
  dialogs, and navigation labels were preserved.
- The Library title settled on `Your voyage, charted` and the Wishlist
  description settled on `Keep an eye on the games calling your name, and let
  the best moment to buy reveal itself.`

## Verification

- `pnpm test` - 121 files passed, 1198 tests passed.
- `pnpm lint` - passed.
- `pnpm build` - passed; `/today` remains correctly server-rendered because it
  depends on authenticated request headers.
- Mobile visual review at 390x844 in light and dark modes found no horizontal
  overflow or header wrapping regression.
- No findings were recorded.

## Notes

This feature changed copy only. No database, export/import, API, route, or
component logic changes were introduced.

# Feature: Game-detail screenshots section

**From build-plan:** 17c
**Status:** complete

## Goal

Add a dedicated, carousel-style Screenshots section near the bottom of the
game detail page showing up to six RAWG screenshots from the version 3
snapshot, with manual navigation, manual-only mode under reduced motion, a
zero-fetch token fallback under reduced data, and the existing RAWG
attribution. It completes the media half of feature 17 on the catalog side.

## Design reference

No mockup exists (`prototypes/` was discarded after feature 14 and 19a owns
the next prototype round), matching the 17b precedent. The visual target is
defined by project-plan.md section 13 (dedicated carousel-style section near
the bottom, separate from the metadata block, reduced-data token placeholder,
reduced motion stays manual, existing RAWG attribution rule) and the existing
detail-page design system: a `SectionCard` with eyebrow "Media" containing the
same `Carousel` pattern Today uses. If a concrete visual reference is wanted
first, run `/prototype` before `/implement`; otherwise build within the
existing token system.

## In scope

- Promote the shared `Carousel` from `src/components/today/` to
  `src/components/ui/` (no behavior change) so game pages can use it without
  a cross-feature import; update the two Today importers
- `src/lib/screenshot-view.ts`: `resolvePageScreenshots(payload: unknown)`
  guarding v1/v2/v3 snapshot rows and malformed entries, re-capped at 6
- Extract the `externalUrl` helper from `MetadataSection` into
  `src/lib/external-url.ts` so both metadata and screenshots attribution
  links share one validator
- New `ScreenshotsSection` client component: SectionCard + Carousel of
  screenshot slides, reduced-data gradient token tiles, RAWG credit line
- Page wiring on `/games/[id]`: resolve screenshots server-side and render
  the section after the DLC section, before the Delete card
- Unit tests for the two pure helpers (Vitest; the test gate is on)

## Out of scope

- Wishlist detail surfaces (17d). The component's props stay provider-agnostic
  so 17d can reuse it directly, but no wishlist route changes here
- Any enrichment, pipeline, snapshot, or provider changes
- Lightbox, zoom, fullscreen, thumbnail strip, or preloading all six images
- Auto-advance behavior changes: the existing Carousel contract (slow
  auto-advance under full motion, pause on hover/focus, manual under reduced
  motion) is reused as-is for app-wide consistency
- Wallhaven interaction and semantic token changes

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Promote the shared Carousel** - move
  `src/components/today/Carousel.tsx` to `src/components/ui/Carousel.tsx`
  unchanged and update the imports in `CurrentlyPlayingCarousel.tsx` and
  `FeaturedOffersCarousel.tsx`. No component or styling changes.
  *Done when:* Today renders exactly as before with `pnpm dev`;
  `pnpm typecheck` and `pnpm build` green.

- [x] **Step 2 - Screenshot payload guard** - create
  `src/lib/screenshot-view.ts` with
  `resolvePageScreenshots(payload: unknown): RawgScreenshotEntry[]`:
  returns `[]` for non-object payloads and for rows whose `screenshots` key
  is missing or not an array (v1/v2), keeps only structurally valid entries
  (`rawgId` a finite number, `image` a non-empty string, `width`/`height`
  null or a finite number, skipping malformed ones), and caps the result at
  6. Ship `screenshot-view.test.ts`.
  *Done when:* tests cover a valid v3 row, a v2-shaped row, malformed and
  partial entries, the 6-entry cap, and a non-object payload;
  `pnpm typecheck` and `pnpm test` green.

- [x] **Step 3 - Shared attribution URL helper** - extract `externalUrl`
  from `src/components/games/MetadataSection.tsx` into
  `src/lib/external-url.ts` with identical behavior (null on parse failure
  or non-http/https protocol) and update MetadataSection to import it. Ship
  `external-url.test.ts`.
  *Done when:* tests cover http, https, a non-http scheme, and an
  unparseable string; MetadataSection renders unchanged; typecheck and
  tests green.

- [x] **Step 4 - Screenshots section component** - create
  `src/components/games/ScreenshotsSection.tsx` (client) with props
  `{ id: string; title: string; screenshots: RawgScreenshotEntry[];
  sourceUrl: string | null }`. Renders nothing when `screenshots` is empty.
  Otherwise a `SectionCard` (eyebrow "Media", title "Screenshots") wrapping
  the shared `Carousel` (label "Screenshots") with one slide per screenshot:
  a fixed `aspect-video` container with `next/image` (`fill`,
  `object-contain`, `loading="lazy"`, `unoptimized`) and alt text
  `Screenshot {n} of {title}`. Under reduced data
  (`useVisualPreferences().resolvedData === "on"`) every slide renders as a
  deterministic gradient token tile (`gradientFor(id)`, aria-hidden, no
  image element, zero fetches). A small credit line under the carousel reads
  "Screenshots via RAWG", linked when `externalUrl(sourceUrl)` validates and
  plain text otherwise.
  *Done when:* with `pnpm dev` on a re-enriched v3 game the section shows
  the first screenshot with working Previous/Next and an aria-live
  position counter; toggling reduced data in Settings swaps slides to
  gradient tiles with no image requests in the network tab; the credit line
  renders in both cases.

- [x] **Step 5 - Page wiring** - in `src/app/(app)/games/[id]/page.tsx`
  resolve `const screenshots = resolvePageScreenshots(rawgPayload)` and
  render `<ScreenshotsSection id={game.id} title={game.name}
  screenshots={screenshots} sourceUrl={rawgSnapshot?.sourceUrl ??
  rawgPayload?.rawgUrl ?? null} />` after the DLC section and before the
  Delete card, inside the existing `GameThemeScope`.
  *Done when:* a v3 game shows the section in place; a v2-row game and a
  never-enriched game show no screenshots section; the page remains valid.

- [x] **Step 6 - Acceptance** - run `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. Walk game detail for a v3 game and a v2-row game in dark,
  light, and system modes, with reduced motion on (carousel manual, no
  auto-advance), reduced data on (token tiles, zero image fetches), a
  single-screenshot game (no controls shown), and the Wallhaven background
  enabled.
  *Done when:* all states behave as specified, un-themed games render
  exactly as today, and all three checks are green.

## Files / areas

- `src/components/today/Carousel.tsx` - moves to
  `src/components/ui/Carousel.tsx` (content unchanged)
- `src/components/today/CurrentlyPlayingCarousel.tsx`,
  `src/components/today/FeaturedOffersCarousel.tsx` - import path only
- `src/lib/screenshot-view.ts` (new) + `src/lib/screenshot-view.test.ts`
- `src/lib/external-url.ts` (new) + `src/lib/external-url.test.ts`
- `src/components/games/MetadataSection.tsx` - import the shared helper
- `src/components/games/ScreenshotsSection.tsx` (new)
- `src/app/(app)/games/[id]/page.tsx` - guard call and section render

## Data / contracts

- Consumes the v3 snapshot fields locked in 17a:
  `RawgScreenshotEntry { rawgId, image, width, height }`, already filtered
  and capped at fetch time; the guard re-validates because v1/v2 rows lack
  the key entirely (the established optional-runtime rule for
  esrbRating/seriesGames/screenshots/palette)
- Load-bearing for 17d - lock now: `ScreenshotsSection` props are
  provider-agnostic (`id`, `title`, `screenshots`, `sourceUrl`) and
  `resolvePageScreenshots` accepts `unknown`, so the wishlist detail page
  can reuse both directly against `WishlistMetadataPayload` without changes
- New import path for the shared carousel:
  `@/components/ui/Carousel` (Today and any future consumer)
- No Prisma, API, or snapshot schema changes

## Testing

- Vitest covers the two pure helpers: `resolvePageScreenshots` (row and
  entry tolerance, cap) and `externalUrl` (scheme and parse failures)
- Everything else is UI: per-step browser evidence plus the build; the
  reduced-motion and reduced-data behaviors are verified live through the
  Settings toggles and the network tab (Step 6)
- No new server actions or parsers beyond the two helpers

## Notes for the AI

- The page stays a server component; `ScreenshotsSection` and the Carousel
  are the client boundary. The guard runs server-side and passes clean data
  down.
- Never cast `rawgPayload` straight to `RawgMetadataPayload` when reading
  screenshots; always go through `resolvePageScreenshots` (v1/v2 rows).
- The Carousel renders only the active slide, so images load lazily one at
  a time; keep `unoptimized` per the existing artwork pattern.
- The section sits inside `GameThemeScope`, so the SectionCard inherits the
  17b accent tints automatically; add no new theme logic and touch no
  semantic tokens.
- Fixed aspect containers keep layout stable while images load; do not
  derive layout from `width`/`height`.
- If the Today carousel promotion reveals hidden coupling, stop and show
  the diff before adapting anything beyond import paths.
- Single-user app: no per-user scoping. No comments except non-obvious
  decisions; no em dashes in generated content.
# Feature: Wishlist detail page (11c-b)

**From build-plan:** 11c-b (under 11. Compatibility synthesis > 11c. Wishlist detail)
**Status:** steps built on `feature/wishlist-detail-page`, awaiting review

## Goal

Give every wishlist entry a dedicated `/wishlist/[id]` page reached by clicking
the card title on `/wishlist`. The page composes all existing wish data in one
place: full RAWG metadata, Steam identity with provenance, offers with target
price and opportunity badge, notes, interest, and the existing
edit/acquire/delete controls.

## Design reference

None. This is a composition feature, not a look-alike: there is no mockup and
`prototypes/` does not exist yet (feature 14 locks the global visual pass).
Build against existing in-app patterns: page structure mirrors
`src/app/(app)/games/[id]/page.tsx`, styling mirrors `WishlistCard` and the
current dark-first tokens.

## In scope

- New server-component route `src/app/(app)/wishlist/[id]/page.tsx`.
- `WishlistCard` title becomes a `Link` to `/wishlist/[id]`.
- Header: name, type label, interest stars, DLC parent link,
  `WishlistEntryActions` (edit/acquire/delete, reused unchanged).
- Steam identity block with provenance and suggestion/manual flows
  (`WishlistIdentity`, reused unchanged).
- RAWG metadata section rendering the full payload via the games'
  `MetadataSection`, using the same precedence as the card: the entry's own
  wishlist snapshot first, then the base game's catalog RAWG snapshot for DLC
  wishes, with an "inherited" note.
- Offer block: selected cheapest offer, discount/regular/historical low,
  keyshop warning, target price + opportunity badge, stale note, expandable
  alternatives, identical in behavior to the card.
- Notes display.
- Unknown or deleted entry id redirects to `/wishlist`.
- Small extractions so nothing is duplicated:
  - RAWG payload guard moves out of `WishlistCard` into a tested lib helper.
  - The card's internal offer section becomes a shared component used by both
    card and detail page.

## Out of scope

- Read-only compatibility block, eligibility states, and per-entry
  compatibility refresh (11c-c).
- Fill-only RAWG enrichment control that hides once a snapshot exists (11c-c).
  RAWG matching stays where it is today, inside the Edit dialog.
- Any new mutation, schema change, or provider call. The detail page reads
  only; every action it hosts already exists.
- Batch progress and provider error details (stay out of the wishlist per the
  overview).
- Special post-acquire/post-delete navigation. The existing
  `router.refresh()` behavior stands; the page then redirects to `/wishlist`
  because the entry no longer exists.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Detail route skeleton and card-title link** - Create
  `src/app/(app)/wishlist/[id]/page.tsx` as a server component that loads the
  entry by id (name and type only for now) and calls `redirect("/wishlist")`
  when it is missing. Render a minimal page: back-to-wishlist context, entry
  name, type label. Turn the `h2` title in `WishlistCard` into a
  `next/link` `Link` to `/wishlist/${entry.id}` styled as today (hover
  underline allowed). *Done when:* clicking any card title on `/wishlist`
  navigates to its detail URL and shows that entry's name and type; visiting a
  bogus id such as `/wishlist/does-not-exist` lands back on `/wishlist`.

- [x] **Step 2 - Full query plus header, identity, and local fields** - Expand
  the page query to everything the composed page needs: offers ordered
  `price asc nulls last`, `targetPriceMxn`, `metadataSnapshot`, `baseGame`
  with its latest catalog RAWG snapshot select, and the full `BASE_GAME` list
  for the edit dialog. Build `offerView` with
  `buildEntryOfferView(offers, targetPriceMxn, new Date())` exactly like the
  list page. Render: type badge, interest stars, DLC parent link to
  `/games/[baseGameId]`, `WishlistEntryActions`, `WishlistIdentity`, and the
  notes paragraph (or nothing when notes are empty). *Done when:* the detail
  page shows the identity chip with provenance, and add/remove/suggest flows
  work from it; edit, acquire, and delete work from the page; deleting or
  acquiring bounces the browser back to `/wishlist` via the missing-entry
  redirect; interest and notes match what the card showed.

- [x] **Step 3 - RAWG metadata section with shared payload parser** - Extract
  the `metadataPayload` guard from `WishlistCard` into
  `src/lib/rawg-metadata-payload.ts` exporting
  `parseRawgMetadataPayload(value: unknown): RawgMetadataPayload | null`;
  refactor the card to use it and add `rawg-metadata-payload.test.ts`
  covering: valid payload passes, non-object fails, object missing `title` or
  `genres` fails. On the detail page resolve own-snapshot-else-inherited
  (same precedence as the card), render the games' `MetadataSection`
  (payload, sourceUrl, fetchedAt), show "Metadata inherited from the base
  game." when inherited, and show the existing no-metadata guidance line for
  base-game wishes with no snapshot anywhere. *Done when:* the detail page
  renders the full metadata field set; a DLC wish without its own snapshot
  shows the base game's data plus the inherited note; an entry with no
  snapshot shows the guidance line; `pnpm test` passes including the new
  parser tests.

- [x] **Step 4 - Shared offer block and alternatives** - Move the internal
  `WishlistOfferSection` and the currency/formatting helpers out of
  `WishlistCard` into `src/components/wishlist/WishlistOfferSection.tsx`
  (props: `offerView`, `hasConfirmedIdentity`); the card imports it unchanged
  in behavior. On the detail page render it below identity, then
  `WishlistOfferAlternatives` with the same Steam Store dedupe rule the card
  applies (drop the Steam row from alternatives unless Steam is selected).
  When identity is unconfirmed the section renders nothing, matching the
  card; the identity block's "No store identity - prices unavailable" line is
  the visible state for that case. *Done when:* the detail page shows the
  selected offer, discount/regular/historical-low line, keyshop warning,
  target plus Opportunity badge, stale note, and expandable alternatives;
  side-by-side, the wishlist card renders exactly as before the extraction;
  `pnpm build` passes.

- [x] **Step 5 - Wishlist DLC links on game detail** - In
  `src/components/games/DlcSection.tsx`, make each wishlist DLC name link to
  its `/wishlist/[id]` detail page (same hover style as card titles); the
  "In wishlist" badge and stars stay unchanged. *Done when:* from any base
  game's detail page, clicking a listed wishlist DLC opens that entry's
  `/wishlist/[id]` page.

## Files / areas

- New: `src/app/(app)/wishlist/[id]/page.tsx`
- New: `src/lib/rawg-metadata-payload.ts` and `src/lib/rawg-metadata-payload.test.ts`
- New: `src/components/wishlist/WishlistOfferSection.tsx`
- Edited: `src/components/wishlist/WishlistCard.tsx` (title link; import the two extractions)
- Untouched: `src/actions/*`, `prisma/schema.prisma`, all other routes

## Data / contracts

- No schema changes and no new server actions.
- Load-bearing route contract: `/wishlist/[id]`. Linked from the card title
  today; 11c-c extends this same page with the read-only compatibility block
  and fill-only enrichment controls, so keep the page's section structure
  legible for that addition.
- Load-bearing shared component: `WishlistOfferSection` becomes the single
  offer renderer for both card and detail page. Its props are
  `{ offerView: WishlistOffersView; hasConfirmedIdentity: boolean }`.
- `buildEntryOfferView` stays the only offer-view builder; the detail page
  must construct it identically to the list page (freshness uses request-time
  `new Date()`).

## Testing

Vitest is configured and the test gate is on.

- Steps 1, 2, and 4 are UI composition and behavior-preserving extraction:
  exempt from unit tests per `coding-standards.md`; verified by dev-server
  walkthrough plus `pnpm build`.
- Step 3 adds pure parsing logic, so it ships
  `rawg-metadata-payload.test.ts` (valid, non-object, missing required keys).
- Manual browser evidence per step: card-title navigation, bogus-id redirect,
  identity add/suggest-confirm/dismiss/remove from the detail page,
  edit/acquire/delete round trips ending back on `/wishlist`, metadata
  precedence for a DLC wish, and card-vs-detail offer parity.

## Notes for the AI

- Auth is enforced once by `requireUser()` in `src/app/(app)/layout.tsx`;
  pages under the group do not re-check (matches `/games/[id]`). Single-user
  app: no per-user query scoping.
- The page is a server component; all interactivity comes from the reused
  client components (`WishlistIdentity`, `WishlistEntryActions`,
  `WishlistOfferAlternatives`). Match Next 15 async-params typing as in
  `/games/[id]`.
- Missing entry handling mirrors game detail: `redirect("/wishlist")` instead
  of a not-found page.
- Keep metadata precedence and offer rules byte-for-byte consistent with
  `WishlistCard`; the extraction steps exist to guarantee one implementation.
- Respect `coding-standards.md`: strict TypeScript, no `any`, Zod at action
  boundaries (none added here), Tailwind tokens only, comments only for
  non-obvious whys, no em dashes anywhere.
- Do not touch compatibility or enrichment surfaces; 11c-c owns them.

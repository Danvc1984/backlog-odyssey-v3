# Feature: Steam wishlist import and enrichment

**From build-plan:** feature 10c
**Status:** ready for complete

## Goal

Let the user pull their public Steam wishlist into the app's Wishlist with one
click. New base-game entries are created idempotently with neutral interest and
queued for RAWG enrichment. DLC items share the existing unresolved-DLC queue
(discriminated by source). A conservative local-match review prevents silent
duplicates: any name match, exact included, goes to a persistent review queue
where linking is never automatic. Owned games are silently omitted. A header
sync chip and a persistent result summary report what happened.

## In scope

- Steam wishlist fetch via Steam Web API `IWishlistService/GetWishlist/v1/`
  using the existing Steam Web API key, followed by Store app-details enrichment
- Idempotent base-game WishlistEntry creation by Steam App ID (skip if already
  exists in wishlist or catalog)
- Neutral interest `2/5` on new entries, empty notes
- DLC handling: if base game exists in catalog, create DLC wishlist entry linked
  to it; otherwise queue in the shared unresolved-DLC queue with `source` =
  `WISHLIST_IMPORT`
- Local-match review using `normalizeName()` from `duplicate-utils.ts`: any
  name match (exact included) creates a `WishlistImportReview` record; linking
  is never automatic
- Persistent ignored queue (`WishlistImportIgnore`): user can suppress a review
  candidate; ignored items stay suppressed until restored
- Silent owned-game omission: games already in the catalog (by Steam App ID)
  are skipped without creating review entries
- Follow-up RAWG enrichment queue for newly created base-game wishlist entries
- Header sync chip showing last import status
- Persistent result summary panel (created, queued reviews, ignored, enrichment)
- `source` discriminator column on `UnresolvedSteamDlc` to share the queue
  between owned-sync and wishlist-import

## Out of scope

- Automatic price refresh after import (user triggers manually via existing
  `Update prices` button)
- Automatic recommendation runs (deferred to feature 12)
- Steam wishlist change detection or periodic sync (manual-only for now)
- Editing or deleting entries during import review (use existing edit/delete)
- Importing DLC wishlist items whose base game is only in the wishlist (not
  catalog) - these go to unresolved queue

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema migration: source discriminator and review/ignore models** -
  Add `source` enum (`OWNED_SYNC` / `WISHLIST_IMPORT`) to `UnresolvedSteamDlc`
  with default `OWNED_SYNC` for existing rows. Add `WishlistImportReview` model
  (steamAppId, name, candidates JSON, status OPEN/LINKED/IGNORED, reviewedAt).
  Add `WishlistImportIgnore` model (steamAppId unique, name, createdAt). Update
  `upsertUnresolvedSteamDlc` to accept and write `source`. *Done when:*
  `pnpm prisma:migrate` succeeds, generated client includes new models and
  enum, existing `steam-import.ts` and `steam-sync.ts` compile unchanged
  (they pass `source: "OWNED_SYNC"` implicitly or explicitly).

- [x] **Step 2 - Steam wishlist API fetcher** -
  Add `fetchSteamWishlist(steamId64, apiKey)` to `src/lib/steam-api.ts`. Calls
  Steam Web API `IWishlistService/GetWishlist/v1/` for wishlist app IDs, then
  uses Store `appdetails` to return `{ appid: number; name: string }[]` and
  detect DLC type and `steamBaseAppId` (reusing the existing details pattern
  with the concurrency limit). Handles empty wishlist, HTTP errors, and
  malformed JSON gracefully (returns an empty array).
  *Done when:* unit test covers happy path (mock fetch), empty wishlist, HTTP
  error, and malformed response; `pnpm test` passes.

- [x] **Step 3 - Import action: core logic** -
  Add `importSteamWishlist()` server action in `src/actions/steam-import-wishlist.ts`.
  Flow: require user, require Steam context, fetch wishlist. If fetch returns
  zero items, return `{ error: "Steam wishlist appears empty or private" }`.
  Then for each item:
  (1) skip if Steam App ID already exists in catalog (`ExternalGameId` or
  `GameAvailability`),
  (2) skip if Steam App ID already exists in wishlist (`WishlistEntry.steamAppId`),
  (3) skip if Steam App ID is in `WishlistImportIgnore` table,
  (4) for base games: run `normalizeName` match against all catalog base games
  and existing wishlist entries; if match found, create `WishlistImportReview`
  record (upsert by `steamAppId` to handle concurrent runs); if no match,
  create `WishlistEntry` with `steamAppId` set,
  `steamAppIdProvenance: STEAM_IMPORT`, `interest: 2`,
  (5) for DLC: if base game exists in catalog, create DLC `WishlistEntry`
  linked to it; otherwise call `upsertUnresolvedSteamDlc` with
  `source: "WISHLIST_IMPORT"`.
  Returns `{ created, queuedReviews, ignored, enrichment }` counts. Processes
  in chunks of 50 within transactions. *Done when:* unit test covers: empty
  or private wishlist error, idempotent re-import (no duplicates), owned-game
  omission, local-match review creation, DLC with known base, DLC with unknown
  base (unresolved queue), ignored-item skip; `pnpm test` passes.

- [x] **Step 4 - Review queue server actions** -
  Add `getWishlistImportReviews()`, `linkWishlistImportReview(reviewId, targetId)`,
  `createWishlistImportReviewAsNew(reviewId)`, and
  `ignoreWishlistImportReview(reviewId)` to `src/actions/wishlist-import-review.ts`.
  `link` writes the review's Steam App ID as identity onto the matched record:
  if the candidate is a catalog `Game`, create or update its `ExternalGameId`
  (`STEAM_APP`, `EXACT_STEAM_APP_ID`) and mark the review LINKED - no new
  wishlist entry, because the game is already owned; if the candidate is an
  existing `WishlistEntry`, set its `steamAppId` and
  `steamAppIdProvenance: STEAM_IMPORT` and mark the review LINKED. `createAsNew`
  makes a fresh `WishlistEntry` from the review (name, steamAppId,
  `STEAM_IMPORT` provenance, interest 2) and marks the review LINKED. `ignore`
  moves the review to IGNORED and creates a `WishlistImportIgnore` record. All
  actions require user. *Done when:* unit tests cover link-to-catalog (identity
  written, review resolved, no entry created), link-to-wishlist (identity
  written, review resolved), create-as-new (entry created, review resolved),
  ignore (ignore record created, review resolved), and idempotent re-resolve;
  `pnpm test` passes.

- [x] **Step 5 - RAWG auto-enrichment for imported wishlist entries** -
  Add `autoEnrichWishlistEntries(entryIds)` to `src/lib/wishlist-rawg-queue.ts`.
  For each base-game entry ID that has no `WishlistMetadataSnapshot`: call
  `matchRawgGame({ title: entry.name, selectedRawgId: null })` from
  `src/lib/rawg-api.ts`. If `MATCHED`, build the payload via the existing
  `toWishlistMetadataPayload` helper from `src/lib/rawg-enrichment.ts` and
  upsert a `WishlistMetadataSnapshot`. If `AMBIGUOUS` or `NOT_FOUND`, skip
  silently (the user can enrich manually later). Process sequentially with a
  small delay between calls to respect RAWG rate limits. The import action
  returns after the Steam/database phase; the client then calls a separate
  follow-up action for this best-effort enrichment so RAWG cannot block the
  import result. Returns `{ enriched, skipped }`. *Done when:*
  unit test covers: exact-match enrichment persisted, ambiguous/no-match
  skipped, RAWG error swallowed, entries with existing snapshot skipped;
  `pnpm test` passes.

- [x] **Step 6 - Wishlist page: import button and result summary panel** -
  Add `ImportSteamWishlistButton` client component next to the existing
  `PriceRefreshPanel` in the wishlist header. Calls `importSteamWishlist()`,
  shows loading state, then renders a `WishlistImportResultPanel` with counts
  (created, queued reviews, ignored, enrichment). Panel is dismissible and
  persists the last result in component state (not DB - re-import shows fresh
  results). If queuedReviews > 0, shows a link/button to scroll to the review
  section. *Done when:* clicking the button on the running app triggers import,
  result panel shows counts, re-import shows updated counts, button is disabled
  during import.

- [x] **Step 7 - Review queue UI on wishlist page** -
  Add `WishlistImportReviewSection` component below the filter bar on the
  wishlist page. Server component that fetches OPEN reviews. Each review card
  shows: Steam game name, matched local candidates (name + type), and three
  actions: Link (select from candidates or search all games), Create as new
  (creates fresh wishlist entry), Ignore (suppresses future matches). After any
  action, the review disappears from the list. Section is hidden when no open
  reviews exist. *Done when:* after import with matches, the review section
  appears; linking resolves the review; creating as new adds a wishlist entry;
  ignoring suppresses the review and future re-imports skip it.

- [x] **Step 8 - Header sync chip** -
  Add a non-authoritative sync status chip to the wishlist header showing the
  last import timestamp and a summary (e.g., "Last import: 12 created, 3
  reviews, 8 enriched"). Read from `SteamConnection.counts` (extend the JSON
  to include `lastWishlistImport` with timestamp and counts). Chip is a small
  badge/text, not interactive. *Done when:* after import, the chip shows the
  timestamp and counts; before any import, the chip is hidden or shows
  "Not imported yet".

- [x] **Step 9 - RAWG follow-up throughput and progress** -
  Process imported wishlist enrichment in small client-triggered batches with
  bounded provider concurrency, so one server action never runs for minutes.
  Show the current phase and completed-game count while enrichment runs, and
  accumulate the persisted summary across batches. Load RAWG artwork directly
  and lazily so Next image optimization timeouts do not flood the server logs.
  *Done when:* a large import visibly reports enrichment progress, each
  follow-up request handles only one bounded batch, provider calls are bounded,
  and RAWG CDN image timeouts no longer produce `/_next/image` failures.

- [x] **Step 10 - Correct Steam DLC classification and safe re-import repair** -
  Accept Steam's string-form `fullgame.appid` values when reading app details,
  so wishlist DLCs receive their base-game ID. On a later import, safely
  reclassify prior Steam-imported base entries when their catalog base is now
  known; leave entries whose base cannot be resolved in the existing DLC review
  queue rather than deleting local data. *Done when:* DLCs with Steam string
  parent IDs import as DLC, a re-import repairs safely linkable old entries,
  unresolved parents remain reviewable, and the relevant unit tests pass.

- [x] **Step 11 - Normalize provider searches for imported catalog games** -
  Sanitize punctuation, symbols, accents, and trademark marks only in the RAWG
  search query used by catalog enrichment jobs. Keep the imported Steam title
  unchanged in the local library and preserve the existing conservative exact
  normalized-title match rule. *Done when:* an imported title such as
  `LEGO® Marvel™ Super Heroes` queries RAWG as `lego marvel super heroes`,
  matches its equivalent RAWG result, and unit tests pass.

- [x] **Step 12 - Surface unavailable wishlist metadata** -
  Clearly label base-game wishlist entries that do not have a RAWG metadata
  snapshot, so an empty artwork area is not mistaken for an in-progress
  enrichment. Keep inherited DLC metadata unchanged. *Done when:* an
  unenriched base game visibly says that RAWG metadata is not available yet and
  directs the user to Edit for manual matching.

- [x] **Step 13 - Direct Steam MX pricing alongside ITAD offers** -
  Fetch each confirmed Steam app directly from Steam Store for Mexico and save
  the regular price, current price, and store discount as a distinct `Steam
  Store` offer. Keep ITAD offers intact and continue selecting the cheapest
  valid Mexican offer without a source preference. *Done when:* a refresh
  persists a direct MXN Steam offer, shows its regular price and discount even
  when an ITAD offer is selected, and price-refresh tests pass.

## Files / areas

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `UnresolvedDlcSource` enum, `source` column on `UnresolvedSteamDlc`, `WishlistImportReview` model, `WishlistImportIgnore` model |
| `prisma/migrations/` | New migration for schema changes |
| `src/lib/steam-api.ts` | Add `fetchSteamWishlist()` |
| `src/actions/steam-import-wishlist.ts` | New: `importSteamWishlist()` server action |
| `src/actions/wishlist-import-review.ts` | New: review queue server actions |
| `src/lib/steam-flow.ts` | Update `upsertUnresolvedSteamDlc` to accept `source` |
| `src/lib/wishlist-rawg-queue.ts` | New: `autoEnrichWishlistEntries()` |
| `src/app/(app)/wishlist/page.tsx` | Add import button, result panel, review section |
| `src/components/wishlist/ImportSteamWishlistButton.tsx` | New: import button + result panel |
| `src/components/wishlist/WishlistImportReviewSection.tsx` | New: review queue UI |
| `src/components/wishlist/WishlistSyncChip.tsx` | New: header sync chip |
| `src/lib/duplicate-utils.ts` | Reused (no changes) |
| `src/actions/steam-import.ts` | Pass `source: "OWNED_SYNC"` to `upsertUnresolvedSteamDlc` |
| `src/actions/steam-sync.ts` | Pass `source: "OWNED_SYNC"` to `upsertUnresolvedSteamDlc` |

## Data / contracts

### New enum: `UnresolvedDlcSource`

```prisma
enum UnresolvedDlcSource {
  OWNED_SYNC
  WISHLIST_IMPORT
}
```

### Updated model: `UnresolvedSteamDlc`

```prisma
model UnresolvedSteamDlc {
  id             String               @id @default(cuid())
  steamAppId     String               @unique
  name           String
  steamBaseAppId String?
  status         UnresolvedDlcStatus  @default(PENDING)
  source         UnresolvedDlcSource  @default(OWNED_SYNC)
  discardedAt    DateTime?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
}
```

### New model: `WishlistImportReview`

```prisma
model WishlistImportReview {
  id          String                  @id @default(cuid())
  steamAppId  String                  @unique
  name        String
  candidates  Json                    // Array of { gameId, name, type }
  status      WishlistImportReviewStatus @default(OPEN)
  reviewedAt  DateTime?
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  @@index([status])
}

enum WishlistImportReviewStatus {
  OPEN
  LINKED
  IGNORED
}
```

### New model: `WishlistImportIgnore`

```prisma
model WishlistImportIgnore {
  id         String   @id @default(cuid())
  steamAppId String   @unique
  name       String
  createdAt  DateTime @default(now())
}
```

### Import result shape (returned by `importSteamWishlist`)

```typescript
interface WishlistImportResult {
  created: number;
  queuedReviews: number;
  ignored: number;
  enrichment: { enriched: number; skipped: number };
}
```

### Load-bearing contracts

- `WishlistEntry.steamAppId` + `steamAppIdProvenance: STEAM_IMPORT` is the
  identity written by import and by review-link. Later features (10b prices,
  11 compatibility) read this to resolve ITAD and ProtonDB lookups.
- `UnresolvedSteamDlc.source` is load-bearing: the unresolved-DLC queue UI
  (already built) must filter or label by source when both sources coexist.
- `WishlistImportReview.candidates` JSON is read by the review UI; its shape
  `{ gameId: string; name: string; type: "BASE_GAME" | "DLC" }[]` must be
  stable.

## Testing

Vitest is configured. Logic-bearing steps ship tests.

| Step | What to test |
|------|-------------|
| 2 | `fetchSteamWishlist`: happy path (mock Steam Web API and app-details responses), empty wishlist, HTTP error, malformed JSON |
| 3 | `importSteamWishlist`: idempotent re-import, owned-game omission, local-match review creation, DLC with known base, DLC with unknown base, ignored-item skip |
| 4 | Review actions: link (identity written, review resolved), create-as-new (entry created, review resolved), ignore (ignore record created, review resolved), re-resolve idempotency |
| 5 | RAWG auto-enrichment: exact-match persisted, ambiguous/no-match skipped, error swallowed, existing snapshot skipped |

UI steps (6, 7, 8) ride on build + browser evidence.

## Notes for the AI

- **Client vs server:** All import and review logic is server-side (server
  actions). UI components are client where they need state/handlers, server
  where they only render fetched data.
- **Single-user app:** No per-user query scoping needed, but `requireUser()`
  is still required at every server entry point.
- **Reuse `normalizeName`** from `src/lib/duplicate-utils.ts` for local matching.
  Do not reimplement.
- **Reuse `requireSteamFlowContext`** from `src/lib/steam-flow.ts` for Steam
  credentials.
- **Steam wishlist endpoint:** the legacy Store `wishlistdata` URL redirects to
  Steam's main page and must not be used. The importer calls the official Steam
  Web API with the existing API key, then enriches each returned app ID through
  Store `appdetails`. A public Steam profile is still the expected account
  configuration. An empty response is reported as empty/private, while HTTP,
  timeout, and malformed responses are reported as Steam unavailable. Steam
  requests have a bounded timeout.
- **Concurrent imports are safe.** The action is idempotent by Steam App ID
  (skip if already in wishlist, catalog, or ignore queue). Two concurrent runs
  may both create the same review record - the unique constraint on
  `WishlistImportReview.steamAppId` handles this with an upsert or catch.
- **Chunk processing:** Follow the existing pattern from `steam-import.ts`:
  process in chunks of 50 within transactions.
- **`upsertUnresolvedSteamDlc` signature change:** The function currently
  takes `(client, externalId, game)`. Add an optional `source` parameter
  defaulting to `"OWNED_SYNC"` so existing callers don't break.
- **SteamConnection.counts JSON:** Currently stores `{ imported, updated }`
  from owned-game import. Extend to include `lastWishlistImport: { at: string,
  created: number, queuedReviews: number, ignored: number, enriched: number }`
  without breaking existing reads.
- **No em dashes** in generated content per coding standards.

# Feature: 10b-a - Price identity and provenance

**From build-plan:** 10b-a (first sub-feature of 10b, Price enrichment and purchase opportunities)
**Status:** complete

## Goal

Give every wishlist entry an optional, provenance-tracked Steam App ID so the
price pipeline (10b-b) knows exactly which entries have a confirmed store
identity worth refreshing. Three paths feed the same field, each recording how
the identity arrived: automatic confirmation from a future Steam import,
one-click confirmation of a RAWG store-link suggestion, and direct manual
paste of a Steam URL or App ID.

## Design reference

None. This feature adds identity state and small controls to existing wishlist
UI, not a new visual design.

## In scope

- A typed provenance value on `WishlistEntry` for its Steam App ID
  (`STEAM_IMPORT`, `USER`, `RAWG_SUGGESTION`), replacing the unused
  `sourcePreference` string placeholder.
- Manual path: paste a Steam store URL (`store.steampowered.com/app/{id}`)
  or bare App ID on any wishlist entry (base games and DLC wishes);
  parse, preview, confirm.
- RAWG suggestion path: extend the **wishlist** RAWG snapshot payload to
  capture the Steam store link from RAWG game details; surface a
  suggest-and-confirm banner on entries with no confirmed identity;
  one-click confirm writes the App ID with `RAWG_SUGGESTION` provenance;
  dismiss hides the suggestion until the next successful RAWG enrichment.
- Removal path: clear identity from an entry.
- Duplicate protection: two wishlist entries cannot hold the same Steam
  App ID; the error names the conflicting entry.
- Identity display on wishlist entries: confirmed chip with provenance,
  and an explicit "no store identity" state (the identity-required case
  10b-b will report).
- Backfill: existing entries with a `steamAppId` but no provenance become
  `USER`.
- Definition of the `STEAM_IMPORT` provenance value and the write helper so
  10c (Steam wishlist import) auto-confirms without further schema work.

## Out of scope

- Any ITAD work: lookup caching, price fetching, queues, retries, freshness
  (10b-b).
- Offers, historical lows, targets, MX warnings, opportunity badges (10b-c).
- Steam wishlist import itself and its review flows (10c); here we only
  reserve the provenance value it will write.
- Changes to the catalog `MetadataSnapshot` contract; only the wishlist
  snapshot payload extends.
- Live Steam validation of pasted App IDs (format parsing only; a bad ID
  simply yields no prices later, and the seller page stays authoritative).
- Per-entry price refresh buttons (individual refresh is deferred globally).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Provenance schema and backfill** - add `PriceIdentityProvenance`
  enum (`STEAM_IMPORT`, `USER`, `RAWG_SUGGESTION`) and a nullable
  `steamAppIdProvenance` column on `WishlistEntry`; drop the unused
  `sourcePreference` string (zero references today); backfill rows with a
  `steamAppId` to `USER`; `pnpm prisma:migrate` with generated client.
  *Done when:* migration applies cleanly, `pnpm typecheck` passes, existing
  wishlist tests still pass, and a row seeded with `steamAppId` reads back
  with `USER` provenance.
- [x] **Step 2 - Steam URL/AppID parser** - pure helper
  `parseSteamAppIdInput(raw: string)` in `src/lib/`: accepts bare digit
  strings, `store.steampowered.com/app/{id}` URLs (with or without scheme,
  query string, trailing slug/path), returns `{ ok: true, appId }` or
  `{ ok: false, reason }`; rejects zero, negative, non-numeric, absurdly long
  input, and URLs for non-app Steam pages.
  *Done when:* unit tests cover valid bare IDs, each accepted URL shape, and
  at least five rejection cases.
- [x] **Step 3 - Identity server actions** - new `src/actions/wishlist-identity.ts`
  with `setWishlistIdentity` (entry id + raw pasted input; parses via Step 2,
  blocks when another wishlist entry already holds the App ID with an error
  naming that entry, writes App ID plus `USER` provenance),
  `removeWishlistIdentity` (clears both columns), and
  `confirmSteamImportIdentity` (internal-style helper writing App ID with
  `STEAM_IMPORT` provenance, exported for 10c). Route the existing
  `createWishlistEntry` / `updateWishlistEntry` `steamAppId` inputs through
  the same parse-and-conflict logic so forms cannot bypass it; entries created
  or updated with an App ID get `USER` provenance.
  *Done when:* contract tests cover confirm, duplicate-block message,
  removal, create/update routing, and Zod rejection of malformed input.
- [x] **Step 4 - Wishlist RAWG snapshot store-link extension** - extend the
  RAWG detail types/fetch to keep the `stores` array already returned by the
  game-details endpoint; detect the Steam store entry (match on the Steam
  store slug); resolve the actual App ID via Steam's public keyless
  `storesearch` endpoint using an exact case-insensitive title match, because
  real RAWG responses leave every `stores[].url` empty (verified live), so
  there is nothing to parse from the URL; add the resolved link to the
  wishlist-only payload builder while the catalog metadata payload shape stays
  byte-for-byte unchanged.
  *Done when:* a test enriches a wish whose RAWG details include a Steam
  store entry and asserts the wishlist payload carries the resolved App ID
  while a catalog-payload test asserts no new keys appear there.
- [x] **Step 5 - Suggestion derivation and confirm/dismiss actions** - a view
  helper that reads an entry plus its snapshot and returns
  `{ suggestion: { steamUrl, steamAppId } | null, dismissed: boolean }`
  (null when identity is already confirmed or the snapshot lacks a Steam
  link; dismissed when the payload records a dismissal newer than the
  suggestion); `confirmRawgSuggestedIdentity` (same duplicate protection as
  Step 3, writes `RAWG_SUGGESTION`) and `dismissRawgIdentitySuggestion`
  (stamps the dismissal inside the snapshot payload, never touching the
  confirmed identity).
  *Done when:* contract tests cover confirm-with-duplicate-block, dismiss
  persistence, and the helper's four outcomes (no identity, confirmed,
  suggestion live, suggestion dismissed).
- [x] **Step 6 - Wishlist identity chip and manual flow** - on each wishlist
  entry card: a confirmed-identity chip showing the App ID and provenance
  badge (steam-import / added by you / from RAWG), a remove control, and an
  "add Steam link" flow that takes the paste input, shows the parsed App ID
  as a preview, and confirms via Step 3.
  *Done when:* in the running app you can paste a URL, see the parsed
  preview, confirm, see the chip with provenance, and remove it; build
  passes and the flow is captured in a screenshot.
- [x] **Step 7 - Suggestion banner and identity-less state** - render the
  Step 5 suggestion as a banner on entries with no confirmed identity:
  one-click Confirm and a Dismiss action; a quiet "no store identity -
  prices unavailable" line for entries with neither identity nor suggestion;
  a re-enriched snapshot cleanly replaces any stale dismissal.
  *Done when:* the banner appears after enriching an identity-less wish,
  Confirm turns it into a RAWG-provenance chip, Dismiss hides it, and
  re-enrichment after dismiss shows the suggestion again; screenshot
  evidence for all three states.
- [x] **Step 8 - Acquisition transfer verification** - confirm acquiring a
  wish still copies `steamAppId` into the new game's availability exactly as
  today, that provenance is intentionally dropped there (catalog
  availability has no provenance concept yet), and no regression exists in
  the acquisition tests; document the deliberate non-write of a Steam
  `ExternalGameId` row as the load-bearing choice 11/12 rely on.
  *Done when:* acquisition contract tests pass unchanged and the decision
  note appears in this spec's Data/contracts section.

## Files / areas

- `prisma/schema.prisma` - enum, column, backfill migration.
- `src/lib/steam-identity.ts` (new) - parser from Step 2.
- `src/lib/wishlist-identity-view.ts` (new) - suggestion derivation.
- `src/actions/wishlist-identity.ts` (new) - Steps 3 and 5 actions.
- `src/actions/wishlist.ts` - route create/update App ID inputs through the
  shared logic.
- `src/lib/rawg-types.ts`, `src/lib/rawg-api.ts`, `src/lib/rawg-enrichment.ts`
  - store capture and wishlist payload extension (Step 4).
- `src/components/wishlist/*` and the wishlist page - Step 6 UI.

## Data / contracts

- `PriceIdentityProvenance` enum: `STEAM_IMPORT`, `USER`, `RAWG_SUGGESTION`.
  **Load-bearing:** 10b-b treats `steamAppId != null && steamAppIdProvenance
  != null` as "refreshable"; 10c writes `STEAM_IMPORT`. Values are final.
- `WishlistEntry.steamAppIdProvenance` is nullable and only ever set together
  with `steamAppId`; clearing one clears both.
- Wishlist snapshot payload gains an additive optional
  `storeLink: { steamUrl: string, steamAppId: string } | null` key. Catalog
  `MetadataSnapshot` payloads never gain it. **Load-bearing:** 10c's
  matcher-free import path and 10b-c's display read the confirmed entry
  columns, never the snapshot suggestion.
- Uniqueness rule: Steam App IDs are unique across wishlist entries
  (enforced in the actions, not a DB constraint, because empty/null must
  repeat freely).
- Acquisition copies `steamAppId` to `GameAvailability` and drops
  provenance; no Steam `ExternalGameId` row is written on acquisition. If a
  later feature needs catalog-side Steam identity, that is a deliberate new
  decision there.

## Testing

Vitest is configured and gated. In-scope logic that ships with tests:

- Parser (Step 2): happy paths and rejection matrix.
- Identity actions (Steps 3 and 5): confirm, duplicate block, removal,
  provenance assignment, dismissal stamping, Zod failures.
- Snapshot extension (Step 4): wishlist payload carries the store link;
  catalog payload shape unchanged.
- Acquisition regression (Step 7): existing suite stays green.

UI (Step 6) rides on the dev-server walkthrough plus build evidence, per the
browser-verification convention.

## Notes for the AI

- Server-only for all Prisma and provider access; actions start with
  `"use server"` and `requireUser()` per `src/lib/auth-guard.ts`.
- Follow the existing `{ success, data, error }` action return shape and Zod
  `.strict()` schemas used throughout `src/actions/wishlist.ts`.
- No em dashes anywhere in code, comments, or docs.
- The RAWG `stores` array arrives from the existing game-details endpoint the
  app already calls; no new RAWG request is needed. Real RAWG responses leave
  `stores[].url` empty, so the Steam-slug store entry is only a trigger: the
  App ID is resolved with Steam's public keyless `storesearch` endpoint
  (exact, case-insensitive title match, `cc=MX`), and a failed or ambiguous
  lookup yields no suggestion rather than a wrong one.
- `confirmSteamImportIdentity` lives in a `"use server"` module, so it is
  HTTP-callable: it must enforce `requireUser()` exactly like the user-facing
  actions.
- Keep the catalog RAWG payload builder untouched; extend only the wishlist
  path so 8x behavior is provably unchanged.
- Provenance is display text, never authorization: every action goes through
  `requireUser()` like every other action.

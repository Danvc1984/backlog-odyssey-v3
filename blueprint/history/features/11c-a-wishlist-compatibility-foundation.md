# Feature: Wishlist compatibility foundation

**From build-plan:** feature 11c-a
**Status:** not started

## Goal

Create provider-derived compatibility storage and a quiet, authenticated
per-entry refresh for eligible wishlist base games. The foundation reuses the
existing ProtonDB, AWAY, and Windows-fallback synthesis rules without reusing
or altering catalog compatibility state.

## In scope

- Add `WishlistCompatibilitySnapshot` and `WishlistEnvironmentCompatibility`,
  each keyed by `wishlistEntryId` and cascading with the wishlist entry.
- Persist ProtonDB and AWAY evidence plus derived Bazzite and Windows statuses
  with the same 180-day freshness window as catalog compatibility.
- Add a server-only wishlist compatibility runner and authenticated Server
  Action for a single entry refresh.
- Permit refresh only for a `BASE_GAME` wishlist entry that has both a Steam App
  ID and its provenance; reject DLC, missing, malformed, or ineligible input.
- Preserve existing wishlist evidence when provider transport, HTTP, malformed,
  or persistence failures occur. The action reports a compact result for a
  later quiet UI caller and never creates catalog jobs, snapshots, environment
  rows, or personal overrides.

## Out of scope

- `/wishlist/[id]`, card navigation, and visible compatibility UI (11c-b and
  11c-c).
- RAWG detail composition and fill-only RAWG control (11c-b and 11c-c).
- Auto-queueing after identity confirmation, retry queues, a global wishlist
  sweep, run records, progress, or completion toasts (11d).
- Any personal compatibility override or reuse of catalog `CompatibilitySnapshot`,
  `EnvironmentCompatibility`, or `EnrichmentJob` records.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the step before code changes.
2. Implement only that step and its predicted unit tests.
3. Show the diff, verify the done-when, and wait for approval.
4. Offer an optional checkpoint only after the relevant checks pass.

## Build steps

- [x] **Step 1 - Add parallel wishlist compatibility persistence** - extend the
  Prisma schema, generate a migration, and regenerate Prisma Client for the two
  wishlist-only evidence models and their `WishlistEntry` relations. *Done when:*
  migration status is in sync; a wishlist entry can own ProtonDB and AWAY rows
  plus one Bazzite and one Windows row, all cascading on entry deletion; no
  catalog compatibility relation changes.
- [x] **Step 2 - Define eligibility and persistence contracts** - add focused
  server-only wishlist compatibility types/helpers that accept only a base-game
  wish with an App ID and provenance, synthesize Bazzite and Windows through the
  existing compatibility synthesis, and represent an unavailable refresh
  without mutating prior evidence. *Done when:* Vitest covers valid eligibility,
  DLC, missing ID, missing provenance, and the no-overwrite failure contract.
- [x] **Step 3 - Run and persist one wishlist compatibility refresh** - add a
  server-only runner that calls the existing ProtonDB and AWAY clients, writes
  only the parallel wishlist snapshots and environment rows atomically, and
  applies a 180-day expiry. *Done when:* mocked-provider tests prove correct
  provider payload/source URLs, derived statuses, atomic target models, normal
  no-evidence persistence, and preservation of previous rows on provider or
  persistence failure.
- [x] **Step 4 - Expose the guarded quiet refresh action** - add the Zod-validated
  Server Action that calls `requireUser()`, rejects bad or ineligible entries,
  and returns the existing `{ success, data, error }` shape for the later detail
  UI without starting queue state. *Done when:* action tests cover auth,
  malformed and missing entries, each eligibility rejection, success, and a
  provider failure that leaves previous evidence intact; `pnpm test` passes.

## Files / areas

- `prisma/schema.prisma` and a new `prisma/migrations/*_wishlist_compatibility/`.
- `src/lib/wishlist-compatibility.ts` and adjacent Vitest coverage.
- `src/actions/wishlist-compatibility.ts` and adjacent Vitest coverage.
- Existing `src/lib/protondb-api.ts`, `src/lib/away-api.ts`, and
  `src/lib/compat-synthesis.ts` are reused, not behaviorally changed unless a
  narrow shared type extraction is necessary.
- `blueprint/build-plan.md` and generated `blueprint/context/project-overview.md`
  record the approved 11c split.

## Data / contracts

- `WishlistCompatibilitySnapshot`: `wishlistEntryId`, provider (`PROTONDB` or
  `ARE_WE_ANTICHEAT_YET`), nullable provider result JSON, source URL, fetched
  time, and expiry. Unique on `[wishlistEntryId, provider]`.
- `WishlistEnvironmentCompatibility`: `wishlistEntryId`, environment
  (`BAZZITE` or `WINDOWS`), synthesized status and source, updated time. Unique
  on `[wishlistEntryId, environment]`.
- Eligibility is load-bearing: `type === BASE_GAME`, non-empty `steamAppId`, and
  non-null `steamAppIdProvenance`. It has no catalog availability, library, ROM,
  or personal-override rule because the record is independently wishlisted.
- A successful provider response with no matching evidence persists a fresh
  null/unknown result. A provider or persistence failure writes nothing and
  preserves the last successful data. This action has no retry or job contract.
- Freshness is exactly 180 days from successful persistence. Later UI reads
  these records only; it must not read catalog compatibility records.

## Testing

- Vitest is required for all new eligibility, persistence, runner, and Server
  Action logic. Mock Prisma, `requireUser`, ProtonDB, and AWAY clients.
- Run focused tests after each logic-bearing step, then `pnpm test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm prisma:migrate`, `pnpm prisma generate`,
  and `git diff --check` before completion.
- No browser claim is expected in this foundation: there is no user-facing
  route yet. `11c-c` will supply live browser evidence for the detail action.

## Notes for the AI

- Server components and server-only modules are the default. Do not add
  `'use client'` in this feature.
- Every Server Action starts with `requireUser()` and validates untrusted input
  using a strict Zod schema. Return `{ success, data, error }` and avoid
  throwing provider details into the UI.
- Keep providers replaceable: never erase successful evidence on failed calls,
  never invent evidence, and retain source attribution.
- Keep the new Prisma models entirely separate from catalog compatibility. A
  bought wish is deleted, so copying or pointing at catalog data would make the
  detail history incorrect.
- Run `pnpm prisma generate` immediately after the migration. Do not create a
  branch, implementation code, checkpoint, commit, merge, or push during this
  planning skill.

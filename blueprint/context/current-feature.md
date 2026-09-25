# Feature: Signal provenance and clean-start contracts

**From build-plan:** feature 38a
**Build attempt:** 1
**Branch:** feature/signal-provenance-and-clean-start-contracts

## Goal

Give subsequent recommendation work trustworthy origins and dates for Play
priority, Wishlist Interest and personal rating, plus explicit data-version
boundaries. Test from an owner-managed clean development database rather than
converting old data or accepting previous exports.

This is data capture and contract work, not the renewed ranking or feedback UI.
The owner explicitly approved discarding previous development information and
exports and will perform the database restart. This spec does not authorize a
reset, wipe, destructive seed, migration-history rewrite or automatic cleanup.

## In scope

- Nullable origin/date metadata alongside the existing numeric personal fields.
- Accurate capture through manual controls, defaults, Steam ingestion and
  wishlist acquisition; preservation through merge, delete/Undo and restore.
- Explicit versions on recommendation runs/events, consistent with the existing
  profile version boundary; reject unsupported semantics rather than guessing.
- One new current-only export version with strict validation and round-trip
  preservation of the new metadata and all existing personal data.
- Focused logic tests and a clean-start verification handoff for the owner.

## Out of scope

- Previous-export conversion, historical inference/backfill, old-run retention
  work, legacy-event reinterpretation and automatic database resets.
- Ranking weights, signal-strength changes, recent-context learning, diversified
  selection, owned-alternative Buy logic and new explanations (38b/38d).
- Stable-run renewal, feedback menus, pauses/exclusions, Undo for those actions
  and removal of current dismissal calibration (38c).
- Optional Taste Setup, removing its ten-game gate, changing its history question,
  completion prompts and total recommendation reset (38d/38e).
- New providers, background jobs, automated browser harness, CI and deployment.
- Changing existing numeric defaults or treating current playtime/start events
  as evidence of enjoyment.

## Build loop

- Config has no workflow or branch overrides. Use the standard `feature/` prefix,
  implement one step at a time and stop for review after each passing step.
  Do not create automatic checkpoint commits; `/complete` owns the final commit.
- Each logic-bearing step ships focused tests and passes `pnpm test` and
  `pnpm typecheck` before review. Final automated gate also includes `pnpm build`.
- No Verify or Browser tests command is declared. Do not invent either or claim
  live behavior from unit tests. Independent review remains manual per config.
- Use normal Prisma migration files, generated client and the documented
  `pnpm prisma:migrate` workflow, not `db push`. Stop if migration tooling asks
  to reset a populated database; only the owner may perform the agreed restart.
  Confirm migration status before committing.

## Build steps

- [ ] **1. Establish the storage, version and export contract together.**
  Add the provenance fields and run/event versions below, with pure typed
  validation helpers and injectable time. Update generated types, relevant
  fixtures and exact catalog-operation snapshot serialization. Introduce export
  version 5 in the same step so newly selected Prisma fields do not break the
  existing strict export/restore contract. Extend date revival and validate
  version/source/date/value combinations before restore writes. Wire explicit
  current versions through run/event writers and profile writer/readers; do not
  change their current recommendation meaning. Validate version boundaries at
  readers and actions before interpreting data. Keep version-1 recommendation
  generation and presentation working, including empty data.
  **Done when:** provenance and version contract tests cover valid, null,
  malformed and unsupported inputs; a v5 document preserves the new fields;
  v4 and other unsupported exports fail without writes; current-version run,
  event and profile tests remain green; `pnpm test` and `pnpm typecheck` pass.

- [ ] **2. Capture intentional manual changes without relabeling defaults.**
  Apply the shared metadata rules to catalog create/detail/star controls and
  wishlist add/edit/star actions. Send only intentional changed fields from
  general edit forms; distinguish an untouched add-form default from a selected
  value. Keep the observed catalog-create Unset behavior, wishlist add default
  3 and existing field ranges. The wishlist edit form's null-to-3 fallback may
  remain, but that automatic fill is a default, not a user preference. Preserve
  timestamps on unrelated saves and repeated identical requests. Keep the
  authenticated actor and timestamps server-derived.
  **Done when:** tests distinguish explicit selection (including 2 or 3) from
  an untouched default, null clearing, same-value retry and unrelated saves;
  denied/invalid/failed actions do not partially write metadata; current form
  pending/error behavior remains intact; `pnpm test` and `pnpm typecheck` pass.

- [ ] **3. Cover ingestion, transfer and catalog-operation lifecycles.**
  Record Steam-created default values with their actual creation time, without
  changing existing values on reimport. Cover wishlist import/review and
  unresolved-DLC resolution paths that actually assign a value, not just the
  main import route. Transfer Wishlist Interest's provenance/date to an acquired
  base game's Play priority; label the existing null-to-3 acquisition fallback
  as a default. Carry source/date with whichever personal value survives a
  merge, and capture explicit custom merge values as manual choices. Preserve
  exact tuples in delete/merge Undo and restore. Keep DLCs without library
  entries. Audit remaining field writers and projections during this step;
  do not assume the main actions are the only mutation paths.
  **Done when:** fixed-clock tests cover initial/repeated import, existing
  manual values, known/unknown transfer, acquisition fallback, selected/custom
  merge values and Undo; failed transactions leave no partial tuples; catalog
  operations retain their overlap and confirmation behavior; `pnpm test` and
  `pnpm typecheck` pass.

- [ ] **4. Prove and document the clean-start boundary.**
  Update the repository's existing export-format documentation and its contract
  tests. Add regression coverage for independent interest/rating metadata,
  supported recommendation versions and complete current-version round trips.
  Document the owner-run fresh-database verification sequence without executing
  a reset. Include initial empty views, manual create/edit, Steam defaults,
  acquisition, merge/Undo, explicit recommendation generation, export and
  empty-schema restore. Any real restore test requires an owner-designated empty
  test database; do not erase current data to manufacture that condition.
  **Done when:** `pnpm typecheck`, `pnpm test` and `pnpm build` pass; migration
  status is recorded against the authorized test environment; the handoff names
  every live scenario still awaiting owner verification. No backward-compatible
  import or destructive reset code has been added.

## Files / areas

Existing paths confirmed in the packet:

- `prisma/schema.prisma`, new `prisma/migrations/` migration, generated client.
- `src/actions/game-detail.ts`, `src/actions/games.ts`,
  `src/actions/wishlist.ts`, `src/actions/steam-import-wishlist.ts`,
  `src/actions/catalog-operations.ts` and their adjacent tests.
- `src/lib/steam-flow.ts`, `src/lib/catalog-operations.ts` and the
  import/review/DLC-resolution callers discovered through their write paths.
- `src/components/games/CreateGameDialog.tsx`, `PersonalFieldsForm.tsx`,
  `LibraryInterestRating.tsx`, `MergeGamesDialog.tsx`;
  `src/components/wishlist/AddWishlistDialog.tsx`, `EditWishlistDialog.tsx`,
  `WishlistInterestRating.tsx`.
- `src/lib/recommendations/events.ts`, `profile.ts`, `run-pipeline.ts`,
  `pipeline-helpers.ts`, `queries.ts`, `types.ts`, and
  `src/actions/recommendations.ts`; relevant adjacent tests.
- `src/lib/export-data.ts`, `export-schema.ts`, `import-restore.ts` and their
  tests, including `export-schema-doc.test.ts`; `src/app/api/export/route.ts`
  and the existing import action retain their entry-point responsibilities.
- New shared pure helper: `src/lib/personal-signal.ts` with adjacent tests.
  Use the existing export-doc test to locate its authoritative document rather
  than creating a competing specification.

## Data / contracts

### Personal signal tuple

Keep `LibraryEntry.interest`, `LibraryEntry.rating` and
`WishlistEntry.interest` as the authoritative values. Add:

| Record | New nullable fields |
| --- | --- |
| LibraryEntry | `interestSource`, `interestRecordedAt`, `ratingSource`, `ratingRecordedAt` |
| WishlistEntry | `interestSource`, `interestRecordedAt` |

Use one Prisma `PersonalSignalSource` enum:

- `USER`: deliberate owner selection through a personal-field control or an
  explicit custom value in merge.
- `STEAM_IMPORT_DEFAULT`: value supplied by Steam ingestion/resolution, not
  evidence that Steam reported the owner's preference.
- `MANUAL_DEFAULT`: untouched form default or automatic null fallback in a
  manual form, not a deliberate preference selection.
- `ACQUISITION_DEFAULT`: existing base-game acquisition fallback when the wish
  has no Interest value.

Dates are nullable Prisma DateTime, serialized as UTC ISO-8601 strings using
`Date.toISOString()`. Record when the value was actually established, not when
an unrelated row was updated or when a game was played/completed. Capture one
server clock value for an atomic mutation; helpers accept `now` for tests.

- Interest is an integer 1-5 or null; rating is an integer 1-10 or null.
- A null value has null source and date. A non-null value either has both source
  and date or both null for unknown provenance. Reject half-populated tuples.
- Ratings allow only USER or unknown provenance, never an ingestion/default
  source. Missing provenance is not inferred from the numeric value, timestamps,
  Game origin or current row ownership.
- Partial input omission means unchanged. Clearing the value clears metadata.
  Unrelated edits and retries of an identical value/source preserve its date.
  A deliberate selection of an existing default value may change its source to
  USER and record that choice; numeric equality alone is not proof of intent.
- General edit forms must not resend untouched fields as explicit choices.
  Creation intent may be a validated boolean accompanying the submitted value;
  never accept arbitrary client sources, dates or actor IDs. The server maps
  the authorized operation to an allowed source and captures the time.
- A transferred or restored value retains its original tuple; acquisition or
  restore time must not make it newly expressed intent. Unknown stays unknown.
  Acquisition without a value keeps the existing fallback 3 and records
  ACQUISITION_DEFAULT at acquisition time.
- Merge selects a value and its metadata as a unit. An explicitly chosen side
  retains that side's tuple; an explicit custom value gets USER/time. Unchanged
  equal values retain the survivor's tuple unless the owner selected a side.
  Confirming a merge is not itself a new rating or priority expression.
- No new signal-history table, uniqueness key or per-user relation is required:
  metadata belongs to the existing uniquely identified entry and changes
  atomically with its value. Restore and Undo preserve it rather than re-stamp.

### Recommendation version boundary

Add `version: Int @default(1)` to RecommendationRun and RecommendationEvent.
Retain the existing RecommendationProfile version and payload version at 1.
Use code-owned constants and write versions explicitly, including profile upsert
updates. A RecommendationItem uses its parent run's version.

Version 1 means the currently shipped recommendation semantics, not that the
38b ranking or 38c feedback redesign has shipped. In particular, current
DISMISSAL and Taste Setup payloads must not be labeled as the new neutral
rotation, persistent exclusion or explicit-completion semantics. Later
sub-features must bump the affected versions when those meanings change.

Validate supported versions before reading a profile, rendering a run or
acting on its items/events. Unsupported derived records are not interpreted as
current: exclude them from learning/presentation, return the existing action
failure shape on mutation, and offer explicit Update for unsupported displayed
results. Do not auto-regenerate or rewrite records on page load. Current-version
empty states and ordinary generation remain functional. This is rejection of
unsupported contracts, not an old-data migration or compatibility adapter.

### Export and restore

Set `EXPORT_VERSION = 5`. Accept exactly v5; reject v4 and every other version
with the existing unsupported/invalid-import feedback before any database writes.
Do not normalize old versions or omit required new keys. Validate tuple ranges,
source/date coherence and exact supported recommendation versions with Zod.
Unknown provenance is explicit null, not an absent field silently filled in.

All current personal fields, IDs, tags, availability, settings and
recommendation-owned data already in the export remain included. New metadata
round-trips losslessly; supported profile row/payload versions must agree.
Dates revive as Date objects for Prisma. Empty-schema-only restore remains
all-or-nothing and queues no provider work. Existing provider-snapshot and
credential exclusions remain unchanged. Current-version export/restore is
supported even though previous versions and development information are not.

### Trust, transactions and UI states

- Single-owner application: reuse `requireUser`/allowed-email enforcement at
  every protected action/route. There is no client-supplied owner or new tenant
  boundary. Read targets through the authorized repository paths before transfer
  or merge; enforce existing base-game/DLC and source restrictions.
- Write value/source/date in one mutation. Keep existing transactions around
  acquisition, merge, Undo and restore. Same-value retries do not refresh dates;
  concurrent saves must not combine one request's value with another's metadata.
- Retain `{ success, data, error }` action results and friendly redacted failures.
  Failed or denied requests leave stored tuples unchanged. Do not disclose raw
  SQL, credentials or uploaded contents in errors.
- Keep labelled controls, associated validation feedback, pending disabling,
  accessible error announcement and existing focus/clearing behavior. Preserve
  unsaved inputs on failure, and update displayed values only after success.
  Render names and messages as text, never user-provided HTML.
- No visual redesign or new provenance dashboard. Keep current empty/loading
  states; unsupported versions produce a recoverable explicit-update state,
  not a crash or silently empty successful action.

## Testing

- Unit/contract tests with fixed clocks for metadata invariants, source selection,
  partial saves, null clearing, retries, unknown evidence, unauthorized/invalid
  requests and transaction failure.
- Ingestion, acquisition, merge and Undo tests must assert metadata as well as
  numbers; reimports must preserve deliberate owner choices.
- Export-schema/data/import tests cover v5 round trips, dates, invalid pairs,
  unsupported sources/versions, profile-version mismatch, empty documents,
  nonempty-schema refusal and rollback. Preserve existing personal-data coverage.
- Recommendation tests prove current-version generation still works and unknown
  semantics are neither scored nor mutated as current data. No new ranking
  quality claim belongs to this feature.
- Final automated commands: `pnpm typecheck`, `pnpm test`, `pnpm build`.
  No declared umbrella Verify or automated browser command exists.
- Owner live verification after their clean restart: create and edit both entry
  types, import and reimport Steam records, acquire a wish, merge/Undo, explicitly
  generate a run, download v5, and restore into a separately empty test schema.
  Confirm persisted dates/values and visible success/error behavior after reload.
  List unrun checks explicitly; `/check` supplies later observable evidence.

## Notes for the AI

- Packet evidence: `3338819` implements the Play priority prerequisite; current
  source has no separate LibraryEntry priority enum. `EXPORT_VERSION` is 4 before
  this feature. Current source does not store the new provenance fields.
- Archive destination is frozen as
  `blueprint/history/features/38a-signal-provenance-and-clean-start-contracts.md`.
  No prior 38a archive identity was found. The archive leaf returned ENOENT,
  parents were ordinary directories, no prior Git use was found, and the branch
  is valid with no conflicting local ref. Build attempt is 1; do not reallocate.
- Config has only the manual independent-review setting. No Verify command was
  available to run. No tests, build, migration, dev server, live verification or
  database reset were run during specification.
- The owner's clean-start decision supersedes earlier suggestions to preserve
  old runs or convert v4 exports. It does not authorize destructive execution.
- Numeric-default drift exists in older plan prose: current catalog creation
  starts Unset after the Play priority fix. Preserve the repository behavior;
  provenance capture must not silently change defaults to match older text.
- Steps 38b-38f remain separate work. Record current semantics honestly; do not
  claim versioning alone completes the parent recommendation renewal.

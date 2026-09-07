# Feature: 19c-a Play environment fit and the no-fallback exclusion

**From build-plan:** feature 19c-a (first half of 19c)
**Status:** complete

## Goal

The play-next engine becomes setup-aware: compatibility contributes factors,
floors, caveats, and exclusions only when the configured setup includes a
Linux device; environment fit derives from the configured devices (not a
hardcoded assumption); and on a Linux setup without a Windows fallback,
fallback-needing evidence hard-excludes a game from all play roles with a
recorded, visible reason - the one sanctioned carve-out from the soft-signal
rule. Personal overrides are honored as the owner's tested reality.

## Design reference

None. Engine and note work; the Today exclusion note reuses existing muted
note styling.

## In scope

- A pure environment-fit module that classifies a candidate's practical
  playability from `OsSetup` plus the existing `CompatEvidenceInput`.
- Gate: compatibility contributes to play recommendations only when
  `linuxTargetsExist(setup)`. All-Windows setups get no compat factors,
  floors, caveats, or exclusions.
- Device-derived environment fit: the rerank/role `envStatus` resolves from
  the game's preferred environment when that device exists, otherwise from
  the Linux evidence row; STEAM_DECK resolves to the LINUX row (one Linux
  evidence layer, no per-device rows).
- Override-aware evidence: `loadCandidates` and `compatEvidenceFor` carry
  `compatOverrideStatus`/`compatOverrideReason` (today they hardcode null),
  so overrides steer floors and exclusions.
- The no-fallback hard exclusion with locked evidence classes (below),
  recorded per run as `{ id, name, reason }` in the run context, and a
  one-line count note in the Today Play Next section.
- Strict Out-of-the-Box READY floor on no-fallback setups: no READY
  candidate, no role (no fallback fill from unknown evidence).
- Caveat labels adapting to the setup: the fallback caveat only recommends
  Windows when a fallback exists; otherwise it states none is configured.

## Out of scope

- 19c-b: buy-engine practical-fit penalty and wishlist discovery, buy
  compat caveats, preferred-environment option restriction across personal
  field surfaces, taste-setup environment restriction, derived-profile
  environment adaptation. Buy behavior is unchanged by this feature.
- Feature 21 cron; any Today layout redesign beyond the exclusion note;
  schema or migration changes; recommendation event kinds.
- Stored run shape changes: existing runs render as persisted; only new runs
  carry the exclusions contract.

## Exclusion evidence classes (locked here)

On a Linux setup with **no Windows fallback** (`deriveWindowsFallbackExists`
false), a candidate is excluded from all play roles exactly when:

1. AWAY anti-cheat is `Denied` or `Broken` and no personal override is set -
   the override expresses the owner's tested reality and wins.
2. Effective Linux status is `REQUIRED` (override or ProtonDB), i.e. not
   playable on Linux.
3. Effective Linux status is `UNKNOWN` **only against the Out-of-the-Box
   READY floor**: unknown evidence never takes Out-of-the-Box on a
   no-fallback setup; it does not exclude the game from Best Fit or Change
   of Pace (soft `compat_unknown` caveat as today).

`FALLBACK_RECOMMENDED` never excludes; it stays a soft caveat whose label
states no fallback is configured. ROM-only games are `compat_na`, never
excluded. With a fallback configured or on all-Windows setups, none of these
exclude - today's caveat behavior continues.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Environment-fit core** - Add pure
  `src/lib/recommendations/environment-fit.ts`:
  `compatContributes(setup)` (delegates to `linuxTargetsExist`),
  `resolvePlayEnvStatus(setup, preferredEnvironment, envRows)` (preferred
  row when the device exists, STEAM_DECK to LINUX row, LINUX row otherwise,
  null when inactive), and
  `classifyPlayPracticality(setup, evidence)` returning
  `{ kind: "PLAYABLE" | "SOFT" | "EXCLUDED"; reason?: { factor, label } }`
  per the locked evidence classes. *Done when:* unit tests cover every
  class against fallback-present, no-fallback, and all-Windows setups,
  override-wins cases, ROM-only, and the unknown-vs-READY-floor edge;
  `pnpm test` and `pnpm typecheck` pass.

- [x] **Step 2 - Override-aware, gated evidence** - `loadCandidates`
  selects `compatOverrideStatus`/`compatOverrideReason`;
  `compatEvidenceFor` maps them into `CompatEvidenceInput`;
  `buildCompatContext` takes the setup gate: empty verdict when
  compatibility is inactive, `compat_fallback` caveat label stating no
  fallback is configured when none exists, unchanged verdicts otherwise.
  *Done when:* tests cover override mapping and gated/adapting verdicts;
  the existing compat-context suite passes with the new signature;
  typecheck green.

- [x] **Step 3 - Play pipeline exclusion and device fit** -
  `runRecommendationPipeline` reads AppSettings inside the transaction;
  excluded candidates never enter the baseline pool, batches, or exposure
  handling and are recorded as `context.play.exclusions` entries
  (`{ id, name, reason }`); `envStatus` for rerank and roles comes from
  `resolvePlayEnvStatus`; on no-fallback setups Out-of-the-Box requires
  READY (role absent without one, no unknown-evidence fallback fill), in
  both tuned and cold-start role assignment.
  *Done when:* pipeline tests prove exclusion recording, pool absence,
  role absence, and device-fit resolution across the three setup shapes;
  existing roles/pipeline suites updated and green.

- [x] **Step 4 - Today exclusion note** - The Today Play Next section reads
  the latest play run's stored exclusions and shows one muted line, e.g.
  "2 games not shown: need Windows, no fallback configured", only when
  exclusions exist; runs without exclusions and all-Windows setups show
  nothing. *Done when:* a walkthrough on a no-fallback Linux setup with an
  anti-cheat-denied owned game shows the note and the game absent from all
  roles and Show another batches; switching the setup to add a fallback and
  regenerating runs removes the note; `pnpm build` passes.

## Files / areas

- `src/lib/recommendations/environment-fit.ts` - new pure module (+ tests).
- `src/lib/recommendations/compat-context.ts` - gate input and label
  adaptation (+ tests).
- `src/lib/recommendations/pipeline-helpers.ts` - override fields in
  `loadCandidates` and `compatEvidenceFor`.
- `src/lib/recommendations/run-pipeline.ts` - setup read, exclusion, device
  fit, context contract.
- `src/lib/recommendations/roles.ts` - strict Out-of-the-Box floor on
  no-fallback setups (+ tests).
- `src/app/(app)/today/page.tsx` and the Today Play Next component -
  exclusion note.

## Data / contracts

- No schema changes.
- **Load-bearing:** `classifyPlayPracticality(setup, evidence)` and its
  `SOFT`/`EXCLUDED` classes - 19c-b reuses the same classification for the
  buy penalty; the reason `factor` vocabulary is shared.
- **Load-bearing run-context contract:** `context.play.exclusions:
  Array<{ id: string; name: string; reason: { factor: string; label: string } }>`
  on new PLAY_NEXT runs. Today's note reads it; later surfaces may too.
- `resolvePlayEnvStatus` rule: preferred row only for configured devices;
  STEAM_DECK reads the LINUX row; LINUX row is the default on Linux setups;
  null when compatibility is inactive.
- `updateOsSetup` already synchronously re-runs the pipeline (19a); the
  pipeline reading AppSettings itself keeps that path intact with no new
  wiring.

## Testing

Vitest is the declared runner: Steps 1-3 are logic-bearing and ship tests in
the same diff (classification matrix, override mapping, gated verdicts,
exclusion recording, role absence, device-fit resolution). Step 4 is UI and
rides on `pnpm build` plus the walkthrough: on the current Linux setup with
no fallback, confirm an AWAY-denied game disappears from Play Next, Show
another, and batches while the note appears; add the Windows fallback in
Settings (confirmation dialog, synchronous re-run), confirm the game can
re-enter with the fallback caveat; switch primary to Windows and confirm no
compat factors or caveats appear on any run item.

## Notes for the AI

- Everything in `environment-fit.ts` stays pure and client-safe; only
  `run-pipeline.ts` and `pipeline-helpers.ts` touch Prisma.
- `runRecommendationPipeline(tx)` receives the transaction from
  `updateOsSetup`; read AppSettings through that `tx`, not a separate
  `prisma` client, so the synchronous re-run stays atomic.
- Exclusion happens before baseline ranking, exposure filtering, and tune -
  excluded games must not consume exposure cooldowns or appear in
  `Show another` batches.
- Do not change buy behavior in this feature; buy items keep their current
  caveat persistence until 19c-b.
- Keep caveat and reason labels factual (no Odyssey voice; 20e owns copy
  sweeps). No em dashes in user-visible copy per coding standards.
- The override fields are nullable; a null override means provider evidence
  stands alone, exactly as today.

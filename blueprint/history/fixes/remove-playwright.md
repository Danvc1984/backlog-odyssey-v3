# Fix: Remove Playwright from project scope

**Type:** Fix
**Status:** complete

## Goal

Uninstall Playwright, delete its config and spec, and remove its references from
the project's own docs. The project no longer keeps an automated E2E runner;
browser verification relies on the owner's live testing against the dev server.

## In scope

- Remove `@playwright/test` dev dependency and the `test:e2e` script from `package.json`
- Delete `playwright.config.ts` and `e2e/`
- Prune the pnpm lockfile (`pnpm install` after removing the dependency)
- Remove Playwright / E2E references from owned docs: `AGENTS.md`, `README.md`, `blueprint/project-plan.md`, `blueprint/context/project-overview.md`, `blueprint/context/coding-standards.md`, `backlog-odyssey-prd.md`
- Rewrite the `coding-standards.md` **Browser Verification** section to describe live manual testing instead of Playwright

## Out of scope

- The generic conditional template skills (`.agents/skills/check|implement|autopilot|tests/SKILL.md`, `blueprint/README.md`) keep their "when Playwright is already installed" phrasing - they are blueprint templates, and the condition is simply never true now.
- Archived history (`blueprint/history/features/*`) is not rewritten.
- The pre-existing inaccurate localhost port in `README.md` (3000 vs 3500) - unrelated.

## Build steps

- [x] **Step 1 - Remove Playwright tooling** - In `package.json`, delete the `"test:e2e": "playwright test"` script and the `"@playwright/test"` devDependency entry. Delete `playwright.config.ts` and `e2e/`. Run `pnpm install` to prune the lockfile. *Done when:* `pnpm typecheck` and `pnpm test` pass and Playwright is no longer a project dependency (the binary remains only as Next 16's optional peer).

- [x] **Step 2 - Remove Playwright / E2E references from docs** - In `AGENTS.md`, drop the `pnpm test:e2e` command line and the "E2E uses Playwright and is not a gate" sentence. In `README.md`, change "Vitest and Playwright for tests" to "Vitest" and remove the E2E-tests command line. In `blueprint/project-plan.md` and `blueprint/context/project-overview.md`, remove Playwright from the tech stack line. In `blueprint/context/coding-standards.md`, replace the Playwright Browser Verification bullet with live-testing guidance. Update the PRD's Playwright / `test:e2e` mentions and remove the `.gitignore` Playwright entries. *Done when:* `grep -ri "playwright\|test:e2e"` over owned project docs matches only the out-of-scope template skills, archived history, and the new 04 archive note.

## Files / areas

- `package.json` - remove script + dependency
- `pnpm-lock.yaml` - pruned by `pnpm install`
- `playwright.config.ts`, `e2e/` - deleted
- `AGENTS.md`, `README.md` - remove E2E command lines
- `.gitignore` - remove playwright report/test-results entries
- `blueprint/project-plan.md`, `blueprint/context/project-overview.md` - tech stack
- `blueprint/context/coding-standards.md` - Browser Verification section
- `backlog-odyssey-prd.md` - remove Playwright mentions

## Data / contracts

- None. No schema, types, or runtime behavior changes. Purely tooling and documentation.

## Testing

- No runtime logic changes. Verified with `pnpm typecheck`, `pnpm test` (29/29), and `pnpm build`, all passing before the work commit.
- Step 2 verified by a repo-wide grep returning only the intentionally-out-of-scope template/archive references.

## Notes for the AI

- Run `pnpm install` (the project's package manager) to update the lockfile, not a manual lockfile edit.
- Live testing replaces E2E: the Browser Verification guidance should point the owner to run `pnpm dev`, drive the browser by hand, and rely on UI confirmation, mirroring how feature 4's UI was verified.
- Do not touch the generic template skills - only the owned project docs listed above.

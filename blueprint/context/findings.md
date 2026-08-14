# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-03 [P2] open - Uncommitted changes to 5 files since last commit

**File:** working tree (AGENTS.md, README.md, .gitignore, blueprint/build-plan.md, blueprint/context/coding-standards.md, blueprint/context/project-overview.md, blueprint/project-plan.md)
**Found:** 2026-08-13 by /audit (scope: full)
**Why it matters:** The `/onboard` and `/overview` outputs were never committed. If the working tree is lost, all blueprint tuning is gone.
**Suggested fix:** Review the diff and commit the onboarded state.
**Resolution:**

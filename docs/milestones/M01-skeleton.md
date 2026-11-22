# M1: Skeleton: packages, protocol, diagnostics, test harness

Create the package structure from the Interpreter Architecture and the test machinery every later milestone relies on.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] `packages/core` (no DOM/React imports), `packages/ui` (React), `apps/web` (Vite + React shell that renders 'Sudocode'); dependencies point apps -> ui -> core
- [ ] `packages/core/src/protocol.ts`: `Runner` interface and every worker message type (run, input, pause, step over/into/out, stop, breakpoints, output, trace rows, fileWrite, diagnostics, done, error)
- [ ] `packages/core/src/diagnostics.ts`: `Span`, `Diagnostic { code, line, column, message, hint, fix?, severity }`
- [ ] `packages/core/src/messages/`: message catalogue (code -> message, hint, fix) seeded from `docs/messages-harvest.md`, with per-language wording support
- [ ] Worker scaffolding: `check-worker.ts` (long-lived) and `run-worker.ts` (fresh per run) with an engine-neutral Runner that does nothing yet
- [ ] Golden test runner: loads `*.expected.json`, validates against `tests/schema/expected.schema.json`, runs programs through the Runner, compares stdout/errors/warnings/files/trace; honours `pending.json` (pending tests must fail; a passing pending test fails the run)
- [ ] `packages/core/tests/scope.json`: spec IDs in scope so far (empty now; each milestone adds its IDs)
- [ ] `pnpm spec:coverage`: reads every ID in `docs/language-spec/*.md`, finds tests whose names start with that ID, prints a table, and exits non-zero if an ID in `scope.json` has no test
- [ ] CI: `spec-coverage` job (report only this milestone) with the table in the job summary
- [ ] Unit tests for protocol types, diagnostics and the golden runner itself (including the pending logic)

## Out of scope
Any language front end.

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M1.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

# M1: Skeleton: packages, protocol, diagnostics, test harness

Create the package structure from the Interpreter Architecture and the test machinery every later milestone relies on.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

Status 23 Nov 2026: done. PRs #11 to #20 squash-merged with CI green (see `docs/review/M1.md`).

## Checklist

- [x] `packages/core` (no DOM/React imports), `packages/ui` (React), `apps/web` (Vite + React shell that renders 'Sudocode'); dependencies point apps -> ui -> core (#17)
- [x] `packages/core/src/protocol.ts`: `Runner` interface and every worker message type (run, input, pause, step over/into/out, stop, breakpoints, output, trace rows, fileWrite, diagnostics, done, error) (#12, #19)
- [x] `packages/core/src/diagnostics.ts`: `Span`, `Diagnostic { code, line, column, message, hint, fix?, severity }` (#12)
- [x] `packages/core/src/messages/`: message catalogue (code -> message, hint, fix) seeded from `docs/messages-harvest.md`, with per-language wording support (#13)
- [x] Worker scaffolding: `check-worker.ts` (long-lived) and `run-worker.ts` (fresh per run) with an engine-neutral Runner that does nothing yet (#14, #19)
- [x] Golden test runner: loads `*.expected.json`, validates against `tests/schema/expected.schema.json`, runs programs through the Runner, compares stdout/errors/warnings/files/trace; honours `pending.json` (pending tests must fail; a passing pending test fails the run) (#15, #18)
- [x] `packages/core/tests/scope.json`: spec IDs in scope so far (empty now; each milestone adds its IDs) (#16)
- [x] `pnpm spec:coverage`: reads every ID in `docs/language-spec/*.md`, finds tests whose names start with that ID, prints a table, and exits non-zero if an ID in `scope.json` has no test (#16, #18)
- [x] CI: `spec-coverage` job (report only this milestone) with the table in the job summary (#16)
- [x] Unit tests for protocol types, diagnostics and the golden runner itself (including the pending logic) (#12, #14, #15, #18, #19)

## Out of scope

Any language front end.

## Definition of done (every milestone)

- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M1.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

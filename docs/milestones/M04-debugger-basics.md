# M4: Input, breakpoints, stepping, variables and the trace table

Interactive input and the first debugger features work in the browser.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist

- [x] Add to `scope.json`: SH-05, SH-06, SH-14, SH-17, EDX-72, EDX-73, EDX-74 (#47 SH-14; #48 SH-05, SH-06, EDX-72-74; #49 SH-17. #48-#51 are open, see below)
- [x] Tests PR first (pending), then code (#47 merged, then #48-#51)
- [x] RECEIVE with typed conversion and errors (EDX-72, SH-06), type required (EDX-73), other devices (EDX-74); console input box (SH-05) (#48 engine; #51 input box with Cancel)
- [x] Breakpoints in the gutter, Run to breakpoint, Step over, Continue, Pause; current-line highlight (#50 engine; #51 gutter, toolbar, highlight)
- [x] Variables panel (changed values highlighted, as in the prototype) (#51)
- [x] Trace table: every assignment and output with line numbers; columns = variables in order of first assignment (SH-17); works in Run mode too (#49 engine; #51 panel)
- [x] Infinite-loop pause after 10 million steps with a continue/stop dialog (SH-14) (#24 engine budget; #47 test; #51 dialog)
- [x] Debugger tests in `tests/debugger/` (scripted sessions: stop line, variables, trace rows); E2E: pause at a breakpoint, see variables, trace table matches (#47 sessions, #50 harness; #51 E2E `apps/web/e2e/debugger.spec.ts`)

**Not merged yet.** #48 (RECEIVE) is red only on a merged M2 test that expects RECEIVE to be "not supported", and I
may not edit merged tests. It waits on question 40 in `docs/review/QUESTIONS.md`; #49, #50 and #51 are stacked on it.

## Out of scope

Step into/out and call stack (M5).

## Definition of done (every milestone)

- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M4.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

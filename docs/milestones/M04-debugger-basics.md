# M4: Input, breakpoints, stepping, variables and the trace table

Interactive input and the first debugger features work in the browser.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] Add to `scope.json`: SH-05, SH-06, SH-14, SH-17, EDX-72, EDX-73, EDX-74
- [ ] Tests PR first (pending), then code
- [ ] RECEIVE with typed conversion and errors (EDX-72, SH-06), type required (EDX-73), other devices (EDX-74); console input box (SH-05)
- [ ] Breakpoints in the gutter, Run to breakpoint, Step over, Continue, Pause; current-line highlight
- [ ] Variables panel (changed values highlighted, as in the prototype)
- [ ] Trace table: every assignment and output with line numbers; columns = variables in order of first assignment (SH-17); works in Run mode too
- [ ] Infinite-loop pause after 10 million steps with a continue/stop dialog (SH-14)
- [ ] Debugger tests in `tests/debugger/` (scripted sessions: stop line, variables, trace rows); E2E: pause at a breakpoint, see variables, trace table matches

## Out of scope
Step into/out and call stack (M5).

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M4.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

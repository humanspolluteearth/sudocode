# M2: Edexcel front end, core IR and runtime: the basics

Edexcel programs with variables, arithmetic, strings, 1D arrays, output, selection and loops run end to end through lexer -> parser -> checker -> IR -> runtime.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] Add to `scope.json`: SH-01 to SH-04, SH-07 to SH-10, SH-15, SH-16, SH-18, EDX-01 to EDX-17, EDX-20 to EDX-23, EDX-25, EDX-26, EDX-30 to EDX-33, EDX-40 to EDX-44, EDX-50 to EDX-58, EDX-70, EDX-71, EDX-90
- [ ] Tests PR first: conformance, golden and error-message tests for every ID above, IDs in `pending.json`; self-merge when CI is green
- [ ] Edexcel lexer with spans and lenient-variant warnings (EDX-05, EDX-07, EDX-44, EDX-58 ...)
- [ ] Edexcel parser: recursive descent + Pratt with the precedence table in `edexcel.md` 2.4 (`&` below `+`, `^` above unary minus, right-associative `^`); panic-mode recovery reporting several errors per run
- [ ] Edexcel checker for the IDs in scope (types from first assignment EDX-12, BOOLEAN conditions EDX-43, `&` on arrays EDX-26, SEND with commas EDX-71, bare `x = 5` EDX-33)
- [ ] Core IR with explicit semantics (`intDivFloor`, `forInclusive`, ...) and Edexcel lowering
- [ ] Runtime: generator-based tree-walker with a **trampolined, explicit call stack** (see `docs/AUDIT.md`, Performance): interpreted calls never nest JavaScript generator frames. A unit test drives a synthetic 1,000-deep call chain through the driver
- [ ] Value model: INTEGER as JS number with the SH-07 overflow error; REAL; STRING; CHARACTER; BOOLEAN; arrays; output formatting per SH-03/SH-04
- [ ] Golden runner wired to the real Edexcel pipeline; harvested Edexcel tests that now pass are removed from `pending.json`
- [ ] `spec-coverage` fails on uncovered in-scope IDs (in the review, ask me to mark it required in the ruleset); `nightly.yml` created with a `report` job (other jobs added later)
- [ ] Code PR(s) remove the IDs from `pending.json`; CI green

## Out of scope
Input, subprograms, files, UI.

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M2.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

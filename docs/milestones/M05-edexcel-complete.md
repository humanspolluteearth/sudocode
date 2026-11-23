# M5: Complete Edexcel, plus step into/out and hardening

Every Edexcel spec row except files is implemented and tested.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist

- [x] Add to `scope.json`: every remaining EDX ID except EDX-80 to EDX-84, plus SH-11 to SH-13 — #53 tests, #54 code (SH-11 stays out: files are out of scope)
- [x] Tests PR(s) first (pending), then code — #53
- [x] Subprograms (EDX-60 to EDX-66, brackets required), recursion to depth 1,000 inside a Web Worker (SH-13, test proves it), arrays by reference (EDX-62), globals (EDX-63, Q-EDX-3 info note) — #54
- [x] 2D arrays (EDX-24), growing arrays (Q-EDX-1, EDX-27), RANDOM with a seedable generator (EDX-91, SH-12) — #54
- [x] Full checker: argument counts (EDX-64), type rules, constants (EDX-17), all LENIENT warnings — #54 (LENIENT warnings: see M5.md gaps)
- [x] Step into / step out and the call stack panel — #55
- [x] Property tests (fast-check: DIV/MOD identity, print/parse round-trip of literals) and a fuzz harness (lexer/parser/checker never throw or hang) with short PR runs and long nightly runs — #56 (home-made `forAll`; fast-check could not be installed, see M5.md)
- [x] Edexcel exam-style corpus: at least 3 programs per topic (selection, loops, arrays, strings, subprograms, searching, sorting, validation), written to the command set; real past-paper programs can be added later by you — #56 (24 programs, plus REPEAT TIMES and STEP in the review-fix PR)
- [x] First Stryker run on `packages/core`; record the score and set the release threshold in `docs/TEST-PLAN.md` — DEFERRED by the owner to M11 ("run Stryker locally before release"); Stryker could not be installed in the sandbox. Not blocking M5.
- [x] Nightly jobs `fuzz`, `property`, `perf` (benchmarks + memory) with budgets — #56 (perf budgets in docs/TEST-PLAN.md)

## Out of scope

Files.

## Definition of done (every milestone)

- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M5.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

# M7: Cambridge 9618 front end

Everything in `cie-9618.md` runs, except pointers and sets (Q-CIE-2).

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist

- [ ] Add to `scope.json`: every CIE ID except CIE-32 and CIE-33 (NOT done: CIE-81 and CIE-10 are not in scope.json, see Q46)
- [x] Tests PR(s) first (pending), then code; split into several tests/code PR pairs if large (e.g. core syntax; types/records/enums; procedures/BYREF; files incl. random files; exceptions; classes; built-ins and DATE) (#67-#81)
- [x] CIE lexer/parser/checker lowering into the SAME core IR and runtime (no second runtime); declarations required (CIE-11), CALL required (CIE-71), floor DIV/MOD (SH-10) (#67-#80)
- [x] Records, enumerated types, CASE OF, all loops, BYREF/BYVAL, text and random files, TRY/EXCEPT (no FINALLY), classes with PRIVATE/PUBLIC and inheritance, DATE and every built-in in 3.13 (#67-#80; CIE-81 open, Q46)
- [ ] CIE highlighting, examples and Quick reference content (port and correct the prototype's Cambridge guide) (NOT done: content and highlighter modules exist (#81) but the UI has no language switch or Quick reference panel)
- [x] Equivalence tests Edexcel <-> CIE; CIE fuzz and property runs; CIE exam-style corpus (at least 3 per topic) (#81)

## Out of scope

Pointers and sets, conversion.

## Definition of done (every milestone)

- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M7.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

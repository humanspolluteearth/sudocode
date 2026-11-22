# M9: Python classes, files and modules

The rest of `python-subset.md`.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] Add to `scope.json`: PY-19, PY-21, PY-40 to PY-44, PY-50, PY-54
- [ ] Tests PR(s) first (CPython-generated expected output), then code
- [ ] Classes: `__init__`, methods, inheritance, `super()`, overriding, `__str__`/`__repr__`, name mangling, `isinstance`, custom exceptions
- [ ] Files with the virtual file system: `open` modes r/w/a, read/readline/readlines/write/writelines/close, iteration, `with`
- [ ] Modules: `math`, `random` (seeded sequence identical to CPython unless `docs/review/QUESTIONS.md` says otherwise), `datetime`, `time` (sleep pauses without freezing)
- [ ] PY-50 additions (`del list[i]`, `writelines`, `round(x, n)`, full `format()` spec) and the PY-54 hint

## Out of scope
Conversion.

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M9.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

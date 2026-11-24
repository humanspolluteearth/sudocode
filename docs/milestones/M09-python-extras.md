# M9: Python classes, files and modules

The rest of `python-subset.md`.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist

- [x] Add to `scope.json`: PY-19, PY-21, PY-40 to PY-44, PY-50, PY-54 (#96, completed with PY-41/42/43/50 in the follow-up PR)
- [x] Tests PR(s) first (CPython-generated expected output), then code (#96, #100; code #97, #98, #99, #101)
- [x] Classes (#97, #101): `__init__`, methods, inheritance, `super()`, overriding, `__str__`/`__repr__`, name mangling, `isinstance`, custom exceptions
- [x] Files with (#98): the virtual file system: `open` modes r/w/a, read/readline/readlines/write/writelines/close, iteration, `with`
- [x] Modules (#99; `PY-42-timedelta-division` #101): `math`, `random` (seeded sequence identical to CPython unless `docs/review/QUESTIONS.md` says otherwise), `datetime`, `time` (sleep pauses without freezing)
- [x] PY-50 additions (#99): (`del list[i]`, `writelines`, `round(x, n)`, full `format()` spec) and the PY-54 hint

## Out of scope

Conversion.

## Definition of done (every milestone)

- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M9.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

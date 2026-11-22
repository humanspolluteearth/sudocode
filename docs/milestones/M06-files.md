# M6: Virtual file system and Edexcel files

Programs can read and write files that live in the project.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] Add to `scope.json`: EDX-80 to EDX-84
- [ ] Tests PR first (pending), then code
- [ ] Virtual file system in core (in-memory, passed into the run worker; writes come back as `fileWrite` messages); persistence in the UI (IndexedDB)
- [ ] Edexcel READ/WRITE per `edexcel.md` 2.9, including the READ type rule (EDX-82) and past-the-end error (EDX-84)
- [ ] Files panel (Advanced mode): list, create, view, edit, delete, import, export
- [ ] File golden tests using the `files` field of `.expected.json`

## Out of scope
CIE files (M7), Python files (M9).

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M6.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

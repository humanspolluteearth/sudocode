# M0: Bootstrap the repo and harvest the prototype

Set up the monorepo tooling and CI stage 1, and turn the prototype's knowledge into test material. No interpreter code yet.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

Status 23 Nov 2026: done. PRs #1 to #7 squash-merged with CI green (see `docs/review/M0.md`).

## Checklist

- [x] Root `package.json` (pnpm workspaces), `pnpm-workspace.yaml`, `tsconfig.base.json` (strict), ESLint (flat config) + Prettier, Vitest at the root, `.nvmrc` (#1)
- [x] `pnpm check` script = lint + typecheck + core tests + `spec:coverage` (a stub that prints 'no tests yet' is fine until M1) (#1)
- [x] lefthook pre-commit: Prettier on staged files only (#1)
- [x] ESLint rule or check: nothing outside `reference/` imports from `reference/`; `reference/` excluded from lint and build (#1)
- [x] `.github/workflows/ci.yml` stage 1 jobs: `lint`, `typecheck`, `test-core` (read-only permissions, concurrency group, pnpm cache, `--frozen-lockfile`) (#1)
- [x] `.github/dependabot.yml` (npm, github-actions; grouped, weekly) (#2)
- [x] release-please: `release-please-config.json`, manifest, `.github/workflows/release-please.yml` (do not create a release) (#2)
- [x] PR title check (Conventional Commits) workflow and a DCO sign-off check (#3)
- [x] `packages/core/tests/harvested/`: every prototype example (25) as a program file + `.expected.json`. Expected answers come from `docs/language-spec/` (pseudocode) or by running CPython (Python), never from the prototype's output. Where the spec makes an example invalid (e.g. a rejected syntax), record the expected error instead (#5)
- [x] `packages/core/tests/harvested/probes/`: the 41 pseudocode probes from `reference/prototype/data/pseudocode-probes.json` as programs + `.expected.json` per the spec (#6)
- [x] `packages/core/tests/pending.json` listing every harvested test ID (nothing runs them yet) (#5, #6)
- [x] `docs/messages-harvest.md`: every error message and hint from the prototype's three interpreters, grouped by language, for the M1 message catalogue (#4)
- [x] `docs/review/QUESTIONS.md` created with the three questions from `docs/AUDIT.md` (starter kit `fd14029` (questions 1-3); questions 4-12 added in #5)

## Out of scope

Interpreter code, UI code, nightly workflow.

## Definition of done (every milestone)

- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M0.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

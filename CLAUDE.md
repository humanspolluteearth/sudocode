# Sudocode

IDE + interpreter + converter for CS students: Edexcel IGCSE (4CP0) pseudocode, Cambridge 9618 pseudocode and
syllabus Python. Users range from kids to teachers. Must run well on 2 GB RAM devices; installs 10-100 MB.
Targets: web (Cloudflare), desktop (Tauri 2), Android. Licence: AGPL-3.0.

## How we work

Claude writes the code and works through milestones unattended (`docs/AUTONOMOUS.md`, `docs/milestones/`);
I review between milestones. So:

- Start every session by reading `docs/PROGRESS.md`, `docs/review/QUESTIONS.md` and the milestone file.
- Plan before code for anything non-trivial. Keep PRs small: one feature or one fix.
- In each PR description, explain the design and name any compiler concept it uses (I'm writing an article,
  "How to build a compiler"). Put a short comment in the code the first time a concept appears.
- IMPORTANT: when running under `/goal`, never stop to ask me. If `docs/` doesn't decide something, pick the option
  most consistent with the spec and decisions and log it in `docs/review/Mxx.md`. If a wrong guess could teach a
  student a wrong rule, leave those tests pending, log a question in `docs/review/QUESTIONS.md`, and move on.
  Skip the "(wait)" checkpoints in skills; record what you would have asked instead.
- Merge your own PRs (`gh pr merge --squash`) only after `gh pr checks` is all green. Never merge red, never loosen
  CI, the ruleset or a test, never touch secrets, never merge the release-please release PR.
- `reference/` is read-only material (the old prototype). Never import from it.

## Stack (decided; don't propose alternatives unless I ask)

- TypeScript (strict) + Vite, React, CodeMirror 6, pnpm workspaces monorepo
- Tauri 2 for desktop; mobile shell (Tauri 2 or Capacitor) still to be trialled
- Python runs on OUR interpreter only (no Pyodide). Keep the Runner interface engine-neutral.
- Tests: Vitest (unit, golden, Browser Mode for UI), Playwright (E2E), fast-check (property), Stryker (mutation)

## Layout

- `packages/core`: lexers, parsers, ASTs, checker, core IR, runtime, debugger, converter. NO DOM, React or browser APIs. Must run in Node.
- `packages/ui`: React IDE (editor, console, debugger panels, settings, Simple/Advanced modes)
- `apps/web`, `apps/desktop`, `apps/mobile`: thin shells only
- `docs/`: DECISIONS.md, language-spec/, TEST-PLAN.md, WORKFLOW.md, PROGRESS.md
- Dependencies point one way: apps -> ui -> core. Never import upward.

## Commands

- `pnpm install` (CI uses `--frozen-lockfile`)
- `pnpm check`: exactly what CI stage 1 runs (lint, typecheck, core tests, spec coverage). Run before saying you're done.
- `pnpm --filter @sudocode/core test -- <pattern>`: one test file while iterating
- `pnpm spec:coverage`: lists approved spec IDs with no test
- `pnpm typecheck` / `pnpm lint` / `pnpm build` / `pnpm dev`

## Interpreter architecture (confirmed; details in @docs/DECISIONS.md)

- Hand-written lexers + recursive descent parsers, Pratt for expressions, panic-mode error recovery.
- Separate front end per language, all lowering to ONE shared core IR whose nodes state language rules explicitly
  (e.g. `intDivFloor`, `forInclusive`), never a generic `div`.
- Runtime: generator-based (`function*`) tree-walker over the IR, in a Web Worker, pausable on any statement
  (breakpoints, step over/into/out, input, Stop). Step budget per SH-14.
- Every token and node carries a `span` (line, column, start, end); lowering copies spans.
- UI talks to the engine only through the `Runner` interface and `packages/core/src/protocol.ts` messages.
- Debugger data sent to the UI is plain JSON (names, values, types). Trace table records every variable (SH-17).
- Errors: `{ code, line, column, message, hint, fix? }` (SH-15). Lenient variants are warnings, never errors (SH-16).
- Pseudocode INTEGER = JS number with overflow error (SH-07); Python int = BigInt.
- Converter v1: Edexcel -> Python and CIE -> Python only, via IR printers.

## Language behaviour

Source of truth: `docs/language-spec/` (shared.md, edexcel.md, cie-9618.md, python-subset.md). Every rule has an ID.
If a behaviour isn't there, STOP and ask me; never fill gaps from memory of the exam boards or general Python.
Python must match CPython 3.12 exactly (PY-01).

## Testing rules (IMPORTANT; full plan in docs/TEST-PLAN.md)

- Core features go tests-first, in TWO PRs: (1) tests + `.expected.json` files from the spec rows, with their IDs
  added to `packages/core/tests/pending.json` so CI expects them to fail; I review and merge. (2) the code, which
  removes those IDs from `pending.json`. Never change merged tests or expected files to make code pass.
- Every test name starts with the spec ID it proves: `it("EDX-54 STEP 0 is a runtime error")`. No ID: start with `MISC`.
- You propose expected answers from the spec; I check every one. Never derive an expected answer by running current code.
  Python expected output comes from CPython 3.12 only.
- List every new or changed `.expected.json` file in the PR description.
- Never delete, skip (`.skip`, `.todo`), weaken or retry a core test to make it pass. If a test looks wrong, stop and explain.
- Bug fixes: failing regression test in `packages/core/tests/regressions/issue-<n>-<slug>` first, shown failing, then fix.
- Don't mock `packages/core` modules in core tests. Only fake input, time, randomness (fixed seed) and the file system.
- Golden tests: `packages/core/tests/golden/<edexcel|cie|python>/<ID>-<name>.<epc|cpc|py>` + `.expected.json`
  (schema: `packages/core/tests/schema/expected.schema.json`). Format and oracles: `docs/TEST-PLAN.md`.
- Product defaults (layout, Simple/Advanced modes): `docs/PRODUCT.md`. Prototype audit: `docs/AUDIT.md`.
- Only a green CI run counts as "tests pass".

## Code style

- No `any`. Discriminated unions for AST/IR nodes (`kind` field); exhaustive `switch` with a `never` check.
- Pure functions in core where possible; no global mutable state.
- Error messages are for students: plain words, point at the student's line, suggest a fix.
- Keep files under ~400 lines; split by concept.

## Git

- Branch per task: `feat/...`, `fix/...`, `tests/...`, `docs/...`. PR titles follow Conventional Commits
  (`feat:`, `fix:`, `tests:`, `docs:`, `chore:`); they become the changelog via release-please.
- Commits signed off for the DCO: `git commit -s`.
- Commit only when I ask. Never force-push. Never commit `.env` files or secrets.

## When compacting

Preserve: the current task and its plan, files modified, test commands used, and any open questions for me.

Run only the tests for the files you changed while working; run pnpm check once before pushing; let CI run E2E, fuzz and nightly suites.

Make `pnpm check` print only failures and a one-line summary (Vitest dot reporter with passed-test output silenced, quiet lint). Keep CI output unchanged.

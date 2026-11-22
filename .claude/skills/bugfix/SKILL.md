---
name: bugfix
description: Fix a bug regression-test-first. Use when the user reports wrong output, a crash or a bad error message.
argument-hint: [bug description or issue number]
disable-model-invocation: true
allowed-tools: Bash(gh issue view *)
---

Fix this bug: $ARGUMENTS

1. If it's an issue number, read it with `gh issue view $0`.
2. Reproduce: write the smallest program that shows the bug. Decide the expected output from `docs/language-spec/`; if the spec is silent, ask me.
3. Add a regression test in `packages/core/tests/regressions/` named `bug-<number-or-slug>`. Run it and show it FAILING.
4. Find the root cause. Explain it to me in 3 to 5 sentences before changing code. Don't patch symptoms.
5. Fix it. Don't modify existing tests.
6. Run the regression test, the related suite, and `pnpm typecheck`. Show the output.
7. Suggest a commit message: `fix(<area>): <what> (fixes #<n>)`.

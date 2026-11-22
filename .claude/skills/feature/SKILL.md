---
name: feature
description: Build one language feature or IDE feature test-first (spec rows, tests PR, then code PR). Use when the user asks to add syntax, a built-in function or an IDE capability.
argument-hint: [feature description]
disable-model-invocation: true
---

Build this feature test-first: $ARGUMENTS

Work in these stages and STOP for my approval at each checkpoint marked (wait).

1. **Understand.** Read the relevant part of `docs/language-spec/` and the code it touches. If the spec doesn't define the behaviour, list the exact questions and (wait).
2. **Spec rows.** List the spec IDs this feature covers (e.g. EDX-52 to EDX-58). If a needed rule is missing, propose a new row with the next free ID for the spec file. (wait)
3. **Test cases.** Propose a table: id, requirement, technique (partition / boundary / negative / error guessing), input, expected output. Flag ambiguities instead of guessing. (wait)
4. **Tests PR.** For `packages/core`: write the approved tests and `.expected.json` files on a `tests/<feature>` branch, add their IDs to `packages/core/tests/pending.json`, show them failing for the right reason, and open a PR titled `tests: ...` listing every expected file. Stop until it is merged. For UI work, tests go in the same PR as the code.
5. **Design.** Explain in under 15 lines how you'll implement it: which pipeline stages change and why, and which compiler concept it uses. (wait)
6. **Implement.** On a `feat/<feature>` branch, make the tests pass without editing any merged test or expected file, then remove their IDs from `pending.json`. Keep the change as small as possible.
7. **Verify.** Run `pnpm check` and show the output. Open the PR with the template filled in; done means CI is green.
8. **Explain.** In the PR description, summarise in 5 bullets what changed and which compiler concept it uses (for my article).

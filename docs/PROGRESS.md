# Progress log

Newest entry first. Updated at the end of each milestone (and each session).

## 23 Nov 2026: M0 merged

- PRs #1 to #7 squash-merged with CI green, after you added the `workflow` scope and pushed the workflow commits.
  Stacked branches were updated by merging `main` in (no force-push).
- `pnpm check` exits 0 on `main` (698 tests; all 66 harvested golden tests pending). Required checks to add:
  `lint`, `typecheck`, `test-core`, `pr-title`, `dco`.
- Bot PRs left open for you: #9 release-please `1.0.0` (never merged by Claude; consider `initial-version` 0.1.0),
  #8 Dependabot TypeScript 7 (breaks typescript-eslint; close or ignore majors).
- Open questions 1-12 in `docs/review/QUESTIONS.md`.
- Next step: answer the questions you can, then start M1 with its line from `docs/milestones/PROMPTS.md`.

## 23 Nov 2026: M0 built; waiting on CI to merge

- Done (PRs #1-#7, all open): monorepo tooling, `pnpm check`, lefthook, the `reference/` import ban, core portability
  lint, CI stage 1, Dependabot, release-please, PR title and DCO checks, `docs/messages-harvest.md` (400 messages),
  66 pending golden tests harvested from the prototype (`packages/core/tests/harvested/`), expected-file schema,
  `scripts/python-oracle.py`.
- State: `pnpm check` exits 0 on the combined branch (698 tests). Nothing merged: GitHub refuses workflow files from
  this token (no `workflow` scope), so CI has never run. Both review agents ran; their MUST FIX items are fixed.
- Environment: pnpm 12 and uv can't reach the network on this machine (no IPv6 route and no IPv4 fallback), so installs
  use `npx pnpm@11.28.13 install`. CPython 3.12 isn't installed; the Python expected files came from 3.14 (Q12).
- Open questions: 1-12 in `docs/review/QUESTIONS.md`. Decisions: `docs/review/M0.md`.
- Next step: run `gh auth refresh -h github.com -s workflow`, push the three local workflow branches (commands in
  `docs/review/M0.md`), then start a session with: "Finish M0: merge the open M0 PRs in order once CI is green, then
  start M1."

## 23 Nov 2026: planning finished

- Language spec approved and split into `docs/language-spec/`. Architecture confirmed. Licence AGPL-3.0.
- Prototype audited (`docs/AUDIT.md`): rewrite to the confirmed architecture, keep the knowledge; runtime needs an
  explicit call stack for 1,000-deep recursion.
- Test plan and CI in `docs/TEST-PLAN.md`; product defaults in `docs/PRODUCT.md`; milestones in `docs/milestones/`.
- Next step: M0 (`docs/milestones/M00-bootstrap.md`).

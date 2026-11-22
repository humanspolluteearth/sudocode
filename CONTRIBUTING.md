# Contributing to Sudocode

Thanks for helping! Sudocode is licensed under the GNU AGPL-3.0 (see `LICENSE`). By contributing, you agree
that your contribution is licensed under the same terms.

## Sign your commits (DCO)
Every commit needs a `Signed-off-by` line certifying the Developer Certificate of Origin
(https://developercertificate.org). Add it automatically with:

    git commit -s -m "fix(edexcel): ..."

## How changes are made
- Language behaviour is defined in `docs/language-spec/`. If your change needs behaviour that isn't there,
  open an issue first so the rule can be agreed.
- Interpreter features are test-first: a `tests:` PR with the tests and expected answers, then a PR with the code.
- Bug reports: include the smallest program that shows the problem, what you expected, and what happened.
- PR titles follow Conventional Commits (`feat:`, `fix:`, `tests:`, `docs:`, `chore:`).
- CI must be green before review.

See `docs/WORKFLOW.md` and `docs/TEST-PLAN.md` for details.

# Contributing to Sudocode

Thank you for wanting to help! There are two ways to help. Pick the one that fits you.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first. In short: be kind.

## Path 1: No coding needed

You can make a real difference without writing any code:

- **Report a bug.** [Open a bug report](https://github.com/humanspolluteearth/sudocode/issues/new?template=bug_report.yml). Say what you did, what you expected, what happened, and add a screenshot or your program.
- **Suggest an idea.** [Open an idea](https://github.com/humanspolluteearth/sudocode/issues/new?template=feature_request.yml).
- **Check the language rules.** If Sudocode runs something differently from your syllabus, use the [language rule question](https://github.com/humanspolluteearth/sudocode/issues/new?template=language_rule_question.yml) form. Please do not paste mark schemes or past-paper text. Describe the rule in your own words.
- **Fix a typo.** Click the pencil icon on any page on GitHub. It makes a small pull request for you.
- **Share Sudocode** with classmates and teachers.

## Path 2: I write code

### Set up

You need [Node.js](https://nodejs.org) 26 or newer, [Git](https://git-scm.com/downloads) and [pnpm](https://pnpm.io) (`npm install --global pnpm` installs it).

```
git clone https://github.com/humanspolluteearth/sudocode.git
cd sudocode
pnpm install
pnpm dev
```

### Check your work

- `pnpm check` runs what CI runs first: lint, types, core tests and spec coverage. Run it before you push.
- `pnpm --filter @sudocode/core test -- <pattern>` runs one test file while you work.
- `pnpm typecheck`, `pnpm lint` and `pnpm build` run on their own.

### Docs screenshots

The pictures in `docs/images/` are made by a script, so they can be remade when the app changes:

```
pnpm --filter @sudocode/web build
pnpm --filter @sudocode/web preview --port 4173 &
node scripts/docs-screenshots.mjs
```

Look at every picture afterwards. It uses Playwright, which is already installed.

### How we work

- **Small pull requests.** One feature or one fix each.
- **Tests first.** For the interpreter, one PR adds the tests and their expected answers (taken from the spec). A second PR adds the code.
- **Never edit expected test files** (`*.expected.json`) or loosen a test to make code pass. If a test looks wrong, open an issue and ask.
- **The spec decides.** Language behaviour lives in [`docs/language-spec/`](docs/language-spec/README.md). If a rule is missing, ask first. Do not guess from memory of the exam boards.
- PR titles follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `tests:`, `docs:`, `chore:`.
- Sign every commit with `git commit -s` (this is the [DCO](https://developercertificate.org), a promise that you may share your work).
- CI must be green before review.

More detail is in [`docs/WORKFLOW.md`](docs/WORKFLOW.md), [`docs/TEST-PLAN.md`](docs/TEST-PLAN.md) and [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md).

### Good first issues

Look for the [good first issue](https://github.com/humanspolluteearth/sudocode/labels/good%20first%20issue) label. Good places to start: wording of an error message, a typo in the docs, a missing example in the Quick reference, or checking a rule against the syllabus. If an issue is unclear, ask a question on it before you start.

## How to ask for help

- Ask in [GitHub Discussions](https://github.com/humanspolluteearth/sudocode/discussions).
- Or comment on the issue you are working on.
- Or email [saysayeem.edu@gmail.com](mailto:saysayeem.edu@gmail.com).

No question is too basic.

## Licence

Sudocode uses the GNU AGPL-3.0 (see [`LICENSE`](LICENSE)). By contributing, you agree that your work is shared under the same licence.

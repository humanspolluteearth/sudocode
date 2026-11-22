# Working with Claude Code on Sudocode

For unattended milestone runs, follow `docs/AUTONOMOUS.md`. This file covers interactive sessions
(one-off fixes, exploring, reviewing).

Claude writes the code. You decide, review and verify. Your leverage is in three places: the spec
(`docs/language-spec/`), the expected answers in tests, and PR review.

## Before the first session (once)
1. Finish `docs/SETUP.md` (repo, ruleset, Cloudflare account later).
2. Give Claude the existing interpreter's code for the milestone 0 audit.
3. Approve the test plan and CI outline; Claude turns it into `docs/TEST-PLAN.md` and `.github/workflows/`.

## The session loop

Every session = one task, one branch, one PR, one clear finish line.

```
1. Start     git switch -c <type>/<task>   ->   claude   ->   "Read docs/PROGRESS.md and continue from the next step"
2. Plan      Plan mode (Shift+Tab). Claude reads the spec rows and code, then proposes a plan. Edit it (Ctrl+G).
3. Build     /feature <task>  or  /bugfix <issue>   (both stop for your approval at checkpoints)
4. Verify    `pnpm check` output shown. "Use the test-reviewer agent on the new tests";
             for core changes, "Use the architecture-reviewer agent on the diff".
5. PR        Claude opens the PR with the template filled in. CI must be green.
6. Review    Read the diff and every listed .expected.json. Run the app for UI changes. Squash-merge.
7. Finish    /handoff (updates PROGRESS.md). /clear before the next task.
```

## Core features: the two-PR loop
1. **Tests PR** (`tests/<feature>`): Claude writes tests and `.expected.json` files from the spec rows and lists
   their IDs in `packages/core/tests/pending.json`. The test harness expects pending tests to fail, so CI stays green.
2. You check every expected answer against the spec row it names. Ask for fixes in review; Claude can still edit
   files that aren't on `main` yet. Merge.
3. **Code PR** (`feat/<feature>`): Claude implements, then removes the IDs from `pending.json`. A pending test that
   starts passing fails CI until it's removed, so nothing stays pending by accident. The hook blocks Claude from
   editing any test or expected file already on `main`.
4. Spec coverage report shows the rows as covered.

## Your review checklist for every PR
- Does each expected value match the spec row named in the test? (The PR lists them.)
- Would any test pass even if the code were wrong?
- Is the change in `packages/core` explained in the PR, with the concept named?
- Is the PR small enough to review in 20 minutes? If not, ask for it to be split.

## Rules of thumb
- One task per session. Unrelated question mid-task? Use `/btw` or a new session.
- Corrected Claude twice on the same thing? `/clear`, then restart with a better prompt.
- Spec silent on something? Claude stops and asks; the answer goes into `docs/language-spec/` first, then code.
- Use `/teach <concept>` whenever you want to understand something for your article.

## Build order (v1)
The 12 milestones are in `docs/milestones/` (M0 bootstrap, M1 skeleton, M2 Edexcel basics, M3 editor and console,
M4 input and debugger, M5 complete Edexcel, M6 files, M7 CIE, M8 Python core, M9 Python extras, M10 converter and
IDE completion, M11 desktop, Android and v1). Unattended runs: `docs/AUTONOMOUS.md`. Edexcel <-> CIE conversion
comes after v1.

## Weekly
- Prune CLAUDE.md: delete lines Claude already follows without them; add lines for mistakes it repeated.
- Check the nightly issue, if any, and turn real failures into regression tests.
- Read `docs/PROGRESS.md` and re-plan the next slice.

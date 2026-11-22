# M3: Editor, console and workers: Run and Stop in the browser

A student can type an Edexcel program in the web app, run it in a worker, see output, and stop an infinite loop.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] Read `docs/PRODUCT.md` and `reference/prototype/design/Main.dc.html` first; follow the prototype's desktop layout and themes
- [ ] `packages/ui`: CodeMirror 6 editor (line numbers, Edexcel StreamLanguage highlighting, lint underlines from the check worker, Problems list), console panel, toolbar with Run/Stop, status bar, light/dark theme, zoom
- [ ] Run in a fresh run worker per run; Stop terminates the worker; check worker debounced (~300 ms)
- [ ] Examples menu with the Edexcel examples (from the prototype, rewritten to valid spec syntax)
- [ ] `apps/web/public/_headers` with COOP/COEP; E2E test asserts `self.crossOriginIsolated === true`
- [ ] Vitest Browser Mode component tests (editor, console, toolbar) with axe; Playwright E2E: run a program and see output; Stop ends `WHILE TRUE`; a syntax error shows in Problems
- [ ] CI stage 2: `build-web` with a size budget (set from this first build, recorded in `docs/TEST-PLAN.md`), `test-ui`, `e2e-chromium` (in the review, ask me to mark them required)
- [ ] Cloudflare deploy workflow (Workers static assets via Wrangler): preview per PR and staging on `main`. If the `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets are missing, the job skips with a notice; log it in the review
- [ ] Nightly: `e2e-firefox` and `e2e-webkit`

## Out of scope
Input, debugger, other languages, Simple/Advanced modes.

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M3.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

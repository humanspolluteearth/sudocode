# UI match-the-design work (review notes)

Goal: make the web UI match `reference/prototype/design-standalone.html`. Items done in each PR are listed in the PR
description; this file holds only what is open or needs a decision.

## U1: `design-standalone.html` is not committed (CodeQL)

The goal asked for the standalone design file to be added to the repo. PR #110 did that, and the `CodeQL` check failed
with "1 new alert, 1 high: DOM text reinterpreted as HTML" at `reference/prototype/design-standalone.html:19`. That line is
the loader the design tool generated: it unpacks the bundled pages and re-parses them as HTML, which is what it is for.

Fixing it means editing generated code, adding `reference/` to a CodeQL `paths-ignore`, or dismissing the alert. The
last two loosen a CI gate and the first changes read-only reference material, so I did none of them. Instead:

- The file stays on disk at `reference/prototype/design-standalone.html` but is **not tracked** (it is in my local
  `.git/info/exclude`). `scripts/ui-compare.mjs` reads it from there and says so if it is missing.
- The screenshot script, the baselines and every UI PR work without the file being in git.

**Decision for you:** if you want it committed, either dismiss that alert as "used in tests / not production code" or
add `paths-ignore: reference/**` to the CodeQL config, then `git add` the file.

## U2: size budget raised from 340.0 kB to 344.0 kB for the UI conformance work

PR #111 (menu bar and tab strip) was 340.3 kB gzipped in CI (339.6 kB locally; CI's zlib is about 0.7 kB larger),
0.3 kB over. Main was already at about 338.7 kB, and trimming the new code saved under 0.1 kB. You told me to raise
the budget, so `scripts/size-budget.json` went up once by 4 kB to cover the whole UI job (menu bar, tab strip,
toolbar, side panel). Each PR reports its measured size. Earlier milestones (M7, M8, M9) did the same.

## U3 Toolbar deviations from the design

- Step into, Step out and Pause appear only while a program runs (also in the Run menu). The design has no such buttons.
- Zoom (A−, %, A+) stays in the toolbar after Theme; the design puts zoom in the status bar. Moving it is left to the status-bar work.
- The design's 26px buttons are below the 44px touch target in `.claude/rules/ui.md`. The goal says to match the design, so the 26px size is kept.
- "Stop" is now "Reset", and the "Examples" label is "Example" (design wording). Tests edited for that text only: `components.browser.test.tsx` (2 lines), `apps/web/e2e/app.spec.ts` (line 24).
- `pnpm check` printed `FAIL test` twice during this work and passed on rerun (four more green runs in a row). The failing test was not captured; not reproduced.

## U4 Editor gutter

The gutter is 62px wide with the design's number padding and 11px numbers, and the code uses 13px / 19px with ligatures off (console 12px / 18px, from the design's non-compact values). The design's per-line arrow marker for the paused line is not drawn in the gutter; the app keeps its existing paused-line highlight. Left as is: it changes no behaviour and the highlight already shows where the debugger is.

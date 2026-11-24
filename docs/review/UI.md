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

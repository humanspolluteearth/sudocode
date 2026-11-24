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

## U2: size budget blocks the UI conformance PRs (open question)

PR #111 (menu bar and tab strip) is 340.3 kB gzipped in CI (339.6 kB locally; CI's zlib is about 0.7 kB larger), over
the 340.0 kB budget by 0.3 kB. Main was already at about 338.7 kB, so any new UI chrome goes over. Trimming the new
code (a handler, hover logic) changed the size by less than 0.1 kB. I did not raise `scripts/size-budget.json`
(never loosen CI). Options: (a) raise the budget by about 4 kB, as the M7, M8 and M9 PRs did; (b) find savings
outside the UI, such as lazy-loading the guides and examples out of the first-load chunk. PR #111 stays red until
you choose. The later PRs (toolbar, editor, side panel, defaults) will add more, so they are on hold too.

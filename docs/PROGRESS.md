# Progress log

Newest entry first. Updated at the end of each milestone (and each session).

## 25 Nov 2026: M9 (Python classes, files, modules) complete

- **PRs (all squash-merged, CI green):** #96 to #101 as before; closing pass #103 to #108: Q57 answer, PY-54 notes on the two PY-19 goldens, negative goldens (PY-21/22/44), four bug fixes they exposed, `vfs.ts` split, clock-injected tests.
- **State:** checklist ticked. Both reviewers re-ran: no MUST FIX. Deferred SHOULD FIX items are listed in `docs/review/M9.md`.
- **Needs you:** check the new `.expected.json` files from #105; the deferred list; the PY-42 and PY-43 clock goldens you chose to keep.
- **Next step:** M10 (not started).

## 24 Nov 2026: M8 (Python) complete

- **PRs:** #93 tests and CI; #94 front end, runtime, UI, equivalence tests, budget raised to 330 kB. Both squash-merged with CI green.
- **State:** checklist ticked. Both reviewers ran; no MUST FIX. SHOULD FIX items (split `parse-expr.ts`, pausable comprehensions and size caps, `never` checks) are in `docs/review/M8.md`.
- **Needs you:** mark `python-sample` required in the ruleset; one authorised merged-test edit (`preferences.browser.test.tsx`).
- **Next step:** M9 (classes, modules, PY-41).

## 24 Nov 2026: M7 (Cambridge 9618) complete

- **PRs:** #67-#81 front end, runtime reuse and corpus; #83 your answers; #84 authorised test edits; #85, #86 CIE-81, CIE-10, ELSE IF, per-dimension 2D bounds; #87 TODAY clock; #88 IR comment; #89 file split; #90 UI language switch, CIE highlighting, examples, Quick reference; plus the review follow-up PR. All squash-merged with CI green. #9 and #22 left alone.
- **State:** checklist ticked in `docs/milestones/M07-cie.md`. Both reviewers ran twice; no unfixed MUST FIX except the merged CIE-10 test with the wrong column (Q52).
- **Needs you:** Q52 (fix the merged CIE-10 test column), Q53 (rename the `field` assign target), and the notes at the end of `docs/review/M7.md` (RAND seed not wired, test gaps).
- **Next step:** M8 (not started).

## 24 Nov 2026: open questions answered

- Q20-31, 34-39 and 41-45 answered and written into the spec (#64); tests for them added, 5 pending until a code PR (#65): EDX-21 empty array, SH-03 large and too-large REAL, blank file line, CHARACTER wording. Still to do by hand: the `notes` in `errors/edexcel/EDX-24-grid-column-outside.expected.json`.

## 24 Nov 2026: M6 files complete (merged)

- **PRs:** #58 refactor (parser and checker split), #59 docs (Stryker moved to M11), #60 tests (pending), #61 core
  VFS plus Edexcel READ/WRITE, #62 Files panel with IndexedDB persistence and a quiet `pnpm check`; all squash-merged
  with CI green. PRs #9 (release) and #22 (TypeScript bump) left alone.
- **State:** both reviewers ran; no MUST FIX. SHOULD FIX fixes are in #62; the rest is listed in `docs/review/M6.md`.
- **Needs you:** check the wording and columns of the new file errors (M6.md), update the stale `notes` in the merged
  `EDX-24-grid-column-outside.expected.json`, and answer question 41 (globals assigned from a subprogram).
- **Next step:** a follow-up tests PR for the file gaps in M6.md (once you approve the expected answers), then M7
  (CIE files).

## 24 Nov 2026: M5 Edexcel complete (merged, with one item blocked)

- **PRs:** #53 tests (pending), #54 subprograms/2D/RANDOM/checker, #55 step into/out and call stack, #56 property, fuzz,
  corpus and nightly jobs, plus the review-fix PR; all merged with CI green.
- **Deferred to M11:** the first Stryker run and release threshold ("run Stryker locally before release"). Stryker
  could not be installed in the sandbox; the owner moved the item to the M11 checklist, so it no longer blocks M5.
- **State:** both reviewers ran; MUST FIX fixed. SHOULD FIX list and decisions in `docs/review/M5.md`.
- **Next step:** M6, after you check the 24 corpus answers, then a follow-up tests PR for the SHOULD FIX gaps.

## 24 Nov 2026: M4 debugger basics (merged)

- **PRs:** #47 tests, #48 RECEIVE, #49 trace table, #50 breakpoints and stepping, #51 debugger UI + E2E; all merged
  with CI green, in that order.
- **Question 40 approved:** RECEIVE removed from the one merged SH-18 not-supported test; nothing else merged was edited.
- **State:** checklist in `docs/milestones/M04-debugger-basics.md` ticked with PR numbers. Both reviewers ran; MUST
  FIX items fixed with new tests (merged tests untouched). Decisions D1-D19 and gaps in `docs/review/M4.md`.
- **Next step:** M5 (call stack, step into/out).

## 23 Nov 2026: M3 editor, console and workers (done)

- **Merged with CI green:** #37 UI, #38 workers, #39 examples, #40 isolation E2E, #41 component tests + app E2E, #42 CI stage 2 (size budget 240 kB), #43 Cloudflare deploy workflow, #44 nightly Firefox/WebKit (manual run green), plus the review-fix PR.
- **State:** `pnpm check` exits 0 on main. Both reviewers ran; every MUST FIX fixed, SHOULD FIX list in `docs/review/M3.md`.
- **Needs you:** add the Cloudflare secrets (deploy skips until then); mark `build-web`, `test-ui`, `e2e-chromium` required.
- **Next step:** M4 (input and debugger).

## 23 Nov 2026: M2 Edexcel basics (done)

- M2 checklist ticked with PR numbers (#24-#28 code, #23 tests, #26 nightly); no code changed.
- M2 second review pass (#33): architecture reviewer no MUST FIX; test reviewer 2 MUST FIX (Q30/Q31 unit tests renamed MISC), fixed. SHOULD FIX items are in `docs/review/M2.md`.

- **Merged with CI green:**
  - #21: your answers 14-19.
  - #23: 194 conformance, error-wording and golden programs, reviewed before merge.
  - #24: core IR and a trampolined, generator-based runtime.
  - #25: lexer.
  - #26: nightly workflow.
  - #27: parser.
  - #28: checker, lowering and Edexcel engine (after your yes on question 32, which changed the harvested check).
  - It works: 214 of 227 Edexcel programs pass, and all 57 in-scope spec IDs have a passing test (62 of 210).
- **State:** CI was green on #28 before it merged. Decisions D1-D26 and questions 20-32 are in `docs/review/M2.md` and `QUESTIONS.md`.
- **Environment:**
  - Pushes go over HTTPS with your `gh` login; the SSH key isn't loaded in these sessions.
  - The scratchpad was wiped twice mid-session. The test generator scripts are kept in `.wip-m2-gen/` (untracked), and can be deleted.
- **Next step:**
  1. Answer 20-31, and add `spec-coverage` to the required checks.
  2. Close #10.

## 23 Nov 2026: M1 skeleton merged

- Done (PRs #11-#20, all merged with CI green): your answers Q1/Q4/Q5/Q9 applied (SH-03 changed; EDX-34, EDX-75,
  CIE-15, CIE-97 added; three harvested expected files corrected), `diagnostics.ts`, `protocol.ts` (Runner and every
  worker message), message catalogue (64 codes, per-language wording), run/check workers around an engine-neutral
  Runner, golden test runner enforcing `pending.json`, `scope.json`, `pnpm spec:coverage` + CI job,
  `packages/ui` + `apps/web` (apps -> ui -> core enforced by lint), review follow-ups.
- State: `pnpm check` exits 0 on `main` (1057 tests). All 66 harvested goldens run through the Runner and fail as
  expected (pending). Spec coverage: 0 of 210 (no language engine yet).
- Decisions and questions: `docs/review/M1.md`. Most urgent: the Q4 conflict between PR #10 and the M1 goal, and
  merging PR #10 so the answers are on `main`.
- Environment (unchanged): installs need `npx pnpm@11.28.13 install` on this machine (pnpm 12 has no IPv4 fallback).
- Next step: answer the M1 questions, then start M2 with its line from `docs/milestones/PROMPTS.md`.

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
- Web UI matches the design (menu bar, tab strip, toolbar, gutter, side panel, Grade checker default); gaps in `docs/review/UI.md`.
- Next step: M0 (`docs/milestones/M00-bootstrap.md`).

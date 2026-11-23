# Test plan and CI pipeline

Agreed 23 Nov 2026. Changes need a note in `docs/DECISIONS.md`.

## 1. What the tests prove

1. Sudocode follows `docs/language-spec/`: every approved row and every changed row.
2. Python behaves exactly like CPython 3.12 for everything supported (PY-01).
3. Nothing that worked before breaks.

Out of scope for v1: desktop/Android UI automation, visual regression, load testing, CIE pointers and sets,
converter directions other than pseudocode -> Python.

## 2. Test types

| Type                       | Where                                                                             | Runs                                     | Pass bar                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                       | `src/**/*.test.ts` beside the code                                                | Every PR                                 | All pass                                                                                                                                                                              |
| Spec conformance           | `packages/core/tests/conformance/`                                                | Every PR                                 | All pass; every approved spec ID covered                                                                                                                                              |
| Golden programs            | `packages/core/tests/golden/<board>/` (`<board>` is `edexcel`, `cie` or `python`) | Every PR                                 | All pass                                                                                                                                                                              |
| Error messages             | `packages/core/tests/errors/` (one program per error code)                        | Every PR                                 | All pass; every error code covered                                                                                                                                                    |
| CPython differential       | `packages/core/tests/differential/`                                               | Sample on PR, all nightly                | stdout and exception type identical to CPython                                                                                                                                        |
| Cross-language equivalence | `packages/core/tests/equivalence/`                                                | Every PR                                 | Same output in every language that supports the program                                                                                                                               |
| Debugger                   | `packages/core/tests/debugger/`                                                   | Every PR (from M4)                       | Paused line, stack, variables, trace match at every stop                                                                                                                              |
| Converter round-trip       | `packages/core/tests/converter/`                                                  | Every PR (from M10)                      | Converted program prints the same in Sudocode Python and CPython                                                                                                                      |
| Exam corpus                | `packages/core/tests/corpus/<board>/`                                             | Every PR                                 | All pass                                                                                                                                                                              |
| Harvested                  | `packages/core/tests/harvested/` (from the prototype)                             | Every PR                                 | Pending until the feature lands, then pass                                                                                                                                            |
| Property + fuzz            | `packages/core/tests/property/`, `fuzz/`                                          | Short on PR, long nightly                | No crash, no hang, invariants hold                                                                                                                                                    |
| Regressions                | `packages/core/tests/regressions/issue-<n>-*`                                     | Every PR                                 | Must fail on `main` before the fix                                                                                                                                                    |
| Mutation (Stryker)         | `packages/core`                                                                   | Release PR                               | Score at or above the threshold set in M5                                                                                                                                             |
| Component (UI)             | `packages/ui/**/*.browser.test.tsx` (Vitest Browser Mode)                         | Every PR (from M3)                       | All pass, axe clean                                                                                                                                                                   |
| E2E                        | `apps/web/e2e/` (Playwright)                                                      | Chromium on PR; Firefox + WebKit nightly | All pass, max 2 retries                                                                                                                                                               |
| Size budgets               | `scripts/size-budget.ts`                                                          | Every PR                                 | Under budget: all of `apps/web/dist` gzipped, at most 240 kB (`scripts/size-budget.json`). Set from the first M3 build, 219.2 kB, plus about 10%. Raise it only in a PR that says why |

## 3. Where expected answers come from

| Area                                                | Oracle                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Pseudocode                                          | The spec row. Claude writes the expected result; you check it in the milestone review     |
| Python                                              | CPython 3.12 only. Expected output is generated by running CPython, never written by hand |
| Error wording                                       | First version reviewed by you; after that any change fails the test                       |
| Converter                                           | Original program vs converted program                                                     |
| Fuzz/property                                       | Invariants                                                                                |
| The prototype's outputs are never expected answers. |

stdout in golden files is what CPython prints with input piped in: an `input("Name: ")` prompt appears without a
newline and the typed text is not echoed. Pseudocode input prompts follow the same rule.

## 4. Golden file format

`<ID>-<name>.<epc|cpc|py>` + `<ID>-<name>.expected.json`, validated by `tests/schema/expected.schema.json`:

```json
{
  "spec": ["EDX-31", "SH-10"],
  "language": "edexcel",
  "inputs": ["-7", "2"],
  "seed": 1,
  "files": { "Scores.txt": "10\n20\n" },
  "expect": { "stdout": "-4\n1\n", "errors": [], "warnings": [], "files": null, "trace": null }
}
```

An error is `{ "code": "E-RUN-DIV-ZERO", "line": 3, "column": 12 }`; message wording is tested in `tests/errors/`.

## 5. The tests-first loop (core features)

1. Tests PR (`tests/<feature>`): tests + expected files from the spec rows; their IDs go in
   `packages/core/tests/pending.json`, so the harness expects them to fail and CI stays green.
2. Code PR (`feat/<feature>`): implementation; removes the IDs from `pending.json`. A pending test that passes
   fails CI until it is removed. Merged tests and expected files can't be edited (hook).
3. Regression rule: every bug gets a test in `tests/regressions/` that fails on `main` before the fix.

## 6. CI workflows

| File                                                                                                          | Trigger                 | Jobs                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                                                                                                      | PR, push to `main`      | Stage 1 (parallel): `lint`, `typecheck`, `test-core`, `spec-coverage`, `python-sample` (from M8), `regression-proof`. Stage 2 (needs stage 1): `build-web` + size budget, `test-ui` (from M3), `e2e-chromium` (from M3), `preview` deploy (not required, skipped for forks) |
| `nightly.yml`                                                                                                 | 20:00 UTC daily, manual | `python-full`, `fuzz`, `property`, `e2e-firefox`, `e2e-webkit`, `quarantine`, `perf`; opens/updates one `nightly` issue on failure                                                                                                                                          |
| `release-please.yml`                                                                                          | Push to `main`          | Maintains the release PR                                                                                                                                                                                                                                                    |
| `release.yml`                                                                                                 | `v*` tag                | Mutation check ran on the release PR; `tauri-action` desktop builds; Android APK; production web deploy                                                                                                                                                                     |
| `dependabot.yml`                                                                                              | Weekly                  | npm, GitHub Actions, cargo; grouped                                                                                                                                                                                                                                         |
| Shared: concurrency group per PR; `permissions: contents: read` by default; `pnpm install --frozen-lockfile`; |
| caches for the pnpm store, Playwright browsers and Rust. PR checks target about 10 minutes.                   |

Web hosting: Cloudflare (Workers with static assets; `apps/web/public/_headers` sets
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`). An E2E test checks
`self.crossOriginIsolated === true`.

## 7. House rules

- Playwright may retry twice in CI; Vitest never retries. Flaky tests get `@quarantine` + an issue (you add the tag).
- Core tests are deterministic: fixed seed (SH-12), fixed "today", virtual files only.
- `pnpm check` = CI stage 1, locally. Lefthook pre-commit runs Prettier on staged files only.
- Only a green CI run counts as passing.

## 8. When things get switched on

| Milestone | Tests                                                                            | CI                                                           |
| --------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| M0        | Vitest; harvested tests from the prototype (pending)                             | `ci.yml` stage 1, Dependabot, release-please, lefthook       |
| M1        | Protocol/diagnostics unit tests; golden runner; schema; traceability             | `spec-coverage` (report)                                     |
| M2        | Edexcel conformance/golden/error tests for basics; 1,000-deep recursion test     | `spec-coverage` required; `nightly.yml`                      |
| M3        | Component tests + axe; first E2E journeys; isolation check                       | Stage 2 jobs; preview/staging deploy; nightly Firefox/WebKit |
| M4        | Debugger tests; E2E breakpoint journey                                           | -                                                            |
| M5        | All EDX rows; resource tests; property + fuzz; Edexcel corpus; first Stryker run | Nightly fuzz/property/perf                                   |
| M6        | File golden tests                                                                | -                                                            |
| M7        | CIE conformance/golden/error; CIE fuzz; CIE corpus; equivalence                  | -                                                            |
| M8        | CPython differential                                                             | `python-sample`, `python-full`                               |
| M9        | Differential for classes, files, modules                                         | -                                                            |
| M10       | Converter round-trip; Simple/Advanced and settings UI tests                      | -                                                            |
| M11       | Desktop/Android build checks; release checklist                                  | `release.yml`; mutation on release PR; production deploy     |

## Performance budgets and nightly jobs (M5)

- `fuzz` and `property` nightly jobs run `tests/property/` with `SUDOCODE_RUNS=20000` (PR runs use the default 300).
- `perf` runs `tests/perf/`: a 200,000-iteration loop must finish in 5 s, and five repeated runs may grow the heap by
  at most 100 MB. The budgets are deliberately loose (about 10x the first measurement) so they catch a regression, not noise.
- Stryker: not run yet. The sandbox had no network, so it could not be installed. No score is recorded and the release
  threshold is NOT set; see docs/review/M5.md.

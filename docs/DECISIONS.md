# Decisions

Lasting decisions and why. Status: DECIDED, OPEN, or REVISIT. Language behaviour lives in `docs/language-spec/`, not here.

## Product
| Decision | Status | Why |
|---|---|---|
| Name: Sudocode (no exam-board names in the product name) | DECIDED (name check pending) | Avoid trademark issues |
| Users: kids to teachers; Simple + Advanced modes; every tool can be disabled | DECIDED | Brief |
| Must run on 2 GB RAM; install 10-100 MB | DECIDED | Brief |
| Languages: Edexcel IGCSE 4CP0 pseudocode, Cambridge 9618 pseudocode, syllabus Python | DECIDED | Brief |
| Licence: AGPL-3.0; contributions under the DCO (`git commit -s`), no CLA | DECIDED 23 Nov 2026 | Keep every copy open, including hosted versions; free forever; contributors welcome |
| Repo public from day one | DECIDED 23 Nov 2026 | Free CI, CodeQL, secret scanning |

## Stack
| Decision | Status | Why |
|---|---|---|
| TypeScript + Vite | DECIDED (non-negotiable) | |
| React + TypeScript | DECIDED | Ecosystem, help available |
| CodeMirror 6 editor | DECIDED | Mobile input, modular extensions, accessibility |
| Tauri 2 desktop | DECIDED | Small installers |
| Mobile shell: Tauri 2 vs Capacitor | OPEN (decide by trial in the platform phase) | |
| pnpm workspaces monorepo | DECIDED | Shared core across web/desktop/mobile |
| Claude writes all code; I review and decide | DECIDED 22 Nov 2026 | |
| Milestones run unattended (auto mode + `/goal`); I review between milestones | DECIDED 23 Nov 2026 | |
| Web hosting: Cloudflare (Workers static assets, `_headers` for COOP/COEP) | DECIDED 23 Nov 2026 | Headers support, free PR previews |

## Python
| Decision | Status | Why |
|---|---|---|
| Custom interpreter only; no Pyodide | DECIDED | Syllabus Python only; other IDEs cover general Python |
| Keep Runner interface engine-neutral; COOP/COEP headers on from day one | DECIDED | Leaves a hybrid option open |
| Match CPython 3.12 for everything supported (PY-01); classes included | DECIDED | Teachers compare against IDLE |

## Interpreter architecture (confirmed as written, 23 Nov 2026)
| Decision | Status |
|---|---|
| Hand-written lexers + recursive descent parsers; Pratt parsing for expressions; panic-mode error recovery | DECIDED |
| Separate front end per language, lowering into one shared, semantics-explicit core IR | DECIDED |
| Generator-based (`function*`) pausable tree-walking runtime over the IR | DECIDED |
| Web Workers: a long-lived check worker; a fresh run worker per run | DECIDED |
| Step budget; infinite-loop pause after 10 million steps (SH-14); recursion limit 1,000 (SH-13) | DECIDED |
| Debugger: breakpoints, step over / into / out, call stack, variable inspector, trace table of every variable | DECIDED |
| Errors: kid-friendly `{ code, line, column, message, hint, fix? }` | DECIDED |
| Lenient syntax variants accepted with warnings, never errors (SH-16) | DECIDED |
| Full pre-run checking (types, names, argument counts) where the language allows | DECIDED |
| Output formatting per language (SH-03, SH-04) | DECIDED |
| Python ints are BigInt; pseudocode INTEGER is a JS number with an overflow error (SH-07) | DECIDED |
| Virtual file system per project (SH-11); DATE type (CIE); seedable random numbers (SH-12) | DECIDED |
| Converter via IR printers, no comment preservation; v1 = Edexcel -> Python and CIE -> Python | DECIDED |
| Build order: 12 milestones M0-M11 in `docs/milestones/` (audit done; Edexcel first; Edexcel <-> CIE conversion after v1) | DECIDED 23 Nov 2026 |
| Runtime keeps interpreted call frames on an explicit (trampolined) stack so 1,000-deep recursion fits (from the audit) | DECIDED 23 Nov 2026 |

## Testing and CI (outline under review; see docs/TEST-PLAN.md once approved)
| Decision | Status |
|---|---|
| Vitest everywhere; golden tests as program + `.expected.json` | DECIDED |
| Core tests first, in their own PR; UI tests alongside code | DECIDED |
| AI proposes every expected answer; I check every one | DECIDED |
| CPython differential: sample on PRs, full nightly | DECIDED |
| Property tests and fuzzing once each front end parses real programs; fuzz nightly | DECIDED |
| Exam corpus: a few programs per topic per board, growing | DECIDED |
| Coverage gate: every approved spec ID has a test; line coverage reported only | DECIDED |
| Mutation testing (Stryker) on the release PR | DECIDED |
| UI: Vitest Browser Mode + axe; E2E Playwright: Chromium on PRs, Firefox/WebKit nightly | DECIDED |
| Desktop/Android: build checks until v1, smoke tests after | DECIDED |
| Size budgets from day one; speed and memory budgets once the runtime exists | DECIDED |
| PR checks about 10 minutes; staged jobs; test every package every time | DECIDED |
| Main branch: PR + green checks, up to date, squash only, preview deploy per PR | DECIDED |
| Releases: release-please; code signing and auto-update after v1 | DECIDED |
| Retries for E2E only + quarantine tag; `pnpm check` + format-on-commit hook (lefthook) | DECIDED |

## Product details (defaults proposed in docs/PRODUCT.md; edit before M3)
- Which tools and panels appear in Simple mode vs Advanced mode (before the UI phase)
- UI layout and visual design (before the UI phase)
- What "Share" and "Publishing" mean (link sharing without a backend?)
- Saving files: IndexedDB on web, real files on desktop; file extension(s)
- Offline / installable web app
- Privacy: no accounts, no tracking (default proposal)
- Reference guide format and authorship
- Supported devices: min Android version, browsers, macOS yes/no

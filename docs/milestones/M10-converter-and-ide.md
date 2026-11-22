# M10: Converter and IDE completion

Convert pseudocode to Python, and finish the IDE described in `docs/PRODUCT.md`.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] Converter via IR printers: Edexcel -> Python and CIE -> Python; untranslatable parts refused with a clear message, never silently changed (reuse ideas from the prototype's converter)
- [ ] Round-trip tests: converted programs run in Sudocode's Python AND in CPython and print the same as the original
- [ ] Simple / Advanced modes and Settings exactly as in `docs/PRODUCT.md`; every feature can be switched off
- [ ] Quick reference guides for all three languages; examples for all three languages; language picker
- [ ] Tablet and mobile layouts with the keyword key bar (from the prototype); save/open with `.epc`, `.cpc`, `.py`
- [ ] Installable, offline-capable web app (service worker) that keeps COOP/COEP working
- [ ] Accessibility pass: keyboard-only use, screen-reader labels, axe clean on every page

## Out of scope
Desktop and Android shells.

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M10.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

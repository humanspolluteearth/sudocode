# M11: Desktop, Android and the v1 release

Ship v1 on web, desktop and Android.

Read first: `CLAUDE.md`, `docs/AUTONOMOUS.md`, `docs/TEST-PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and the spec files for this milestone's IDs.

## Checklist
- [ ] `apps/desktop`: Tauri 2 shell around the web app; real files on disk; installers under 100 MB
- [ ] Android: Tauri 2 mobile shell first; if it fails the size or 2 GB-RAM performance targets, write the findings and a Capacitor comparison in `docs/review/M11.md` for my decision instead of switching
- [ ] `.github/workflows/release.yml`: `tauri-action` builds for Windows, macOS, Linux; Android APK build; production web deploy; mutation check (Stryker) on the release PR (ask me to mark it required)
- [ ] Size budgets for installers and APK enforced in CI
- [ ] `docs/RELEASE-CHECKLIST.md` (manual checks per platform)
- [ ] Nightly green on the latest run; all scope IDs covered; no open `bug` issues labelled high
- [ ] Prepare the v1.0.0 release PR via release-please but DO NOT merge it: I merge it after my review

## Out of scope
Code signing, auto-update (after v1).

## Definition of done (every milestone)
- Every checkbox above is ticked, with the PR number that did it.
- All PRs for the milestone are squash-merged with CI green, and none are left open.
- On an up-to-date `main`, `pnpm check` exits 0.
- The `test-reviewer` and `architecture-reviewer` subagents have reviewed the milestone's diff; every MUST FIX is fixed.
- `docs/review/M11.md` is written (template in `docs/review/README.md`) and `docs/PROGRESS.md` is updated.

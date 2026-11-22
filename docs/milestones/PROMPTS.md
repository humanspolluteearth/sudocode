# Milestone prompts (v1)

Run each in a NEW Claude Code session (`claude`, auto mode), in order. Paste the whole line. Review `docs/review/Mxx.md` before starting the next one.

## M0: Bootstrap the repo and harvest the prototype

```text
/goal Complete milestone M0 exactly as defined in docs/milestones/M00-bootstrap.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M0 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M0 diff and every MUST FIX item is fixed; (5) docs/review/M0.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M0.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M1: Skeleton: packages, protocol, diagnostics, test harness

```text
/goal Complete milestone M1 exactly as defined in docs/milestones/M01-skeleton.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M1 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M1 diff and every MUST FIX item is fixed; (5) docs/review/M1.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M1.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M2: Edexcel front end, core IR and runtime: the basics

```text
/goal Complete milestone M2 exactly as defined in docs/milestones/M02-edexcel-basics.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M2 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M2 diff and every MUST FIX item is fixed; (5) docs/review/M2.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M2.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M3: Editor, console and workers: Run and Stop in the browser

```text
/goal Complete milestone M3 exactly as defined in docs/milestones/M03-editor-console.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M3 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M3 diff and every MUST FIX item is fixed; (5) docs/review/M3.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M3.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M4: Input, breakpoints, stepping, variables and the trace table

```text
/goal Complete milestone M4 exactly as defined in docs/milestones/M04-debugger-basics.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M4 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M4 diff and every MUST FIX item is fixed; (5) docs/review/M4.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M4.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M5: Complete Edexcel, plus step into/out and hardening

```text
/goal Complete milestone M5 exactly as defined in docs/milestones/M05-edexcel-complete.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M5 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M5 diff and every MUST FIX item is fixed; (5) docs/review/M5.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M5.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M6: Virtual file system and Edexcel files

```text
/goal Complete milestone M6 exactly as defined in docs/milestones/M06-files.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M6 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M6 diff and every MUST FIX item is fixed; (5) docs/review/M6.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M6.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M7: Cambridge 9618 front end

```text
/goal Complete milestone M7 exactly as defined in docs/milestones/M07-cie.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M7 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M7 diff and every MUST FIX item is fixed; (5) docs/review/M7.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M7.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M8: Python core

```text
/goal Complete milestone M8 exactly as defined in docs/milestones/M08-python-core.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M8 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M8 diff and every MUST FIX item is fixed; (5) docs/review/M8.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M8.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M9: Python classes, files and modules

```text
/goal Complete milestone M9 exactly as defined in docs/milestones/M09-python-extras.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M9 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M9 diff and every MUST FIX item is fixed; (5) docs/review/M9.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M9.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M10: Converter and IDE completion

```text
/goal Complete milestone M10 exactly as defined in docs/milestones/M10-converter-and-ide.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M10 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M10 diff and every MUST FIX item is fixed; (5) docs/review/M10.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M10.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

## M11: Desktop, Android and the v1 release

```text
/goal Complete milestone M11 exactly as defined in docs/milestones/M11-platforms-and-v1.md, working autonomously under the rules in CLAUDE.md and docs/AUTONOMOUS.md. Done when: (1) every checkbox in that file is ticked with the PR that did it; (2) every PR for M11 is squash-merged with CI green and none are open; (3) on an up-to-date main, `pnpm check` exits 0 and you have shown the output; (4) the test-reviewer and architecture-reviewer subagents have reviewed the M11 diff and every MUST FIX item is fixed; (5) docs/review/M11.md and docs/PROGRESS.md are written. Never edit merged tests or expected files, never skip or weaken a test, never disable or loosen a CI check, never merge a red PR. If something can't be done or needs my decision, log it in docs/review/M11.md, mark the affected tests pending, and finish everything else. Stop after 250 turns.
```

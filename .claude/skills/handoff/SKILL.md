---
name: handoff
description: End-of-session summary written to docs/PROGRESS.md so the next session can start cleanly.
disable-model-invocation: true
---

Update `docs/PROGRESS.md` (add a new dated entry at the top; keep older entries):

- What was done this session (files changed, tests added)
- Current state: what works, what's broken, test status (run `pnpm test` and report the totals)
- Decisions made and why (also add lasting ones to `docs/DECISIONS.md`)
- Open questions for me
- The exact next step, phrased as the prompt I should start the next session with

Keep the entry under 30 lines. Don't commit.

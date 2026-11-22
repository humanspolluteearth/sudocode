# Running milestones unattended

Claude Code works through one milestone per session, on its own, until the milestone's definition of done holds.
You review between milestones. Two Claude Code features make this possible:

- **Auto mode**: a classifier approves routine actions and blocks risky ones, so there are no per-command prompts.
  It is the default starting mode in recent Claude Code versions; check the mode indicator, or start with
  `claude --permission-mode auto`.
- **`/goal <condition>`**: after every turn a separate model checks the condition; Claude keeps working until it
  holds, it judges it impossible, or the turn cap in the condition is reached. Each prompt in
  `docs/milestones/PROMPTS.md` is a `/goal`.

## One-time setup (you)
1. Install: Git, Node LTS + pnpm (`corepack enable`), Python 3.12, GitHub CLI (`gh auth login`), Claude Code,
   Rust (needed from M11). Optional: `/plugin install typescript-lsp@claude-plugins-official`.
2. Create an empty **public** GitHub repo (no README). Then:
   ```bash
   unzip sudocode-starter.zip && cd sudocode-starter
   git init -b main && git add -A && git commit -s -m "chore: starter kit"
   git remote add origin https://github.com/<you>/sudocode.git && git push -u origin main
   ```
3. GitHub settings: ruleset on `main` (require a PR, **0 required approvals** so Claude can merge its own PRs,
   require status checks `lint`, `typecheck`, `test-core` once M0 has created them, require branch up to date,
   squash only, block force pushes); secret scanning + push protection; CodeQL default setup; Actions default
   permissions read-only; allow GitHub Actions to create PRs (release-please needs it).
4. Before M3: add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (free Cloudflare account).
5. Edit `docs/PRODUCT.md` if any default is wrong. Answer what you can in `docs/review/QUESTIONS.md`.

## Each milestone
1. `cd sudocode && git switch main && git pull`
2. `claude` (check the mode indicator shows auto), then paste the milestone's line from `docs/milestones/PROMPTS.md`.
3. Walk away. `/goal` (no argument) shows progress; the GitHub PR list shows the work.
4. When it finishes, read `docs/review/Mxx.md` (20-30 minutes):
   - **Expected answers to check**: skim the listed `.expected.json` files against their spec rows. This is the one
     review only you can do; wrong expected answers are the biggest risk in an unattended build.
   - **Decisions made / Questions**: answer in `docs/review/QUESTIONS.md`. If an answer changes behaviour, the next
     milestone's session fixes it (a merged expected file can only be corrected by you: edit it in a small PR).
   - **Required checks to add**: add them to the ruleset.
   - Open the preview link and try the app for a few minutes.
5. Start the next milestone in a NEW session.

## Rules Claude follows when unattended (also in CLAUDE.md)
- Never wait for you mid-milestone. If the spec or `docs/` doesn't decide something, choose the option most
  consistent with the spec and decisions, log it under "Decisions made", and continue. If a choice could make a
  student learn a wrong rule, don't guess: leave those tests pending, log a question, and move on.
- Two-PR loop for core features; self-merge only when CI is green; never merge red.
- Never edit merged tests or expected files, never skip/weaken tests, never loosen CI or the ruleset, never touch
  secrets, never force-push, never merge the release PR.
- Keep each PR small; run `pnpm check` before every push; use subagents for wide exploration to save context.
- At the end: run the `test-reviewer` and `architecture-reviewer` subagents on the milestone diff, fix MUST FIX items,
  write `docs/review/Mxx.md`, update `docs/PROGRESS.md`.

## If something goes wrong
- **Usage limit reached**: the goal pauses and resumes when the limit resets if the session is left open, or run
  `claude --continue` later; the goal is restored.
- **Goal cleared after an unrecoverable error** (auth, credit, context overflow): fix the cause, then `claude --continue`
  and paste the same prompt again; Claude reads `docs/PROGRESS.md` and the open PRs to pick up.
- **Auto mode keeps blocking an action**: after repeated blocks Claude Code goes back to asking you. Check what was
  blocked (`/permissions`, Recently denied) and either approve it or add a narrow allow rule to `.claude/settings.json`.
- **Going in circles**: `/goal clear`, read the latest PR and review notes, then restart the milestone prompt in a new
  session with one extra sentence describing the problem.

# Setup before the first session

Tick these off once. Commands are for a terminal; on Windows use PowerShell or Git Bash.

## 1. Tools on your machine
- [ ] Git (+ Git Bash on Windows, which Claude Code uses for shell commands)
- [ ] Node.js LTS and pnpm (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- [ ] GitHub CLI: `gh auth login`
- [ ] Claude Code: install from https://code.claude.com/docs, then run `claude` in the repo
- [ ] VS Code + the Claude Code extension (optional, nice for reviewing diffs)
- [ ] Rust toolchain (for Tauri, later): https://tauri.app/start/prerequisites/
- [ ] TypeScript language server (for the plugin below): `npm install -g typescript-language-server typescript`

## 2. Claude Code configuration (already in this repo)
- `CLAUDE.md`: project rules (keep under ~200 lines; prune weekly)
- `.claude/settings.json`: allowed/denied commands and hooks
- `.claude/hooks/`: protects golden/regression tests and secrets; formats edited files with Prettier
- `.claude/rules/`: rules that load only for core, UI or test files
- `.claude/skills/`: `/feature`, `/bugfix`, `/teach` (explain a concept for your article), `/handoff`
- `.claude/agents/`: `test-reviewer`, `architecture-reviewer`
- Run `/context` in a session to confirm CLAUDE.md and rules loaded, and `/hooks` to confirm the hooks.

## 3. Plugins
- [ ] TypeScript code intelligence, so Claude sees type errors right after each edit:
      `/plugin install typescript-lsp@claude-plugins-official`
- [ ] Browse `/plugin` for anything else. Install only what you'll use this month; every plugin adds context.

## 4. MCP servers (in `.mcp.json`, approve them on first run)
- [ ] **Context7**: current library docs (React, CodeMirror 6, Vite, Vitest, Tauri) so Claude doesn't use outdated APIs.
- [ ] **Playwright** (later, when the UI exists): lets Claude open the app, click through it and take screenshots.
- GitHub: use the `gh` CLI rather than an MCP server; it's lighter on context.
- Your design file: if it lives in Claude Design / an artifact, export screenshots into `docs/design/` and reference them with `@`.

## 5. Optional settings
- Name sessions with `/rename` (e.g. `cie-lexer`) so `claude --resume` is easy to navigate.

## 6. First-session checklist
- [ ] Public repo on GitHub with `LICENSE` (AGPL-3.0, included here) and `CONTRIBUTING.md` (DCO)
- [ ] Ruleset on `main`: require PR, required checks, branch up to date, squash merge only, no force pushes
- [ ] Settings > Code security: secret scanning + push protection, CodeQL default setup, Dependabot alerts
- [ ] Settings > Actions: default workflow permissions read-only
- [ ] Install a DCO check (e.g. the DCO GitHub App) so unsigned commits are flagged
- [ ] Free Cloudflare account (the API token and `production` environment can wait until milestone 3)
- [ ] `pnpm install` works; `pnpm check` passes; CI stage 1 runs on every PR
- [ ] Audit done (`docs/AUDIT.md`); the prototype is in `reference/prototype/`
- [ ] First milestone: follow `docs/AUTONOMOUS.md` and paste the M0 line from `docs/milestones/PROMPTS.md`.

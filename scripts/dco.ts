// DCO check: every non-bot commit in a pull request needs a `Signed-off-by:` line matching its author
// (https://developercertificate.org, CONTRIBUTING.md). Run in CI as `node scripts/dco.ts <base-sha> <head-sha>`.
import { execFileSync } from "node:child_process";

export interface Commit {
  sha: string;
  authorName: string;
  authorEmail: string;
  parents: string[];
  message: string;
}

// Bots that cannot sign off. Matched on the exact author email, which a person can't use unless they control
// that account (a name or email merely ending in "[bot]" is not enough).
const BOT_EMAILS = new Set([
  "49699333+dependabot[bot]@users.noreply.github.com",
  "41898282+github-actions[bot]@users.noreply.github.com",
]);
const isBot = (c: Commit): boolean => BOT_EMAILS.has(c.authorEmail.toLowerCase());

/** Returns one plain-language problem per commit that is missing a matching sign-off. */
export function unsignedCommits(commits: readonly Commit[]): string[] {
  return commits
    .filter((c) => c.parents.length < 2 && !isBot(c))
    .filter((c) => {
      const expected = `Signed-off-by: ${c.authorName} <${c.authorEmail}>`.toLowerCase();
      return !c.message.split("\n").some((line) => line.trim().toLowerCase() === expected);
    })
    .map(
      (c) =>
        `${c.sha.slice(0, 7)} by ${c.authorName} <${c.authorEmail}> has no matching "Signed-off-by:" line. ` +
        "Fix it with `git commit --amend -s` (or `git rebase --signoff <base>`).",
    );
}

const FIELD = "\x1f";
const RECORD = "\x1e";

export function parseGitLog(output: string): Commit[] {
  return output
    .split(RECORD)
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.length > 0)
    .map((r) => {
      const [sha = "", authorName = "", authorEmail = "", parents = "", message = ""] = r.split(FIELD);
      return { sha, authorName, authorEmail, parents: parents.split(" ").filter(Boolean), message };
    });
}

if (import.meta.main) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    console.error("usage: node scripts/dco.ts <base-sha> <head-sha>");
    process.exit(2);
  }
  const log = execFileSync(
    "git",
    ["log", `--format=%H${FIELD}%an${FIELD}%ae${FIELD}%P${FIELD}%B${RECORD}`, `${base}..${head}`],
    {
      encoding: "utf8",
    },
  );
  const commits = parseGitLog(log);
  const problems = unsignedCommits(commits);
  for (const p of problems) console.error(`DCO: ${p}`);
  console.log(`DCO: checked ${String(commits.length)} commit(s), ${String(problems.length)} without a sign-off.`);
  process.exit(problems.length === 0 ? 0 : 1);
}

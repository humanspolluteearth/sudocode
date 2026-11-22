import { describe, expect, it } from "vitest";
import { parseGitLog, unsignedCommits, type Commit } from "./dco.ts";

const commit = (over: Partial<Commit>): Commit => ({
  sha: "abcdef1234567890",
  authorName: "Ada Lovelace",
  authorEmail: "ada@example.com",
  parents: ["1111111"],
  message: "feat: thing\n\nSigned-off-by: Ada Lovelace <ada@example.com>\n",
  ...over,
});

describe("MISC DCO sign-off check", () => {
  it("MISC accepts a commit signed off by its author", () => {
    expect(unsignedCommits([commit({})])).toEqual([]);
  });

  it("MISC accepts a sign-off with different letter case in the email", () => {
    expect(unsignedCommits([commit({ message: "x\n\nSigned-off-by: Ada Lovelace <ADA@example.com>" })])).toEqual([]);
  });

  it("MISC rejects a commit with no sign-off", () => {
    const problems = unsignedCommits([commit({ message: "feat: thing\n" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^abcdef1 by Ada Lovelace <ada@example.com> has no matching "Signed-off-by:" line/);
  });

  it("MISC rejects a sign-off by someone other than the author", () => {
    expect(unsignedCommits([commit({ message: "x\n\nSigned-off-by: Bob <bob@example.com>" })])).toHaveLength(1);
  });

  it("MISC rejects a sign-off that is only mentioned inside a sentence", () => {
    const message = "x\n\nPlease add Signed-off-by: Ada Lovelace <ada@example.com> next time";
    expect(unsignedCommits([commit({ message })])).toHaveLength(1);
  });

  it("MISC skips merge commits and bot commits", () => {
    const merge = commit({ parents: ["1111111", "2222222"], message: "Merge branch main" });
    const bot = commit({
      authorName: "dependabot[bot]",
      authorEmail: "49699333+dependabot[bot]@users.noreply.github.com",
      message: "chore: bump",
    });
    expect(unsignedCommits([merge, bot])).toEqual([]);
  });

  it("MISC parses git log records", () => {
    const out =
      "aaa\x1fAda\x1fada@example.com\x1fp1\x1ffeat: one\n\nSigned-off-by: Ada <ada@example.com>\n\x1e\n" +
      "bbb\x1fBob\x1fbob@example.com\x1fp2 p3\x1fMerge\n\x1e\n";
    expect(parseGitLog(out)).toEqual([
      {
        sha: "aaa",
        authorName: "Ada",
        authorEmail: "ada@example.com",
        parents: ["p1"],
        message: "feat: one\n\nSigned-off-by: Ada <ada@example.com>\n",
      },
      { sha: "bbb", authorName: "Bob", authorEmail: "bob@example.com", parents: ["p2", "p3"], message: "Merge\n" },
    ]);
  });
});

// PreToolUse hook: blocks edits that would undermine the test suite or touch secrets.
// Exit code 2 = block; the stderr message is shown to Claude so it can adjust.
// Written in Node (not bash + jq) so it works on Windows, macOS and Linux.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const raw = input?.tool_input?.file_path ?? "";
const filePath = raw.replace(/\\/g, "/");
const projectDir = (process.env.CLAUDE_PROJECT_DIR ?? process.cwd()).replace(/\\/g, "/");
const rel = filePath.startsWith(projectDir) ? filePath.slice(projectDir.length + 1) : filePath;

const block = (why) => {
  process.stderr.write(`Blocked: ${rel}. ${why}\n`);
  process.exit(2);
};

// 1. Secrets and generated files: never edited by Claude.
if (/(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith(".env.example")) {
  block("Environment files may contain secrets. Ask the user to edit them.");
}
if (/(^|\/)pnpm-lock\.yaml$/.test(rel)) {
  block("The lockfile is generated. Run pnpm commands instead of editing it.");
}

// 2. Approved expected answers: files already merged into main can't be changed by Claude.
//    Files that exist only on the current branch (a tests PR still in review) can still be fixed.
//    Expected values must come from the spec, CPython or the user, never from the current code's output.
const protectedTestDirs = [
  "packages/core/tests/golden/",
  "packages/core/tests/conformance/",
  "packages/core/tests/differential/",
  "packages/core/tests/regressions/",
  "packages/core/tests/errors/",
  "packages/core/tests/harvested/",
];

const onMain = (path) => {
  for (const ref of ["origin/main", "main"]) {
    try {
      execFileSync("git", ["cat-file", "-e", `${ref}:${path}`], { cwd: projectDir, stdio: "ignore" });
      return true;
    } catch {
      // not on this ref (or the ref doesn't exist); try the next one
    }
  }
  return false;
};

const gitAvailable = (() => {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: projectDir, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const isProtected = protectedTestDirs.some((dir) => rel.startsWith(dir));
if (isProtected && existsSync(resolve(projectDir, rel))) {
  // Without git we can't tell merged files from new ones, so protect every existing file.
  if (!gitAvailable || onMain(rel)) {
    block(
      "This expected answer or regression test is already merged into main, so it can't be modified. " +
        "If you think it is wrong, stop and explain why to the user instead.",
    );
  }
}

process.exit(0);

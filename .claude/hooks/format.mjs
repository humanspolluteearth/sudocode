// PostToolUse hook: formats the file Claude just edited with Prettier.
// Silent on success; never blocks (formatting problems shouldn't stop work).
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input?.tool_input?.file_path;
if (!filePath || !/\.(ts|tsx|js|mjs|json|css|md|yml|yaml)$/.test(filePath)) process.exit(0);

spawnSync("pnpm", ["exec", "prettier", "--write", "--log-level", "warn", filePath], {
  stdio: "ignore",
  shell: process.platform === "win32",
});
process.exit(0);

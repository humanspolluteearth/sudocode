// Size budget for the web build (docs/TEST-PLAN.md section 2). Sums the gzipped size of every file in
// apps/web/dist and fails if it is over the budget in scripts/size-budget.json. Run after `pnpm build`:
// `node scripts/size-budget.ts [dist-dir]`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** Every file under `dir`, recursively. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

export function gzippedBytes(dir: string): number {
  return files(dir).reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
}

/** Returns a one-line verdict and whether the build is within budget. */
export function judge(bytes: number, budget: number): { ok: boolean; message: string } {
  const kb = (n: number): string => `${(n / 1024).toFixed(1)} kB`;
  return bytes <= budget
    ? { ok: true, message: `Web build is ${kb(bytes)} gzipped, within the ${kb(budget)} budget.` }
    : {
        ok: false,
        message: `Web build is ${kb(bytes)} gzipped, over the ${kb(budget)} budget by ${kb(bytes - budget)}. Trim it, or raise scripts/size-budget.json and say why in the PR.`,
      };
}

if (import.meta.main) {
  const dir = process.argv[2] ?? "apps/web/dist";
  const budget = (JSON.parse(readFileSync("scripts/size-budget.json", "utf8")) as { gzipBytes: number }).gzipBytes;
  const verdict = judge(gzippedBytes(dir), budget);
  console.log(verdict.message);
  if (!verdict.ok) process.exitCode = 1;
}

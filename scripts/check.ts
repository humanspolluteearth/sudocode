// `pnpm check`: the same four steps CI stage 1 runs (lint, typecheck, tests, spec coverage), but quiet. A step
// that passes prints one line; a step that fails prints all of its output. CI runs the steps itself, unchanged.
import { spawnSync } from "node:child_process";

const steps: { name: string; args: string[] }[] = [
  { name: "lint", args: ["exec", "eslint", ".", "--quiet"] },
  { name: "typecheck", args: ["typecheck"] },
  { name: "test", args: ["exec", "vitest", "run", "--reporter=dot", "--silent=passed-only"] },
  { name: "spec:coverage", args: ["spec:coverage"] },
];

const failed: string[] = [];
for (const step of steps) {
  const run = spawnSync("pnpm", step.args, { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  if (run.status === 0) {
    // eslint-disable-next-line no-control-regex
    const all = `${run.stdout}${run.stderr}`.replace(/\u001b\[[0-9;]*m/g, "").split("\n");
    const last = all
      .filter((l) => /Tests\s+\d/.test(l))
      .join(" ")
      .trim();
    console.log(`ok   ${step.name}${step.name === "test" ? `  ${last}` : ""}`);
  } else {
    failed.push(step.name);
    console.log(`FAIL ${step.name}\n${run.stdout}${run.stderr}`);
  }
}
console.log(failed.length === 0 ? "check: all 4 steps passed" : `check: FAILED ${failed.join(", ")}`);
process.exit(failed.length === 0 ? 0 : 1);

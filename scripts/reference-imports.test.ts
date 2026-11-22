import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the ESLint rule that keeps reference/ (the old prototype) out of the product code.
const eslint = new ESLint({ cwd: process.cwd() });

async function referenceErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((m) => m.message.includes("reference/ is read-only"))
    .map((m) => m.ruleId ?? "");
}

describe("MISC reference/ is never imported", () => {
  it.each([
    ['import { PS } from "../../reference/prototype/harness/engines.cjs";', "no-restricted-imports"],
    ['import "../reference/prototype/prototype-main.js";', "no-restricted-imports"],
    ['export { PS } from "../../reference/prototype/harness/engines.cjs";', "no-restricted-imports"],
    ['const m = await import("../../reference/prototype/prototype-main.js");', "no-restricted-syntax"],
    ['const m = require("../../reference/prototype/harness/engines.cjs");', "no-restricted-syntax"],
  ])("MISC flags %s", async (code, rule) => {
    expect(await referenceErrors(code, "scripts/example.js")).toEqual([rule]);
  });

  it("MISC allows names that only contain the word reference", async () => {
    const code = 'import { x } from "./references.js";\nimport { y } from "./reference-guide.js";';
    expect(await referenceErrors(code, "scripts/example.js")).toEqual([]);
  });

  it("MISC does not lint files inside reference/ itself", async () => {
    expect(await eslint.isPathIgnored("reference/prototype/harness/run.cjs")).toBe(true);
  });
});

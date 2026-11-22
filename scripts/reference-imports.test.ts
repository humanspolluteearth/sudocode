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

describe("MISC packages/core source stays portable (Node and Web Worker)", () => {
  // Linted as the real core entry file so the type-aware parser accepts it; only the text is replaced.
  async function ruleIds(code: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath: "packages/core/src/index.ts" });
    return (result?.messages ?? []).map((m) => m.ruleId ?? "").filter((r) => r.startsWith("no-restricted"));
  }

  it.each([
    'import { useState } from "react";\nexport const x = useState;',
    'import { EditorView } from "@codemirror/view";\nexport const x = EditorView;',
    'import { App } from "@sudocode/ui";\nexport const x = App;',
    'import { readFileSync } from "node:fs";\nexport const x = readFileSync;',
  ])("MISC rejects %s", async (code) => {
    expect(await ruleIds(code)).toEqual(["no-restricted-imports"]);
  });

  it.each(["export const w = window.location;", "export const d = document.title;", "export const e = process.env;"])(
    "MISC rejects the global in %s",
    async (code) => {
      expect(await ruleIds(code)).toEqual(["no-restricted-globals"]);
    },
  );

  it("MISC allows relative imports inside core", async () => {
    expect(await ruleIds('import { lex } from "./lexer.ts";\nexport const x = lex;')).toEqual([]);
  });
});

describe("MISC dependencies point apps -> ui -> core", () => {
  async function ruleIds(code: string, filePath: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    return (result?.messages ?? []).map((m) => m.ruleId ?? "").filter((r) => r.startsWith("no-restricted"));
  }
  const core = "packages/core/src/index.ts";
  const ui = "packages/ui/src/index.ts";
  const app = "apps/web/src/main.tsx";

  it.each([
    [core, 'import { App } from "@sudocode/ui";\nexport const x = App;'],
    [core, 'import { x } from "@sudocode/web";\nexport const y = x;'],
    [ui, 'import { x } from "@sudocode/web";\nexport const y = x;'],
    [ui, 'import { x } from "../../../apps/web/src/main.tsx";\nexport const y = x;'],
    [ui, 'import { lex } from "@sudocode/core/src/lexer.ts";\nexport const x = lex;'],
    [ui, 'import { lex } from "../../core/src/lexer.ts";\nexport const x = lex;'],
  ])("MISC %s rejects %s", async (file, code) => {
    expect(await ruleIds(code, file)).toEqual(["no-restricted-imports"]);
  });

  it.each([
    [ui, 'import { LANGUAGES } from "@sudocode/core";\nexport const x = LANGUAGES;'],
    [
      app,
      'import { App } from "@sudocode/ui";\nimport { LANGUAGES } from "@sudocode/core";\nexport const x = [App, LANGUAGES];',
    ],
  ])("MISC %s allows %s", async (file, code) => {
    expect(await ruleIds(code, file)).toEqual([]);
  });
});

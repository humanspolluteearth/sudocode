import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

// Checks the harvested test material itself: every program has a valid expected file, every test is pending,
// and every spec ID and question it cites exists. Nothing runs the programs until the front ends exist (M2+).
const testsDir = join(import.meta.dirname, "..");
const repoDir = join(testsDir, "..", "..", "..");
const harvestedDir = join(testsDir, "harvested");
const languageOf = { epc: "edexcel", cpc: "cie", py: "python" } as const;
type Ext = keyof typeof languageOf;

interface Diagnostic {
  code: string;
  line: number;
  column: number;
}
interface Expected {
  spec: string[];
  language: string;
  expect: { stdout: string; errors: Diagnostic[]; warnings: Diagnostic[]; info?: Diagnostic[] };
  openQuestions?: string[];
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const allFiles = walk(harvestedDir);
const programs = allFiles.filter((f) => /\.(epc|cpc|py)$/.test(f));
const testId = (program: string): string => relative(testsDir, program).replace(/\.(epc|cpc|py)$/, "");
const expectedPath = (program: string): string => program.replace(/\.(epc|cpc|py)$/, ".expected.json");
const readExpected = (program: string): Expected => JSON.parse(readFileSync(expectedPath(program), "utf8")) as Expected;

const schema = JSON.parse(readFileSync(join(testsDir, "schema", "expected.schema.json"), "utf8")) as object;
const validate = new Ajv2020({ allErrors: true }).compile(schema);

const specText = readdirSync(join(repoDir, "docs", "language-spec"))
  .map((f) => readFileSync(join(repoDir, "docs", "language-spec", f), "utf8"))
  .join("\n");
const specIdExists = (id: string): boolean => new RegExp(`\\| ${id} \\|`).test(specText);
const questionsText = readFileSync(join(repoDir, "docs", "review", "QUESTIONS.md"), "utf8");
const questionExists = (q: string): boolean => new RegExp(`^${q.slice(1)}\\. `, "m").test(questionsText);

const pending = JSON.parse(readFileSync(join(testsDir, "pending.json"), "utf8")) as { tests: string[] };

const examples = (lang: string): string[] =>
  programs.filter((p) => relative(harvestedDir, p).startsWith(`${lang}/`)).map(testId);

describe("MISC harvested prototype examples", () => {
  it("MISC has all 25 prototype examples: 7 Edexcel, 10 Cambridge, 8 Python", () => {
    expect([examples("edexcel").length, examples("cie").length, examples("python").length]).toEqual([7, 10, 8]);
  });
});

describe.each(programs.map((p) => [testId(p), p] as const))("MISC harvested test %s", (_id, program) => {
  const ext = /\.(epc|cpc|py)$/.exec(program)?.[1] as Ext;

  it("MISC has an expected file that matches the schema", () => {
    expect(existsSync(expectedPath(program))).toBe(true);
    validate(readExpected(program));
    expect(validate.errors ?? []).toEqual([]);
  });

  it("MISC declares the language its extension implies", () => {
    expect(readExpected(program).language).toBe(languageOf[ext]);
  });

  it("MISC is named after one of its spec IDs (or MISC)", () => {
    const name = /[^/]+$/.exec(testId(program))?.[0] ?? "";
    const { spec } = readExpected(program);
    expect(name.startsWith("MISC-") || spec.some((id) => name.startsWith(`${id}-`))).toBe(true);
  });

  it("MISC cites only spec IDs and questions that exist", () => {
    const { spec, openQuestions = [] } = readExpected(program);
    const resolvedQuestion = (id: string): boolean => id.startsWith("Q-") && specText.includes(`| ${id} |`);
    expect(spec.filter((id) => !specIdExists(id) && !resolvedQuestion(id))).toEqual([]);
    expect(openQuestions.filter((q) => !questionExists(q))).toEqual([]);
  });

  it("MISC lists diagnostics in order, at positions inside the program", () => {
    const lines = readFileSync(program, "utf8").split("\n");
    const { errors, warnings, info = [] } = readExpected(program).expect;
    for (const list of [errors, warnings, info]) {
      const sorted = [...list].sort((a, b) => a.line - b.line || a.column - b.column);
      expect(list).toEqual(sorted);
      for (const d of list) {
        expect(d.line).toBeLessThanOrEqual(lines.length);
        expect(d.column).toBeLessThanOrEqual(Array.from(lines[d.line - 1] ?? "").length);
      }
    }
  });

  it("MISC prints nothing when the checker rejects the program", () => {
    const { errors, stdout } = readExpected(program).expect;
    if (errors.some((e) => /^E-(CHK|SYN)-/.test(e.code))) expect(stdout).toBe("");
  });

  it("MISC is pending", () => {
    expect(pending.tests).toContain(testId(program));
  });
});

describe("MISC pending.json", () => {
  it("MISC lists only tests that exist, once each, in sorted order", () => {
    const missing = pending.tests.filter((id) => !programs.some((p) => testId(p) === id));
    expect(missing).toEqual([]);
    expect(pending.tests).toEqual([...new Set(pending.tests)].sort());
  });

  it("MISC every expected file has a program", () => {
    const orphans = allFiles
      .filter((f) => f.endsWith(".expected.json"))
      .filter((f) => !programs.some((p) => expectedPath(p) === f));
    expect(orphans.map((f) => relative(testsDir, f))).toEqual([]);
  });
});

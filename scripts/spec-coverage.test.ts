import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coverage,
  extractSpecRows,
  markdownReport,
  missingInScope,
  namesId,
  unknownScopeIds,
  vitestTitles,
} from "./spec-coverage-lib.ts";

const sample = [
  "# Edexcel",
  "| ID | Rule | Status |",
  "| --- | --- | --- |",
  "| EDX-5 | Something | SOURCE |",
  "| EDX-54 | STEP 0 is a runtime error | SOURCE |",
  "Text mentioning EDX-99 is not a row.",
  "| EDX-100 | A finding | " + "x".repeat(60) + " |",
].join("\n");

describe("MISC spec coverage: reading the spec", () => {
  it("MISC reads the ID and status of every table row, and nothing else", () => {
    const rows = extractSpecRows([{ file: "edexcel.md", text: sample }]);
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["EDX-5", "SOURCE"],
      ["EDX-54", "SOURCE"],
      ["EDX-100", `${"x".repeat(39)}…`],
    ]);
  });

  it("MISC reads Windows line endings too", () => {
    expect(
      extractSpecRows([{ file: "f.md", text: "| SH-01 | r | DECIDED |\r\n| SH-02 | r | DECIDED |\r\n" }]),
    ).toHaveLength(2);
  });

  it("MISC finds every ID in the real spec, once each, including the M1 additions", () => {
    const dir = join(import.meta.dirname, "..", "docs", "language-spec");
    const rows = extractSpecRows(readdirSync(dir).map((f) => ({ file: f, text: readFileSync(join(dir, f), "utf8") })));
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let n = 1; n <= 18; n++) expect(ids).toContain(`SH-${String(n).padStart(2, "0")}`);
    expect(ids).toEqual(expect.arrayContaining(["EDX-34", "EDX-75", "CIE-15", "CIE-97", "PY-01"]));
  });
});

describe("MISC spec coverage: matching test names to IDs", () => {
  it.each([
    ["EDX-54 STEP 0 is a runtime error", "EDX-54", true],
    ["EDX-54-step-zero", "EDX-54", true],
    ["EDX-54", "EDX-54", true],
    ["EDX-54 STEP 0", "EDX-5", false],
    ["EDX-540 something", "EDX-54", false],
    ["MISC EDX-54 mentioned later", "EDX-54", false],
    ["CIE-54 other language", "EDX-54", false],
  ])("MISC %j proves %s: %s", (name, id, expected) => {
    expect(namesId(name, id)).toBe(expected);
  });
});

describe("MISC spec coverage: the table and the scope check", () => {
  const rows = [
    { id: "EDX-5", file: "e.md", status: "SOURCE" },
    { id: "EDX-54", file: "e.md", status: "SOURCE" },
    { id: "SH-10", file: "s.md", status: "DECIDED" },
  ];
  const tests = [
    { name: "EDX-54 STEP 0 is a runtime error", pending: false },
    { name: "EDX-54-step-zero", pending: true },
    { name: "SH-10-div-mod-negatives", pending: true },
  ];

  it("MISC counts real tests and pending tests separately", () => {
    expect(coverage(rows, tests, new Set())).toEqual([
      { id: "EDX-5", file: "e.md", status: "SOURCE", tests: 0, pendingTests: 0, inScope: false },
      { id: "EDX-54", file: "e.md", status: "SOURCE", tests: 1, pendingTests: 1, inScope: false },
      { id: "SH-10", file: "s.md", status: "DECIDED", tests: 0, pendingTests: 1, inScope: false },
    ]);
  });

  it("MISC an in-scope ID with only pending tests is missing", () => {
    const table = coverage(rows, tests, new Set(["EDX-54", "SH-10"]));
    expect(missingInScope(table)).toEqual(["SH-10"]);
    expect(markdownReport(table)).toContain("| SH-10 | s.md | DECIDED | 0 | 1 | **yes: MISSING** |");
    expect(markdownReport(table)).toContain("| EDX-54 | e.md | SOURCE | 1 | 1 | yes |");
  });

  it("MISC nothing is missing when the scope is empty", () => {
    expect(missingInScope(coverage(rows, tests, new Set()))).toEqual([]);
  });

  it("MISC flags scope IDs that are not in the spec", () => {
    expect(unknownScopeIds(rows, new Set(["EDX-54", "EDX-999"]))).toEqual(["EDX-999"]);
  });

  it("MISC reads passed test titles from Vitest's JSON report, skipping excluded files", () => {
    const report = {
      testResults: [
        {
          name: "/r/src/a.test.ts",
          assertionResults: [
            { title: "SH-01 one", status: "passed" },
            { title: "MISC two", status: "passed" },
          ],
        },
        { name: "/r/tests/golden.test.ts", assertionResults: [{ title: "SH-10-x (harvested/x)", status: "passed" }] },
      ],
    };
    expect(vitestTitles(report, (p) => p.endsWith("golden.test.ts"))).toEqual(["SH-01 one", "MISC two"]);
  });

  it.each(["skipped", "todo", "failed", "pending"])(
    "MISC a %s test does not count as covering its spec ID",
    (status) => {
      const report = {
        testResults: [{ name: "/r/a.test.ts", assertionResults: [{ title: "EDX-54 STEP 0", status }] }],
      };
      const titles = vitestTitles(report, () => false);
      expect(titles).toEqual([]);
      const rows = [{ id: "EDX-54", file: "e.md", status: "SOURCE" }];
      const table = coverage(
        rows,
        titles.map((name) => ({ name, pending: false })),
        new Set(["EDX-54"]),
      );
      expect(missingInScope(table)).toEqual(["EDX-54"]);
    },
  );
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  discoverGoldenCases,
  schemaErrors,
  TESTS_DIR,
  type ExpectedDiagnostic,
  type ExpectedFile,
} from "./support/golden.ts";

// Checks the expected files themselves (not the engine) for every golden program outside harvested/, which
// harvested.test.ts already checks: valid, named after a spec ID, citing real IDs, with diagnostics in order at
// places inside the program. Error-wording programs (tests/errors/) must give the exact message and hint.
const repoDir = join(TESTS_DIR, "..", "..", "..");
const specText = readdirSync(join(repoDir, "docs", "language-spec"))
  .map((f) => readFileSync(join(repoDir, "docs", "language-spec", f), "utf8"))
  .join("\n");
const specIdExists = (id: string): boolean => specText.includes(`| ${id} |`);

const cases = discoverGoldenCases().filter((c) => !c.id.startsWith("harvested/"));
const all = (e: ExpectedFile["expect"]): ExpectedDiagnostic[] => [...e.errors, ...e.warnings, ...(e.info ?? [])];

describe("MISC expected files outside harvested/", () => {
  it("MISC finds the conformance, error and golden programs", () => {
    const folders = new Set(cases.map((c) => c.id.split("/")[0]));
    expect([...folders].sort()).toEqual(["conformance", "errors", "golden"]);
  });

  describe.each(cases.map((c) => [c.id, c] as const))("MISC %s", (_id, c) => {
    const expected = c.raw as ExpectedFile;

    it("MISC is valid, and named after one of the spec IDs it lists (or MISC)", () => {
      expect(schemaErrors(c.raw)).toEqual([]);
      expect(c.name.startsWith("MISC-") || expected.spec.some((id) => c.name.startsWith(`${id}-`))).toBe(true);
    });

    it("MISC cites only spec IDs that exist", () => {
      expect(expected.spec.filter((id) => !specIdExists(id))).toEqual([]);
    });

    it("MISC lists diagnostics in order, at positions inside the program", () => {
      const BOM = String.fromCharCode(0xfeff); // a UTF-8 byte order mark is not part of line 1 (SH-01)
      const lines = (c.source.startsWith(BOM) ? c.source.slice(1) : c.source).split(/\r?\n/);
      for (const list of [expected.expect.errors, expected.expect.warnings, expected.expect.info ?? []]) {
        expect(list).toEqual([...list].sort((a, b) => a.line - b.line || a.column - b.column));
        for (const d of list) {
          const chars = Array.from(lines[d.line - 1] ?? "");
          expect(d.line).toBeLessThanOrEqual(lines.length);
          // One past the end is allowed for "something is missing at the end of the line".
          expect(d.column).toBeLessThanOrEqual(chars.length + 1);
          expect(/\s/.test(chars[d.column - 1] ?? "x")).toBe(false);
        }
      }
    });

    it("MISC prints nothing when the checker rejects the program, and stops at the first runtime error", () => {
      const { errors, stdout } = expected.expect;
      if (errors.some((e) => /^E-(CHK|SYN)-/.test(e.code))) expect(stdout).toBe("");
      expect(errors.filter((e) => /^E-(RUN|PY)-/.test(e.code)).length).toBeLessThanOrEqual(1);
    });

    it("MISC gives exact wording for every diagnostic in tests/errors/, and only there", () => {
      const worded = all(expected.expect).filter((d) => d.message !== undefined && d.hint !== undefined);
      expect(worded.length).toBe(c.id.startsWith("errors/") ? all(expected.expect).length : 0);
    });
  });
});

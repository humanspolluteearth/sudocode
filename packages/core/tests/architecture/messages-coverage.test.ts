import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogueEntry, MESSAGES } from "../../src/messages/index.ts";

// Every code a golden test expects must have wording, and every spec ID the catalogue cites must exist.
const testsDir = join(import.meta.dirname, "..");
const repoDir = join(testsDir, "..", "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

interface Expected {
  expect: { errors: { code: string }[]; warnings: { code: string }[]; info?: { code: string }[] };
}

const expectedCodes = new Set(
  walk(testsDir)
    .filter((f) => f.endsWith(".expected.json"))
    .flatMap((f) => {
      const e = (JSON.parse(readFileSync(f, "utf8")) as Expected).expect;
      return [...e.errors, ...e.warnings, ...(e.info ?? [])].map((d) => d.code);
    }),
);

const specText = readdirSync(join(repoDir, "docs", "language-spec"))
  .map((f) => readFileSync(join(repoDir, "docs", "language-spec", f), "utf8"))
  .join("\n");

describe("SH-15 message catalogue coverage", () => {
  it("SH-15 finds the codes used by golden files", () => {
    expect(expectedCodes.size).toBeGreaterThan(20);
  });

  it.each([...expectedCodes].sort())("SH-15 %s has wording", (code) => {
    expect(() => catalogueEntry(code)).not.toThrow();
  });

  it("SH-15 every spec ID the catalogue cites exists", () => {
    const cited = new Set(Object.values(MESSAGES).flatMap((e) => e.spec));
    expect([...cited].filter((id) => !specText.includes(`| ${id} |`))).toEqual([]);
  });
});

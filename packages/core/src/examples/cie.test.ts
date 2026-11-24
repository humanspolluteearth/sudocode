import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../engine.ts";
import { runHeadless } from "../runner/headless.ts";
import { CIE_EXAMPLES } from "./cie.ts";

async function run(id: string) {
  const example = CIE_EXAMPLES.find((e) => e.id === id);
  if (example === undefined) throw new Error(`no example ${id}`);
  return runHeadless(
    createLocalRunner(ENGINES),
    { language: "cie", source: example.code, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
}

describe("MISC the Cambridge examples are valid programs", () => {
  it("MISC every example has a unique id", () => {
    expect(new Set(CIE_EXAMPLES.map((e) => e.id)).size).toBe(CIE_EXAMPLES.length);
  });
  it("MISC no example has an error or a warning", async () => {
    for (const e of CIE_EXAMPLES) {
      const r = await run(e.id);
      expect([e.id, r.status, r.errors, r.warnings]).toEqual([e.id, "finished", [], []]);
    }
  });
  it.each([
    ["grade", "Grade: B\n"],
    ["array-total", "Total: 72\nLargest: 30\n"],
    ["functions", "****\n"],
    ["records", "Ama is in year 10\n"],
    ["classes", "Rex says Woof\n"],
  ])("MISC Cambridge example %s prints the hand-computed output", async (id, out) => {
    expect((await run(id)).stdout).toBe(out);
  });
  it("MISC Times table prints 12 lines, the last 7 x 12 = 84", async () => {
    const lines = (await run("times")).stdout.trimEnd().split("\n");
    expect([lines.length, lines[0], lines[11]]).toEqual([12, "7 x 1 = 7", "7 x 12 = 84"]);
  });
});

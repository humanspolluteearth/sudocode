import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../engine.ts";
import { runHeadless } from "../runner/headless.ts";
import { PYTHON_EXAMPLES, PYTHON_GUIDE } from "./python.ts";

const run = (source: string) =>
  runHeadless(
    createLocalRunner(ENGINES),
    { language: "python", source, files: {}, seed: 1, breakpoints: [], trace: false },
    ["15"],
  );

describe("MISC the Python examples and guide are valid programs", () => {
  it("MISC every example has a unique id", () => {
    expect(new Set(PYTHON_EXAMPLES.map((e) => e.id)).size).toBe(PYTHON_EXAMPLES.length);
  });
  it("MISC no example or guide snippet has an error or a warning", async () => {
    for (const e of [
      ...PYTHON_EXAMPLES.map((x) => ({ id: x.id, code: x.code })),
      ...PYTHON_GUIDE.map((x) => ({ id: x.title, code: x.code })),
    ]) {
      const r = await run(e.code);
      expect([e.id, r.status, r.errors, r.warnings]).toEqual([e.id, "finished", [], []]);
    }
  });
  it.each([
    ["grade", "Grade: B\n"],
    ["list-total", "Total: 72\nLargest: 30\n"],
    ["functions", "****\n"],
    ["dictionary", "Ama is 15\nKofi is 16\nEsi is 14\n"],
    ["try-except", "Not a number\n"],
  ])("MISC the %s example prints what CPython prints", async (id, expected) => {
    const example = PYTHON_EXAMPLES.find((e) => e.id === id);
    expect((await run(example?.code ?? "")).stdout).toBe(expected);
  });
});

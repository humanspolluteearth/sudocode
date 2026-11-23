import { runHeadless } from "../runner/headless.ts";
import { createLocalRunner, ENGINES } from "../engine.ts";
import { describe, expect, it } from "vitest";
import { EDEXCEL_EXAMPLES } from "./edexcel.ts";

async function run(id: string) {
  const example = EDEXCEL_EXAMPLES.find((e) => e.id === id);
  if (example === undefined) throw new Error(`no example ${id}`);
  const runner = createLocalRunner(ENGINES);
  return runHeadless(
    runner,
    { language: "edexcel", source: example.code, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
}

describe("MISC the Edexcel examples are valid programs", () => {
  it("MISC every example has a unique id and a name", () => {
    expect(new Set(EDEXCEL_EXAMPLES.map((e) => e.id)).size).toBe(EDEXCEL_EXAMPLES.length);
  });
  it("MISC no example has an error or a warning, except the bug one", async () => {
    for (const e of EDEXCEL_EXAMPLES.filter((x) => x.id !== "bug")) {
      const r = await run(e.id);
      expect([e.id, r.status, r.errors, r.warnings]).toEqual([e.id, "finished", [], []]);
    }
  });
  it("MISC Grade checker prints the grade", async () => {
    expect((await run("grade")).stdout).toBe("Amira got grade B\n");
  });
  it("MISC Times table prints 12 lines", async () => {
    const lines = (await run("times")).stdout.trimEnd().split("\n");
    expect([lines.length, lines[0], lines[11]]).toEqual([12, "1 x 7 = 7", "12 x 7 = 84"]);
  });
  it("MISC Guessing game takes three tries", async () => {
    expect((await run("guess")).stdout).toBe("Too low\nToo high\nGot it in 3 tries\n");
  });
  it("MISC Bubble sort prints the numbers in order", async () => {
    expect((await run("bubble")).stdout).toBe("4\n8\n15\n17\n29\n42\n");
  });
  it("MISC Find the bug stops with a runtime error", async () => {
    const r = await run("bug");
    expect([r.status, r.errors.length]).toEqual(["error", 1]);
  });
});

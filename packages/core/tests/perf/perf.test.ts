import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";

// Budgets (docs/TEST-PLAN.md, "Performance budgets"): generous on purpose, so they catch a 10x slowdown or a leak
// on a slow CI machine, not noise. Devices with 2 GB RAM are the target, so heap growth is capped too.
const LOOP = `SET total TO 0
FOR i FROM 1 TO 200000 DO
    SET total TO total + i MOD 7
END FOR
SEND total TO DISPLAY
`;
// 28,571 full cycles of i MOD 7 (0..6 sums to 21) = 599,991, plus the leftover i = 199998, 199999, 200000 giving 1+2+3.
const LOOP_ANSWER = "599997\n";

async function run(source: string): Promise<{ stdout: string; errors: number }> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "edexcel", source, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
  return { stdout: r.stdout, errors: r.errors.length };
}

describe("MISC performance budgets", () => {
  it("MISC a 200,000-iteration loop finishes within 5 seconds", async () => {
    const start = performance.now();
    const r = await run(LOOP);
    const ms = performance.now() - start;
    expect(r).toEqual({ stdout: LOOP_ANSWER, errors: 0 });
    expect(ms).toBeLessThan(5000);
  });

  it("MISC running the loop 5 times grows the heap by under 100 MB", async () => {
    await run(LOOP);
    globalThis.gc?.();
    const before = process.memoryUsage().heapUsed;
    for (let k = 0; k < 5; k++) await run(LOOP);
    globalThis.gc?.();
    const grown = (process.memoryUsage().heapUsed - before) / 1024 / 1024;
    expect(grown).toBeLessThan(100);
  });
});

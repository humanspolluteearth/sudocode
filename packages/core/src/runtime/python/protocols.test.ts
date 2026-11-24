import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runHeadless } from "../../runner/headless.ts";
import { createLocalRunner } from "../../runner/local-runner.ts";
import { ENGINES } from "../../runner/engines.ts";

async function out(source: string): Promise<string> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "python", source, trace: false, breakpoints: [], files: {}, seed: 1 },
    [],
  );
  return r.stdout;
}

// The golden harness also checks the PY-54 note; these check the printed output alone, against the CPython text
// stored in the golden's expected file (see docs/review/QUESTIONS.md about the missing note lines).
function golden(name: string): { source: string; stdout: string } {
  const dir = new URL("../../../tests/golden/python/", import.meta.url);
  const expected = JSON.parse(readFileSync(new URL(`${name}.expected.json`, dir), "utf8")) as {
    expect: { stdout: string };
  };
  return { source: readFileSync(new URL(`${name}.py`, dir), "utf8"), stdout: expected.expect.stdout };
}

describe("Python instance protocols", () => {
  it("PY-19 instances hash by identity, or by __hash__, and are unhashable with __eq__ alone", async () => {
    const g = golden("PY-19-hashing");
    expect(await out(g.source)).toBe(g.stdout);
  });
  it("PY-19 __len__, ordering dunders and NotImplemented behave as in CPython", async () => {
    const g = golden("PY-19-dunders");
    expect(await out(g.source)).toBe(g.stdout);
  });
  it("PY-19 __bool__ decides truthiness before __len__", async () => {
    const src =
      "class A:\n    def __bool__(self):\n        return False\n    def __len__(self):\n        return 3\nprint(bool(A()), len(A()))\n";
    expect(await out(src)).toBe("False 3\n");
  });
  it("PY-42 timedelta division rounds like CPython", async () => {
    const src =
      "from datetime import timedelta\nprint(timedelta(microseconds=5) / 2, timedelta(microseconds=7) / 2, timedelta(microseconds=-5) // 2)\n";
    expect(await out(src)).toBe("0:00:00.000002 0:00:00.000004 -1 day, 23:59:59.999997\n");
  });
});

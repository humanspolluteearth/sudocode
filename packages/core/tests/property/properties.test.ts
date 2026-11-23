import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";
import { forAll, int } from "../support/forall.ts";

async function out(code: string): Promise<{ stdout: string; errors: string[] }> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "edexcel", source: code, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
  return { stdout: r.stdout, errors: r.errors.map((d) => d.code) };
}

describe("SH-10 DIV and MOD identity", () => {
  it("SH-10 for every a and non-zero b, (a DIV b) * b + (a MOD b) = a, and MOD takes the sign of b", async () => {
    const cases: { a: number; b: number }[] = [];
    forAll(
      101,
      (r) => {
        let b = int(r, -50, 50);
        if (b === 0) b = 7;
        return { a: int(r, -1000, 1000), b };
      },
      (c) => cases.push(c),
    );
    // One program per batch of cases keeps the run fast: each line prints the identity's two sides and the sign test.
    const lines = cases.map(
      ({ a, b }) =>
        `SEND ((${String(a)}) DIV (${String(b)})) * (${String(b)}) + ((${String(a)}) MOD (${String(b)})) TO DISPLAY`,
    );
    const r = await out(lines.join("\n") + "\n");
    expect(r.errors).toEqual([]);
    expect(r.stdout).toBe(cases.map((c) => `${String(c.a)}\n`).join(""));
    for (const { a, b } of cases) {
      const mod = a - Math.floor(a / b) * b;
      expect(mod === 0 || Math.sign(mod) === Math.sign(b)).toBe(true);
    }
  });
});

describe("EDX-11 literals survive being printed", () => {
  it("EDX-11 an INTEGER literal printed with SEND comes back as the same digits", async () => {
    const values: number[] = [];
    forAll(
      202,
      (r) => int(r, 0, 1_000_000_000),
      (v) => values.push(v),
    );
    const r = await out(values.map((v) => `SEND ${String(v)} TO DISPLAY`).join("\n") + "\n");
    expect(r.stdout).toBe(values.map((v) => `${String(v)}\n`).join(""));
  });
  it("EDX-12 a STRING literal without quotes or newlines printed with SEND comes back unchanged", async () => {
    const alphabet = "abcXYZ 012!?,.-";
    const strings: string[] = [];
    forAll(
      303,
      (r) => Array.from({ length: int(r, 0, 12) }, () => alphabet[int(r, 0, alphabet.length - 1)]).join(""),
      (s) => strings.push(s),
    );
    const r = await out(strings.map((s) => `SEND "${s}" TO DISPLAY`).join("\n") + "\n");
    expect(r.stdout).toBe(strings.map((s) => `${s}\n`).join(""));
  });
});

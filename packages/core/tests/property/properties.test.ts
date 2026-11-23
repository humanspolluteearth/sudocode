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

describe("SH-10 DIV and MOD follow the floor rules", () => {
  it("SH-10 -7 DIV 2 is -4 and -7 MOD 2 is 1 (fixed cases for each sign combination)", async () => {
    const r = await out(
      "SEND (-7) DIV 2 TO DISPLAY\nSEND (-7) MOD 2 TO DISPLAY\nSEND 7 DIV (-2) TO DISPLAY\nSEND 7 MOD (-2) TO DISPLAY\n" +
        "SEND (-7) DIV (-2) TO DISPLAY\nSEND (-7) MOD (-2) TO DISPLAY\nSEND 7 DIV 2 TO DISPLAY\nSEND 7 MOD 2 TO DISPLAY\n",
    );
    expect(r.errors).toEqual([]);
    // floor(-3.5) = -4, -7 - (-4*2) = 1; floor(-3.5) = -4, 7 - (-4*-2) = -1; floor(3.5) = 3, -7 - (3*-2) = -1; 3 and 1.
    expect(r.stdout).toBe("-4\n1\n-4\n-1\n3\n-1\n3\n1\n");
  });

  it("SH-10 for random a and non-zero b, DIV is the floor of a/b and MOD is a minus DIV times b", async () => {
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
    // One program per batch of cases keeps the run fast. The oracle is the floor rule itself, worked out in plain JS.
    const lines = cases.flatMap(({ a, b }) => [
      `SEND (${String(a)}) DIV (${String(b)}) TO DISPLAY`,
      `SEND (${String(a)}) MOD (${String(b)}) TO DISPLAY`,
    ]);
    const r = await out(lines.join("\n") + "\n");
    expect(r.errors).toEqual([]);
    const expected = cases.flatMap(({ a, b }) => {
      const q = Math.floor(a / b);
      return [`${String(q)}\n`, `${String(a - q * b)}\n`];
    });
    expect(r.stdout).toBe(expected.join(""));
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
  it("MISC a STRING literal without quotes or newlines printed with SEND comes back unchanged", async () => {
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

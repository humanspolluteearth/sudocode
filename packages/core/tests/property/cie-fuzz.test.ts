// CIE fuzz and property runs (M7): the Cambridge front end never throws or hangs, and the shared arithmetic rules
// hold for random numbers. Fixed seeds keep PR runs deterministic; nightly raises SUDOCODE_RUNS.
import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { analyse } from "../../src/cie/engine.ts";
import { CIE_EXAMPLES } from "../../src/examples/cie.ts";
import { runHeadless } from "../../src/runner/headless.ts";
import { forAll, int, pick, RUNS, type Rng } from "../support/forall.ts";

const WORDS = [
  "DECLARE",
  "CONSTANT",
  "TYPE",
  "ENDTYPE",
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "CASE",
  "OF",
  "OTHERWISE",
  "ENDCASE",
  "FOR",
  "TO",
  "STEP",
  "NEXT",
  "WHILE",
  "DO",
  "ENDWHILE",
  "REPEAT",
  "UNTIL",
  "PROCEDURE",
  "ENDPROCEDURE",
  "FUNCTION",
  "ENDFUNCTION",
  "RETURNS",
  "RETURN",
  "CALL",
  "BYREF",
  "OUTPUT",
  "INPUT",
  "OPENFILE",
  "READFILE",
  "TRY",
  "EXCEPT",
  "ENDTRY",
  "CLASS",
  "ENDCLASS",
  "INHERITS",
  "PUBLIC",
  "PRIVATE",
  "NEW",
  "SUPER",
  "AND",
  "OR",
  "NOT",
  "MOD",
  "DIV",
  "INTEGER",
  "REAL",
  "STRING",
  "ARRAY",
  "x",
  "Y",
  "Total",
  "←",
  "<-",
  ":",
  ",",
  ".",
  "(",
  ")",
  "[",
  "]",
  "+",
  "-",
  "*",
  "/",
  "=",
  "<>",
  "&",
  '"',
  "'",
  "1",
  "42",
  "3.5",
  "\n",
  "\n",
  "  ",
  "//",
  "é",
  "\t",
  "^",
];
const SEEDS = CIE_EXAMPLES.map((e) => e.code);

const soup = (r: Rng): string =>
  Array.from({ length: int(r, 0, 60) }, () => pick(r, WORDS)).join(pick(r, [" ", "", "\n"]));

const mutate = (r: Rng): string => {
  let s = pick(r, SEEDS);
  for (let k = int(r, 1, 6); k > 0; k--) {
    const at = int(r, 0, s.length);
    const how = int(r, 0, 2);
    if (how === 0) s = s.slice(0, at) + s.slice(at + int(r, 1, 8));
    else if (how === 1) s = s.slice(0, at) + pick(r, WORDS) + " " + s.slice(at);
    else s = s.slice(0, at) + s.slice(int(r, 0, s.length));
  }
  return s;
};

describe("MISC CIE fuzz: the front end never throws and never hangs", () => {
  it("MISC random Cambridge token soup is analysed without throwing", () => {
    forAll(44, soup, (src) => {
      expect(Array.isArray(analyse(src).diagnostics)).toBe(true);
    });
  });
  it("MISC edited Cambridge examples are analysed without throwing, each within 2 seconds", () => {
    forAll(
      55,
      mutate,
      (src) => {
        const t = performance.now();
        analyse(src);
        expect(performance.now() - t).toBeLessThan(2000);
      },
      Math.max(RUNS, 300),
    );
  });
  it("MISC every Cambridge diagnostic points at a real line and column", () => {
    forAll(66, mutate, (src) => {
      for (const d of analyse(src).diagnostics) {
        expect(d.line).toBeGreaterThanOrEqual(1);
        expect(d.column).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

async function cieOut(source: string): Promise<string> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "cie", source, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
  return r.stdout;
}

describe("SH-10 CIE DIV and MOD follow the floor rules", () => {
  it("SH-10 for random a and non-zero b, a DIV b is floor(a/b) and a MOD b is a - (a DIV b) * b", async () => {
    const cases: [number, number][] = [];
    forAll(
      77,
      (r) => [int(r, -50, 50), int(r, 1, 9) * (r() < 0.5 ? -1 : 1)] as [number, number],
      (c) => {
        cases.push(c);
      },
      60,
    );
    const src = cases
      .map(([a, b]) => `OUTPUT (${String(a)}) DIV (${String(b)})\nOUTPUT (${String(a)}) MOD (${String(b)})`)
      .join("\n");
    const expected = cases
      .map(([a, b]) => `${String(Math.floor(a / b))}\n${String(a - Math.floor(a / b) * b)}\n`)
      .join("");
    expect(await cieOut(src)).toBe(expected);
  });
});

// The fuzz harness (M5): whatever text is thrown at the lexer, parser and checker, they never throw and never hang.
// Inputs: example programs with random edits, and random token soup. A fixed seed keeps PR runs deterministic;
// the nightly job raises SUDOCODE_RUNS. A crash prints the seed and the input so it can become a regression test.
import { describe, expect, it } from "vitest";
import { analyse } from "../../src/edexcel/engine.ts";
import { EDEXCEL_EXAMPLES, SUBPROGRAM_EXAMPLES } from "../../src/examples/edexcel.ts";
import { forAll, int, pick, RUNS, type Rng } from "../support/forall.ts";

const WORDS = [
  "SET",
  "TO",
  "SEND",
  "DISPLAY",
  "RECEIVE",
  "FROM",
  "KEYBOARD",
  "IF",
  "THEN",
  "ELSE",
  "END",
  "WHILE",
  "DO",
  "REPEAT",
  "UNTIL",
  "TIMES",
  "FOR",
  "FROM",
  "STEP",
  "EACH",
  "IN",
  "PROCEDURE",
  "FUNCTION",
  "BEGIN",
  "RETURN",
  "AND",
  "OR",
  "NOT",
  "DIV",
  "MOD",
  "TRUE",
  "FALSE",
  "x",
  "y",
  "total",
  "RANDOM",
  "LENGTH",
  "(",
  ")",
  "[",
  "]",
  ",",
  "+",
  "-",
  "*",
  "/",
  "^",
  "=",
  "<>",
  "<=",
  ">=",
  "<",
  ">",
  "&",
  '"',
  "'",
  "1",
  "42",
  "3.5",
  "0",
  "\n",
  "\n",
  "  ",
  "#",
  "—",
  "é",
  "\t",
];
const SEEDS = [...EDEXCEL_EXAMPLES, ...SUBPROGRAM_EXAMPLES].map((e) => e.code);

const soup = (r: Rng): string =>
  Array.from({ length: int(r, 0, 60) }, () => pick(r, WORDS)).join(pick(r, [" ", "", "\n"]));

const mutate = (r: Rng): string => {
  let s = pick(r, SEEDS);
  for (let k = int(r, 1, 6); k > 0; k--) {
    const at = int(r, 0, s.length);
    const how = int(r, 0, 2);
    if (how === 0)
      s = s.slice(0, at) + s.slice(at + int(r, 1, 8)); // delete a few characters
    else if (how === 1)
      s = s.slice(0, at) + pick(r, WORDS) + " " + s.slice(at); // insert a word
    else s = s.slice(0, at) + s.slice(int(r, 0, s.length)); // drop a chunk
  }
  return s;
};

describe("MISC fuzz: the front end never throws and never hangs", () => {
  it("MISC random token soup is analysed without throwing", () => {
    forAll(11, soup, (src) => {
      expect(Array.isArray(analyse(src).diagnostics)).toBe(true);
    });
  });
  it("MISC edited example programs are analysed without throwing, each within 2 seconds", () => {
    forAll(
      22,
      mutate,
      (src) => {
        const t = performance.now();
        analyse(src);
        expect(performance.now() - t).toBeLessThan(2000);
      },
      Math.max(RUNS, 300),
    );
  });
  it("MISC every diagnostic points at a real line and column", () => {
    forAll(33, mutate, (src) => {
      for (const d of analyse(src).diagnostics) {
        expect(d.line).toBeGreaterThanOrEqual(1);
        expect(d.column).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

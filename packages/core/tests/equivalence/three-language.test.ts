// Equivalence: one algorithm in Edexcel, Cambridge and Python must print the same thing, because all three front
// ends lower to one shared IR. Expected outputs are worked out by hand (not by running the code).
import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";

const lines = (...rows: string[]): string => rows.join("\n") + "\n";
type Lang = "edexcel" | "cie" | "python";

async function out(language: Lang, source: string) {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language, source, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
  return { stdout: r.stdout, errors: r.errors.map((e) => e.code) };
}

const TRIPLES: readonly (readonly [string, string, string, string, string])[] = [
  [
    "SH-02 a loop adds 1 to 5 (1+2+3+4+5 = 15)",
    lines("SET t TO 0", "FOR i FROM 1 TO 5 DO", "    SET t TO t + i", "END FOR", "SEND t TO DISPLAY"),
    lines("DECLARE T, I : INTEGER", "T ← 0", "FOR I ← 1 TO 5", "  T ← T + I", "NEXT I", "OUTPUT T"),
    lines("t = 0", "for i in range(1, 6):", "    t = t + i", "print(t)"),
    "15\n",
  ],
  [
    "SH-02 a WHILE loop halves 100 while it is above 10 (100, 50, 25, 12, 6)",
    lines("SET n TO 100", "WHILE n > 10 DO", "    SET n TO n DIV 2", "END WHILE", "SEND n TO DISPLAY"),
    lines("DECLARE N : INTEGER", "N ← 100", "WHILE N > 10 DO", "  N ← N DIV 2", "ENDWHILE", "OUTPUT N"),
    lines("n = 100", "while n > 10:", "    n = n // 2", "print(n)"),
    "6\n",
  ],
  [
    "SH-10 MOD picks odd or even (7 MOD 2 = 1)",
    lines(
      "SET x TO 7",
      "IF x MOD 2 = 0 THEN",
      "    SEND 'even' TO DISPLAY",
      "ELSE",
      "    SEND 'odd' TO DISPLAY",
      "END IF",
    ),
    lines(
      "DECLARE X : INTEGER",
      "X ← 7",
      "IF X MOD 2 = 0",
      "  THEN",
      '    OUTPUT "even"',
      "  ELSE",
      '    OUTPUT "odd"',
      "ENDIF",
    ),
    lines("x = 7", "if x % 2 == 0:", "    print('even')", "else:", "    print('odd')"),
    "odd\n",
  ],
];

describe("three-language equivalence", () => {
  for (const [name, edexcel, cie, python, expected] of TRIPLES) {
    it(name, async () => {
      for (const [language, source] of [
        ["edexcel", edexcel],
        ["cie", cie],
        ["python", python],
      ] as const) {
        const r = await out(language, source);
        expect({ language, ...r }).toEqual({ language, stdout: expected, errors: [] });
      }
    });
  }
});

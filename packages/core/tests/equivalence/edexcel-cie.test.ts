// Equivalence: the same algorithm written in Edexcel and in Cambridge pseudocode must print the same thing, because
// both front ends lower to one shared IR. Expected outputs are worked out by hand (not by running the code).
import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";

const lines = (...rows: string[]): string => rows.join("\n") + "\n";

async function out(language: "edexcel" | "cie", source: string) {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language, source, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
  return { stdout: r.stdout, errors: r.errors.map((e) => e.code) };
}

const PAIRS: readonly (readonly [string, string, string, string])[] = [
  [
    "SH-02 a FOR loop adds 1 to 5 (1+2+3+4+5 = 15)",
    lines("SET t TO 0", "FOR i FROM 1 TO 5 DO", "    SET t TO t + i", "END FOR", "SEND t TO DISPLAY"),
    lines("DECLARE T, I : INTEGER", "T ← 0", "FOR I ← 1 TO 5", "  T ← T + I", "NEXT I", "OUTPUT T"),
    "15\n",
  ],
  [
    "SH-02 a WHILE loop halves 100 while it is above 10 (100, 50, 25, 12, 6)",
    lines("SET n TO 100", "WHILE n > 10 DO", "    SET n TO n DIV 2", "END WHILE", "SEND n TO DISPLAY"),
    lines("DECLARE N : INTEGER", "N ← 100", "WHILE N > 10 DO", "  N ← N DIV 2", "ENDWHILE", "OUTPUT N"),
    "6\n",
  ],
  [
    "SH-02 REPEAT UNTIL triples 1 until it passes 50 (3, 9, 27, 81)",
    lines("SET n TO 1", "REPEAT", "    SET n TO n * 3", "UNTIL n > 50", "SEND n TO DISPLAY"),
    lines("DECLARE N : INTEGER", "N ← 1", "REPEAT", "  N ← N * 3", "UNTIL N > 50", "OUTPUT N"),
    "81\n",
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
    "odd\n",
  ],
  [
    "EDX-16 joining text with &",
    lines("SET name TO 'Ana'", "SEND 'Hi ' & name TO DISPLAY"),
    lines("DECLARE Name : STRING", 'Name ← "Ana"', 'OUTPUT "Hi " & Name'),
    "Hi Ana\n",
  ],
  [
    "SH-10 DIV and MOD floor towards minus infinity: -7 DIV 2 = -4, -7 MOD 2 = 1",
    lines("SEND (-7) DIV 2 TO DISPLAY", "SEND (-7) MOD 2 TO DISPLAY"),
    lines("OUTPUT (-7) DIV 2", "OUTPUT (-7) MOD 2"),
    "-4\n1\n",
  ],
  [
    "MISC the first item of an array is item 0 in Edexcel and item 1 in Cambridge; both print 30 then 10",
    lines("SET a TO [30, 20, 10]", "SEND a[0] TO DISPLAY", "SEND a[2] TO DISPLAY"),
    lines("DECLARE A : ARRAY[1:3] OF INTEGER", "A[1] ← 30", "A[2] ← 20", "A[3] ← 10", "OUTPUT A[1]", "OUTPUT A[3]"),
    "30\n10\n",
  ],
];

describe("MISC Edexcel and Cambridge programs for the same algorithm print the same thing", () => {
  it.each(PAIRS)("%s", async (_name, edexcel, cie, expected) => {
    const e = await out("edexcel", edexcel);
    const c = await out("cie", cie);
    expect([e.errors, e.stdout]).toEqual([[], expected]);
    expect([c.errors, c.stdout]).toEqual([[], expected]);
  });
});

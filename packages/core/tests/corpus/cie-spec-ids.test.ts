// Test-reviewer follow-up (M7): the corpus rows in cie-exam.test.ts carry some wrong spec IDs and are merged, so they
// are left alone (logged in docs/review/M7.md D22). These tests prove the same rules under the CORRECT IDs and add
// the rows that had no real test. Expected values are worked out by hand from docs/language-spec/cie-9618.md.
import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";

const L = (...rows: string[]): string => rows.join("\n");

async function run(source: string) {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "cie", source, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
  return { errors: r.errors.map((e) => e.code), stdout: r.stdout };
}

type Row = readonly [name: string, source: string, stdout: string];

const OK: readonly Row[] = [
  [
    "CIE-50 a nested IF with THEN on its own line (N=7: positive, then odd)",
    L(
      "DECLARE N : INTEGER",
      "N ← 7",
      "IF N > 0",
      "  THEN",
      "    IF N MOD 2 = 1",
      "      THEN",
      '        OUTPUT "odd"',
      "      ELSE",
      '        OUTPUT "even"',
      "    ENDIF",
      "ENDIF",
    ),
    "odd\n",
  ],
  [
    "CIE-50 IF without ELSE does nothing when false",
    L("IF 1 > 2", "  THEN", '    OUTPUT "x"', "ENDIF", 'OUTPUT "end"'),
    "end\n",
  ],
  [
    "CIE-62 REPEAT runs at least once (N starts above the limit)",
    L("DECLARE N : INTEGER", "N ← 10", "REPEAT", "  N ← N + 1", "UNTIL N > 5", "OUTPUT N"),
    "11\n",
  ],
  [
    "CIE-62 REPEAT counts 1 to 3 then stops",
    L("DECLARE N : INTEGER", "N ← 0", "REPEAT", "  N ← N + 1", "  OUTPUT N", "UNTIL N = 3"),
    "1\n2\n3\n",
  ],
  [
    "CIE-63 WHILE does not run when the condition starts false",
    L("DECLARE N : INTEGER", "N ← 9", "WHILE N < 5 DO", "  N ← N + 1", "ENDWHILE", "OUTPUT N"),
    "9\n",
  ],
  [
    "CIE-60 FOR STEP 2 from 1 to 9 sums 1+3+5+7+9",
    L("DECLARE T, I : INTEGER", "T ← 0", "FOR I ← 1 TO 9 STEP 2", "  T ← T + I", "NEXT I", "OUTPUT T"),
    "25\n",
  ],
  [
    "CIE-20 an array with bounds 5:7 is indexed from 5",
    L("DECLARE A : ARRAY[5:7] OF INTEGER", "A[5] ← 1", "A[7] ← 3", "OUTPUT A[5] + A[7]"),
    "4\n",
  ],
  [
    "CIE-21 a 2D array is indexed [row, column]",
    L("DECLARE G : ARRAY[1:2, 1:3] OF INTEGER", "G[2, 3] ← 6", "OUTPUT G[2, 3]"),
    "6\n",
  ],
  [
    "CIE-72 a FUNCTION returns the square of 7",
    L("FUNCTION Sq(X : INTEGER) RETURNS INTEGER", "  RETURN X * X", "ENDFUNCTION", "OUTPUT Sq(7)"),
    "49\n",
  ],
  [
    "CIE-73 BYREF changes the caller's variable (3 becomes 4)",
    L(
      "PROCEDURE Inc(BYREF X : INTEGER)",
      "  X ← X + 1",
      "ENDPROCEDURE",
      "DECLARE N : INTEGER",
      "N ← 3",
      "CALL Inc(N)",
      "OUTPUT N",
    ),
    "4\n",
  ],
  [
    "CIE-73 BYVAL leaves the caller's variable alone",
    L(
      "PROCEDURE Inc(BYVAL X : INTEGER)",
      "  X ← X + 1",
      "ENDPROCEDURE",
      "DECLARE N : INTEGER",
      "N ← 3",
      "CALL Inc(N)",
      "OUTPUT N",
    ),
    "3\n",
  ],
  ["CIE-120 LENGTH of 'hello' is 5", 'OUTPUT LENGTH("hello")', "5\n"],
  ["CIE-120 MID counts from 1: MID('abcdef', 2, 3) = 'bcd'", 'OUTPUT MID("abcdef", 2, 3)', "bcd\n"],
  [
    "CIE-116 an overriding method wins through a parent-typed variable",
    L(
      "CLASS A",
      "  PUBLIC FUNCTION Hi() RETURNS STRING",
      '    RETURN "a"',
      "  ENDFUNCTION",
      "ENDCLASS",
      "CLASS B INHERITS A",
      "  PUBLIC FUNCTION Hi() RETURNS STRING",
      '    RETURN "b"',
      "  ENDFUNCTION",
      "ENDCLASS",
      "DECLARE O : A",
      "O ← NEW B()",
      "OUTPUT O.Hi()",
    ),
    "b\n",
  ],
];

describe("CIE correctly tagged programs (see the header comment)", () => {
  it.each(OK)("%s", async (_name, source, stdout) => {
    const r = await run(source);
    expect([r.errors, r.stdout]).toEqual([[], stdout]);
  });
});

describe("CIE-71 calling a procedure without CALL is a checker error", () => {
  it("CIE-71 a bare procedure name as a statement is E-CHK-CALL-REQUIRED and nothing runs", async () => {
    const r = await run(L("PROCEDURE P()", '  OUTPUT "hi"', "ENDPROCEDURE", "P()"));
    expect([r.errors, r.stdout]).toEqual([["E-CHK-CALL-REQUIRED"], ""]);
  });
});

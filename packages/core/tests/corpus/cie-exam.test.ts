// CIE exam-style corpus (M7): three short programs per topic, in the style of 9618 papers. Every expected output
// is worked out by hand from the spec, never by running the interpreter.
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

const TOPICS: Readonly<Record<string, readonly Row[]>> = {
  selection: [
    [
      "CIE-50 IF with ELSE picks the else branch for 4",
      L(
        "DECLARE N : INTEGER",
        "N ← 4",
        "IF N > 5",
        "  THEN",
        '    OUTPUT "big"',
        "  ELSE",
        '    OUTPUT "small"',
        "ENDIF",
      ),
      "small\n",
    ],
    [
      "CIE-52 CASE OF matches the second label for 'B'",
      L(
        "DECLARE G : CHAR",
        "G ← 'B'",
        "CASE OF G",
        "  'A' : OUTPUT 1",
        "  'B' : OUTPUT 2",
        "  OTHERWISE : OUTPUT 0",
        "ENDCASE",
      ),
      "2\n",
    ],
    [
      "CIE-52 CASE range 10 TO 19 matches 15",
      L(
        "DECLARE N : INTEGER",
        "N ← 15",
        "CASE OF N",
        '  1 TO 9 : OUTPUT "units"',
        '  10 TO 19 : OUTPUT "teens"',
        '  OTHERWISE : OUTPUT "more"',
        "ENDCASE",
      ),
      "teens\n",
    ],
  ],
  loops: [
    [
      "CIE-60 FOR STEP 2 from 1 to 9 sums 1+3+5+7+9",
      L("DECLARE T, I : INTEGER", "T ← 0", "FOR I ← 1 TO 9 STEP 2", "  T ← T + I", "NEXT I", "OUTPUT T"),
      "25\n",
    ],
    [
      "CIE-63 WHILE doubles 1 until 100: 1,2,4,8,16,32,64,128",
      L("DECLARE N : INTEGER", "N ← 1", "WHILE N < 100 DO", "  N ← N * 2", "ENDWHILE", "OUTPUT N"),
      "128\n",
    ],
    [
      "CIE-62 REPEAT runs once even when the condition is already true",
      L("DECLARE N : INTEGER", "N ← 10", "REPEAT", "  N ← N + 1", "UNTIL N > 5", "OUTPUT N"),
      "11\n",
    ],
  ],
  arrays: [
    [
      "CIE-20 a 1D array is indexed from its lower bound 1",
      L("DECLARE A : ARRAY[1:3] OF INTEGER", "A[1] ← 5", "A[2] ← 6", "A[3] ← 7", "OUTPUT A[1] + A[3]"),
      "12\n",
    ],
    [
      "CIE-21 a 2D array stores by row and column: 2*3 = 6",
      L("DECLARE G : ARRAY[1:2, 1:3] OF INTEGER", "G[2, 3] ← 2 * 3", "OUTPUT G[2, 3]"),
      "6\n",
    ],
    [
      "CIE-20 a loop finds the largest of 4, 9, 2",
      L(
        "DECLARE A : ARRAY[1:3] OF INTEGER",
        "DECLARE M, I : INTEGER",
        "A[1] ← 4",
        "A[2] ← 9",
        "A[3] ← 2",
        "M ← A[1]",
        "FOR I ← 2 TO 3",
        "  IF A[I] > M",
        "    THEN",
        "      M ← A[I]",
        "  ENDIF",
        "NEXT I",
        "OUTPUT M",
      ),
      "9\n",
    ],
  ],
  subprograms: [
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
  ],
  records: [
    [
      "CIE-30 a record holds two fields",
      L(
        "TYPE TP",
        "  DECLARE A : INTEGER",
        "  DECLARE B : INTEGER",
        "ENDTYPE",
        "DECLARE P : TP",
        "P.A ← 2",
        "P.B ← 5",
        "OUTPUT P.A * P.B",
      ),
      "10\n",
    ],
    [
      "CIE-30 records are copied by value",
      L(
        "TYPE TP",
        "  DECLARE A : INTEGER",
        "ENDTYPE",
        "DECLARE P, Q : TP",
        "P.A ← 1",
        "Q ← P",
        "Q.A ← 9",
        "OUTPUT P.A",
      ),
      "1\n",
    ],
    [
      "CIE-30 a STRING field is joined with &",
      L("TYPE TP", "  DECLARE N : STRING", "ENDTYPE", "DECLARE P : TP", 'P.N ← "Kim"', 'OUTPUT "Hello " & P.N'),
      "Hello Kim\n",
    ],
  ],
  strings: [
    ["CIE-120 LENGTH of 'hello' is 5", 'OUTPUT LENGTH("hello")', "5\n"],
    ["CIE-120 MID counts from 1: MID('abcdef', 2, 3) = 'bcd'", 'OUTPUT MID("abcdef", 2, 3)', "bcd\n"],
    ["CIE-121 UCASE converts a letter to a capital", "OUTPUT UCASE('k')", "K\n"],
  ],
  files: [
    [
      "CIE-90 a written line is read back",
      L(
        "DECLARE S : STRING",
        'OPENFILE "f.txt" FOR WRITE',
        'WRITEFILE "f.txt", "hi"',
        'CLOSEFILE "f.txt"',
        'OPENFILE "f.txt" FOR READ',
        'READFILE "f.txt", S',
        'CLOSEFILE "f.txt"',
        "OUTPUT S",
      ),
      "hi\n",
    ],
    [
      "CIE-92 EOF ends a loop after two lines",
      L(
        "DECLARE S : STRING",
        'OPENFILE "f.txt" FOR WRITE',
        'WRITEFILE "f.txt", "a"',
        'WRITEFILE "f.txt", "b"',
        'CLOSEFILE "f.txt"',
        'OPENFILE "f.txt" FOR READ',
        'WHILE NOT EOF("f.txt") DO',
        '  READFILE "f.txt", S',
        "  OUTPUT S",
        "ENDWHILE",
        'CLOSEFILE "f.txt"',
      ),
      "a\nb\n",
    ],
    [
      "CIE-91 APPEND adds after the old line",
      L(
        "DECLARE S : STRING",
        'OPENFILE "f.txt" FOR WRITE',
        'WRITEFILE "f.txt", "x"',
        'CLOSEFILE "f.txt"',
        'OPENFILE "f.txt" FOR APPEND',
        'WRITEFILE "f.txt", "y"',
        'CLOSEFILE "f.txt"',
        'OPENFILE "f.txt" FOR READ',
        'WHILE NOT EOF("f.txt") DO',
        '  READFILE "f.txt", S',
        "  OUTPUT S",
        "ENDWHILE",
        'CLOSEFILE "f.txt"',
      ),
      "x\ny\n",
    ],
  ],
  exceptions: [
    [
      "CIE-100 TRY catches division by zero",
      L("DECLARE N : INTEGER", "TRY", "  N ← 1 DIV 0", "EXCEPT", '  OUTPUT "caught"', "ENDTRY"),
      "caught\n",
    ],
    [
      "CIE-100 EXCEPT is skipped when nothing fails",
      L("DECLARE N : INTEGER", "TRY", "  N ← 6 DIV 2", "EXCEPT", '  OUTPUT "caught"', "ENDTRY", "OUTPUT N"),
      "3\n",
    ],
    [
      "CIE-101 the program carries on after EXCEPT",
      L("TRY", "  OUTPUT 1 DIV 0", "EXCEPT", '  OUTPUT "a"', "ENDTRY", 'OUTPUT "b"'),
      "a\nb\n",
    ],
  ],
  classes: [
    [
      "CIE-110 a constructor sets a PRIVATE attribute read by a method",
      L(
        "CLASS C",
        "  PRIVATE V : INTEGER",
        "  PUBLIC PROCEDURE NEW(X : INTEGER)",
        "    V ← X",
        "  ENDPROCEDURE",
        "  PUBLIC FUNCTION Get() RETURNS INTEGER",
        "    RETURN V",
        "  ENDFUNCTION",
        "ENDCLASS",
        "DECLARE O : C",
        "O ← NEW C(8)",
        "OUTPUT O.Get()",
      ),
      "8\n",
    ],
    [
      "CIE-113 an inherited method is available on the child",
      L(
        "CLASS A",
        "  PUBLIC FUNCTION Hi() RETURNS STRING",
        '    RETURN "hi"',
        "  ENDFUNCTION",
        "ENDCLASS",
        "CLASS B INHERITS A",
        "ENDCLASS",
        "DECLARE O : B",
        "O ← NEW B()",
        "OUTPUT O.Hi()",
      ),
      "hi\n",
    ],
    [
      "CIE-116 an overriding method wins",
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
  ],
};

for (const [topic, rows] of Object.entries(TOPICS)) {
  describe(`MISC CIE exam corpus: ${topic}`, () => {
    it("MISC the topic has at least 3 programs", () => {
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });
    it.each(rows)("%s", async (_name, source, stdout) => {
      const r = await run(source);
      expect([r.errors, r.stdout]).toEqual([[], stdout]);
    });
  });
}

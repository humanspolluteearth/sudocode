// Quick reference content for Cambridge 9618 pseudocode (ported from the prototype's guide and corrected to the
// spec). Each snippet is a complete program, so cie-guide.test.ts can check that all of them are error-free.
export interface GuideSection {
  title: string;
  text: string;
  code: string;
}

const lines = (...rows: string[]): string => rows.join("\n") + "\n";

export const CIE_GUIDE: readonly GuideSection[] = [
  {
    title: "Variables and constants",
    text: "Declare every variable with a type before you use it. Assign with ← (you can type <- instead). Names are not case-sensitive. A constant is set to a literal with =.",
    code: lines("DECLARE Total : INTEGER", "DECLARE Name : STRING", "CONSTANT VAT = 0.2", "Total ← 0", 'Name ← "Sam"'),
  },
  {
    title: "Input and output",
    text: "OUTPUT prints its items joined together. INPUT stores what the user types in a variable, converted to its type.",
    code: lines("DECLARE Age : INTEGER", 'OUTPUT "Age?"', "INPUT Age", 'OUTPUT "Next year: ", Age + 1'),
  },
  {
    title: "Selection",
    text: "IF ... THEN ... ELSE ... ENDIF, and CASE OF with single values, ranges (TO) and OTHERWISE.",
    code: lines(
      "DECLARE Choice : INTEGER",
      "Choice ← 2",
      "IF Choice > 1",
      "  THEN",
      '    OUTPUT "big"',
      "  ELSE",
      '    OUTPUT "small"',
      "ENDIF",
      "CASE OF Choice",
      '  1 : OUTPUT "one"',
      '  2 TO 5 : OUTPUT "two to five"',
      '  OTHERWISE : OUTPUT "other"',
      "ENDCASE",
    ),
  },
  {
    title: "Loops",
    text: "FOR counts from start to end inclusive (STEP is optional). WHILE tests first; REPEAT ... UNTIL always runs once.",
    code: lines(
      "DECLARE I, N : INTEGER",
      "FOR I ← 1 TO 9 STEP 2",
      "  OUTPUT I",
      "NEXT I",
      "N ← 3",
      "WHILE N > 0 DO",
      "  N ← N - 1",
      "ENDWHILE",
      "REPEAT",
      "  N ← N + 1",
      "UNTIL N >= 3",
    ),
  },
  {
    title: "Arrays",
    text: "Set the bounds in the DECLARE as lower:upper. A 2D array takes row, column. Reading an item that has no value yet is an error.",
    code: lines(
      "DECLARE Scores : ARRAY[1:5] OF INTEGER",
      "DECLARE Grid : ARRAY[1:3, 1:3] OF CHAR",
      "Scores[1] ← 12",
      "Grid[2, 3] ← 'X'",
    ),
  },
  {
    title: "Procedures and functions",
    text: "Run a procedure with CALL. A function says what it RETURNS. BYVAL (the default) passes a copy; BYREF lets a procedure change the caller's variable.",
    code: lines(
      "PROCEDURE Swap(BYREF A : INTEGER, BYREF B : INTEGER)",
      "  DECLARE T : INTEGER",
      "  T ← A",
      "  A ← B",
      "  B ← T",
      "ENDPROCEDURE",
      "FUNCTION Square(N : INTEGER) RETURNS INTEGER",
      "  RETURN N * N",
      "ENDFUNCTION",
      "DECLARE X, Y : INTEGER",
      "X ← 1",
      "Y ← Square(3)",
      "CALL Swap(X, Y)",
    ),
  },
  {
    title: "Records and enumerated types",
    text: "TYPE ... ENDTYPE groups fields into a record. An enumerated type lists its values in order.",
    code: lines(
      "TYPE TPupil",
      "  DECLARE Name : STRING",
      "  DECLARE Year : INTEGER",
      "ENDTYPE",
      "TYPE TSeason = (Spring, Summer, Autumn, Winter)",
      "DECLARE P : TPupil",
      "DECLARE S : TSeason",
      'P.Name ← "Ama"',
      "S ← Summer",
    ),
  },
  {
    title: "Text files",
    text: "Open a file FOR READ, WRITE or APPEND, then READFILE or WRITEFILE, and CLOSEFILE when done. EOF(name) is TRUE at the end.",
    code: lines(
      "DECLARE Line : STRING",
      'OPENFILE "a.txt" FOR WRITE',
      'WRITEFILE "a.txt", "hello"',
      'CLOSEFILE "a.txt"',
      'OPENFILE "a.txt" FOR READ',
      'WHILE NOT EOF("a.txt") DO',
      '  READFILE "a.txt", Line',
      "  OUTPUT Line",
      "ENDWHILE",
      'CLOSEFILE "a.txt"',
    ),
  },
  {
    title: "Errors: TRY and EXCEPT",
    text: "A runtime error inside TRY runs the EXCEPT part instead of stopping the program. There is no FINALLY.",
    code: lines("DECLARE N : INTEGER", "TRY", "  N ← 1 DIV 0", "EXCEPT", '  OUTPUT "Cannot divide by zero"', "ENDTRY"),
  },
  {
    title: "Classes",
    text: "A class has PRIVATE and PUBLIC members. NEW is the constructor; INHERITS builds on another class; SUPER reaches the parent's version.",
    code: lines(
      "CLASS Counter",
      "  PRIVATE Count : INTEGER",
      "  PUBLIC PROCEDURE NEW()",
      "    Count ← 0",
      "  ENDPROCEDURE",
      "  PUBLIC PROCEDURE Add(N : INTEGER)",
      "    Count ← Count + N",
      "  ENDPROCEDURE",
      "ENDCLASS",
      "DECLARE C : Counter",
      "C ← NEW Counter()",
      "C.Add(5)",
    ),
  },
];

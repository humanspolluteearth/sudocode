// More converter text rows (CNV-12..24). Expected text is written by hand from docs/language-spec/converter.md and the
// Edexcel/Cambridge loop rows (EDX-50..57, CIE loops), never copied from what the converter prints.
import { describe, expect, it } from "vitest";
import { convert } from "../../src/converter/index.ts";

type Dir = "edexcel>cie" | "cie>edexcel";
const run = (dir: Dir, source: string) => {
  const [from, to] = dir.split(">") as ["edexcel" | "cie", "edexcel" | "cie"];
  return convert(source, from, to);
};
const ok = (dir: Dir, source: string): string => {
  const r = run(dir, source);
  if (!r.ok) throw new Error(`refused: ${r.message}`);
  return r.code;
};
const refusal = (dir: Dir, source: string) => {
  const r = run(dir, source);
  if (r.ok) throw new Error(`expected a refusal, got:\n${r.code}`);
  return r;
};
const HEAD_CIE = "// Converted from Edexcel pseudocode by Sudocode.\n\n";
const HEAD_EDX = "# Converted from Cambridge pseudocode by Sudocode.\n\n";

describe("CNV-12..16 Edexcel to Cambridge, more rows", () => {
  it("CNV-12 an array of text gets ARRAY[0:n-1] OF STRING", () => {
    expect(ok("edexcel>cie", "SET names TO ['a', 'b']\nSEND names[0] TO DISPLAY\n")).toBe(
      `${HEAD_CIE}DECLARE names : ARRAY[0:1] OF STRING\nnames[0] <- "a"\nnames[1] <- "b"\nOUTPUT names[0]\n`,
    );
  });

  it("CNV-13 a BOOLEAN joined with text goes through an IF into a fresh STRING variable", () => {
    const code = ok("edexcel>cie", "SET ok TO TRUE\nSEND 'ok is ' & ok TO DISPLAY\n");
    expect(code).toMatch(/DECLARE \w+ : STRING\n/);
    expect(code).toMatch(/IF ok THEN\n {2}(\w+) <- "TRUE"\nELSE\n {2}\1 <- "FALSE"\nENDIF\n/);
    expect(code).toMatch(/OUTPUT "ok is " & \w+\n$/);
  });

  it("CNV-14 two REPEAT loops get two different counters", () => {
    expect(
      ok(
        "edexcel>cie",
        "REPEAT 2 TIMES\n    SEND 'a' TO DISPLAY\nEND REPEAT\nREPEAT 3 TIMES\n    SEND 'b' TO DISPLAY\nEND REPEAT\n",
      ),
    ).toBe(
      `${HEAD_CIE}DECLARE i_1 : INTEGER\nDECLARE i_2 : INTEGER\nFOR i_1 <- 1 TO 2\n  OUTPUT "a"\nNEXT i_1\nFOR i_2 <- 1 TO 3\n  OUTPUT "b"\nNEXT i_2\n`,
    );
  });
});

describe("CNV-22..24 Cambridge to Edexcel, more rows", () => {
  it("CNV-22 an array that starts at 5 shifts every index by 5", () => {
    expect(ok("cie>edexcel", 'DECLARE T : ARRAY[5:7] OF STRING\nT[5] <- "a"\nOUTPUT T[7]\n')).toBe(
      `${HEAD_EDX}SET T TO ['', '', '']\nSET T[0] TO 'a'\nSEND T[2] TO DISPLAY\n`,
    );
  });

  it("CNV-22 an array with bounds that are not constants is refused", () => {
    const r = refusal("cie>edexcel", "DECLARE n : INTEGER\nn <- 3\nDECLARE T : ARRAY[1:n] OF INTEGER\n");
    expect(r.line).toBe(3);
  });

  it("CNV-24 WHILE maps to WHILE ... DO ... END WHILE", () => {
    expect(ok("cie>edexcel", "DECLARE n : INTEGER\nn <- 0\nWHILE n < 3 DO\n  n <- n + 1\nENDWHILE\n")).toBe(
      `${HEAD_EDX}SET n TO 0\nWHILE n < 3 DO\n    SET n TO n + 1\nEND WHILE\n`,
    );
  });

  it("CNV-24 REPEAT ... UNTIL maps to REPEAT ... UNTIL", () => {
    expect(ok("cie>edexcel", "DECLARE n : INTEGER\nn <- 0\nREPEAT\n  n <- n + 1\nUNTIL n = 3\n")).toBe(
      `${HEAD_EDX}SET n TO 0\nREPEAT\n    SET n TO n + 1\nUNTIL n = 3\n`,
    );
  });

  it("CNV-24 FOR with STEP keeps its STEP", () => {
    expect(ok("cie>edexcel", "DECLARE I : INTEGER\nFOR I <- 1 TO 9 STEP 2\n  OUTPUT I\nNEXT I\n")).toBe(
      `${HEAD_EDX}FOR I FROM 1 TO 9 STEP 2 DO\n    SEND I TO DISPLAY\nEND FOR\n`,
    );
  });

  it("CNV-24 IF ... ELSE maps to IF ... ELSE ... END IF", () => {
    expect(ok("cie>edexcel", "DECLARE n : INTEGER\nn <- 1\nIF n = 1 THEN\n  OUTPUT 1\nELSE\n  OUTPUT 2\nENDIF\n")).toBe(
      `${HEAD_EDX}SET n TO 1\nIF n = 1 THEN\n    SEND 1 TO DISPLAY\nELSE\n    SEND 2 TO DISPLAY\nEND IF\n`,
    );
  });

  it("CNV-24 CASE has no Edexcel form (edexcel.md), so it becomes the IF chain that does the same", () => {
    expect(
      ok("cie>edexcel", "DECLARE n : INTEGER\nn <- 1\nCASE OF n\n  1: OUTPUT 1\n  OTHERWISE: OUTPUT 2\nENDCASE\n"),
    ).toBe(`${HEAD_EDX}SET n TO 1\nIF n = 1 THEN\n    SEND 1 TO DISPLAY\nELSE\n    SEND 2 TO DISPLAY\nEND IF\n`);
  });
});

describe("CNV-07 converting a converted file again", () => {
  it("CNV-07 Edexcel to Cambridge and back keeps one header, not two", () => {
    const there = ok("edexcel>cie", "SET n TO 3\nSEND n TO DISPLAY\n");
    const back = ok("cie>edexcel", there);
    expect(back).toBe(`${HEAD_EDX}SET n TO 3\nSEND n TO DISPLAY\n`);
  });

  it("CNV-07 a comment of the student's next to the old header survives", () => {
    const there = ok("edexcel>cie", "# the total\nSET n TO 3\n");
    expect(ok("cie>edexcel", there)).toBe(`${HEAD_EDX}# the total\nSET n TO 3\n`);
  });

  it("CNV-07 Cambridge to Python drops an old Sudocode header too", () => {
    const there = ok("edexcel>cie", "SET n TO 3\n");
    const r = convert(there, "cie", "python");
    expect(r.ok && r.code.match(/Converted from/g)?.length).toBe(1);
  });
});

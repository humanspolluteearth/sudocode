import { describe, expect, it } from "vitest";
import { run } from "../../tests/support/run-ir.ts";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

/** Runs a Cambridge program and gives what it printed (or its error codes). */
async function output(source: string): Promise<string> {
  const { program, diagnostics } = analyse(source);
  if (program === null || diagnostics.length > 0) return diagnostics.map((d) => d.code).join(",");
  const out = await run(program, { language: "cie", seed: 1 });
  return out.errors.length > 0 ? out.errors.join(",") : out.stdout;
}

describe("CIE built-ins (values)", () => {
  it("CIE-120 LEFT, RIGHT and MID count characters from 1", async () => {
    expect(await output('OUTPUT LEFT("Programming", 3), RIGHT("Programming", 3), MID("Programming", 4, 4)')).toBe(
      "Proinggram\n",
    );
  });
  it("CIE-120 LENGTH counts the characters of a STRING", async () => {
    expect(await output('OUTPUT LENGTH("hello")')).toBe("5\n");
  });
  it("CIE-120 asking for more characters than there are is a runtime error", async () => {
    expect(await output('OUTPUT LEFT("abc", 4)')).toBe("E-RUN-BAD-ARGUMENT 1");
    expect(await output('OUTPUT MID("abc", 3, 2)')).toBe("E-RUN-BAD-ARGUMENT 1");
  });
  it("CIE-122 TO_UPPER and TO_LOWER keep the argument's type", async () => {
    expect(await output("OUTPUT TO_UPPER(\"a b1\"), TO_LOWER('Q')")).toBe("A B1q\n");
  });
  it("CIE-127 INT drops the fraction toward zero", async () => {
    expect(await output("OUTPUT INT(3.9), INT(-3.9)")).toBe("3-3\n");
  });
  it("CIE-126 ASC and CHR are inverses for ASCII", async () => {
    expect(await output("OUTPUT ASC('A'), CHR(97)")).toBe("65a\n");
  });
  it("CIE-126 CHR of a number that is not an ASCII code is a runtime error", async () => {
    expect(await output("OUTPUT CHR(300)")).toBe("E-RUN-BAD-ARGUMENT 1");
  });
  it("CIE-124 STR_TO_NUM of text that is not a number is a runtime error", async () => {
    expect(await output('OUTPUT STR_TO_NUM("12a")')).toBe("E-RUN-BAD-ARGUMENT 1");
  });
  it("CIE-125 IS_NUM accepts a sign and a point only in the right places", async () => {
    expect(await output('OUTPUT IS_NUM("-3"), IS_NUM("3."), IS_NUM("")')).toBe("TRUEFALSEFALSE\n");
  });
  it("CIE-129 SETDATE of a day that doesn't exist is a runtime error", async () => {
    expect(await output("OUTPUT SETDATE(31, 4, 2026)")).toBe("E-RUN-BAD-ARGUMENT 1");
  });
  it("CIE-129 a DATE prints as dd/mm/yyyy, and a leap day exists in 2028", async () => {
    expect(await output('OUTPUT SETDATE(5, 3, 2026), " ", SETDATE(29, 2, 2028)')).toBe("05/03/2026 29/02/2028\n");
  });
  it("CIE-129 DAYINDEX counts Sunday as 1", async () => {
    expect(await output("OUTPUT DAYINDEX(SETDATE(22, 11, 2026))")).toBe("1\n");
  });
  it("CIE-128 RAND(0) is 0 and a negative limit is an error", async () => {
    expect(await output("OUTPUT RAND(0)")).toBe("0\n");
    expect(await output("OUTPUT RAND(-1)")).toBe("E-RUN-BAD-ARGUMENT 1");
  });
});

describe("CIE built-ins (checker)", () => {
  it("CIE-120 a function that does not exist is E-CHK-UNKNOWN-FUNCTION", () => {
    expect(codes('OUTPUT SUBSTRING("abc", 1, 1)')).toEqual(["E-CHK-UNKNOWN-FUNCTION 1:8"]);
  });
  it("CIE-121 UCASE of a STRING variable points at TO_UPPER", () => {
    expect(codes('DECLARE W : STRING\nW <- "ab"\nOUTPUT UCASE(W)')).toEqual(["E-CHK-ARG-TYPE 3:14"]);
  });
  it("CIE-120 the wrong number of arguments is E-CHK-ARG-COUNT", () => {
    expect(codes('OUTPUT LEFT("abc")')).toEqual(["E-CHK-ARG-COUNT 1:8"]);
  });
  it("CIE-129 DATE is a type of its own", () => {
    expect(codes("DECLARE D : DATE\nD <- 5")).toEqual(["E-CHK-TYPE-CHANGE 2:6"]);
  });
  it("CIE-124 STR_TO_NUM gives a REAL, so it cannot go straight into an INTEGER", () => {
    expect(codes('DECLARE N : INTEGER\nN <- STR_TO_NUM("5")')).toEqual(["E-CHK-TYPE-CHANGE 2:6"]);
  });
});

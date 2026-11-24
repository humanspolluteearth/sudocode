import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("CIE names", () => {
  it("CIE-03 the same name in another case is the same variable, with a warning at the odd spelling", () => {
    expect(codes("DECLARE Total : INTEGER\ntotal <- 1\nOUTPUT TOTAL")).toEqual([
      "W-CIE-NAME-CASE 2:1",
      "W-CIE-NAME-CASE 3:8",
    ]);
  });
  it("CIE-11 an undeclared name is reported once, at its first use", () => {
    expect(codes("Y <- 1\nY <- 2\nOUTPUT Y")).toEqual(["E-CHK-UNDECLARED 1:1"]);
  });
  it("CIE-45 joining a number with & is reported at the &", () => {
    expect(codes('DECLARE N : INTEGER\nOUTPUT "a" & N')).toEqual(["E-CHK-CONCAT-NUMBER 2:12"]);
  });
});

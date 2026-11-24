import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);
const T = "TYPE T\n  DECLARE F : INTEGER\nENDTYPE\nDECLARE V : T\n";

describe("CIE records and enumerated types (checker)", () => {
  it("CIE-30 a field the type does not have is an error at the field", () => {
    expect(codes(`${T}V.G <- 1`)).toEqual(["E-CHK-NO-FIELD 5:3"]);
  });
  it("CIE-30 a dot after a non-record is an error", () => {
    expect(codes("DECLARE N : INTEGER\nN.F <- 1")).toEqual(["E-CHK-NOT-RECORD 2:3"]);
  });
  it("CIE-30 a field takes only values of its type", () => {
    expect(codes(`${T}V.F <- "x"`)).toEqual(["E-CHK-TYPE-CHANGE 5:8"]);
  });
  it("CIE-30 a record is assigned whole only from its own type", () => {
    expect(codes(`${T}DECLARE N : INTEGER\nV <- N`)).toEqual(["E-CHK-TYPE-CHANGE 6:6"]);
  });
  it("CIE-31 a value of an enumerated type is not an INTEGER", () => {
    expect(codes("TYPE S = (A, B)\nDECLARE X : S\nX <- 1")).toEqual(["E-CHK-TYPE-CHANGE 3:6"]);
  });
  it("CIE-31 values of different enumerated types are not comparable", () => {
    expect(codes("TYPE S = (A, B)\nTYPE U = (C, D)\nDECLARE X : S\nDECLARE Y : U\nOUTPUT X = Y")).toEqual([
      "E-CHK-COMPARE-TYPES 5:10",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("CIE arrays (checker)", () => {
  it("CIE-20 any integer bounds are accepted", () => {
    expect(
      codes("DECLARE A : ARRAY[0:4] OF INTEGER\nDECLARE B : ARRAY[-2:2] OF REAL\nA[0] <- 1\nB[-2] <- 1.5"),
    ).toEqual([]);
  });
  it("CIE-20 a last index below the first is an error", () => {
    expect(codes("DECLARE A : ARRAY[3:1] OF INTEGER")).toEqual(["E-SYN-EXPECTED 1:21"]);
  });
  it("CIE-20 an item must fit the array's type", () => {
    expect(codes('DECLARE A : ARRAY[1:2] OF INTEGER\nA[1] <- "x"')).toEqual(["E-CHK-TYPE-CHANGE 2:9"]);
  });
  it("CIE-21 a 2D array needs two indexes", () => {
    expect(codes("DECLARE B : ARRAY[1:3, 1:3] OF CHAR\nB[1] <- 'x'")).toEqual(["E-SYN-EXPECTED 2:4"]);
  });
  it("CIE-22 an index must be an INTEGER", () => {
    expect(codes('DECLARE A : ARRAY[1:2] OF INTEGER\nA["a"] <- 1')).toEqual(["E-CHK-NEEDS-INTEGER 2:3"]);
  });
  it("CIE-23 whole-array assignment needs the same size", () => {
    expect(codes("DECLARE A : ARRAY[1:2] OF INTEGER\nDECLARE B : ARRAY[1:3] OF INTEGER\nB <- A")).toEqual([
      "E-CHK-TYPE-CHANGE 3:6",
    ]);
  });
  it("CIE-23 whole-array assignment needs the same item type", () => {
    expect(codes("DECLARE A : ARRAY[1:2] OF INTEGER\nDECLARE B : ARRAY[1:2] OF STRING\nB <- A")).toEqual([
      "E-CHK-TYPE-CHANGE 3:6",
    ]);
  });
  it("CIE-20 a name that is not an array cannot be indexed", () => {
    expect(codes("DECLARE N : INTEGER\nN[1] <- 2")).toEqual(["E-CHK-NOT-INDEXABLE 2:1"]);
  });
  it("CIE-21 a 2D array may have different first indexes in each dimension", () => {
    expect(codes("DECLARE B : ARRAY[1:3, 0:2] OF CHAR")).toEqual([]);
  });
  it("CIE-21 three dimensions are still not supported", () => {
    expect(codes("DECLARE B : ARRAY[1:2, 1:2, 1:2] OF CHAR")).toEqual(["E-SYN-NOT-SUPPORTED 1:13"]);
  });
});

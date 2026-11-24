import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("CIE file statements (checker)", () => {
  it.each(["READ", "WRITE", "APPEND", "RANDOM"])("CIE-90 OPENFILE FOR %s is accepted", (mode) => {
    expect(codes(`OPENFILE "a.txt" FOR ${mode}\nCLOSEFILE "a.txt"`)).toEqual([]);
  });
  it("CIE-90 an unknown mode is a syntax error at the mode word", () => {
    expect(codes('OPENFILE "a.txt" FOR SPIN')).toEqual(["E-SYN-EXPECTED 1:22"]);
  });
  it("CIE-90 the file name must be STRING", () => {
    expect(codes("OPENFILE 5 FOR READ")).toEqual(["E-CHK-ARG-TYPE 1:10"]);
  });
  it("CIE-93 READFILE reads into a STRING variable only", () => {
    expect(codes('DECLARE N : INTEGER\nREADFILE "a.txt", N')).toEqual(["E-CHK-ARG-TYPE 2:19"]);
  });
  it("CIE-93 READFILE into an undeclared name is reported once", () => {
    expect(codes('READFILE "a.txt", Line')).toEqual(["E-CHK-UNDECLARED 1:19"]);
  });
  it("CIE-94 SEEK takes an INTEGER address", () => {
    expect(codes('SEEK "a.dat", "x"')).toEqual(["E-CHK-NEEDS-INTEGER 1:15"]);
  });
  it("CIE-130 EOF is a BOOLEAN function of the file name", () => {
    expect(codes('OPENFILE "a.txt" FOR READ\nWHILE NOT EOF("a.txt")\n  OUTPUT 1\nENDWHILE')).toEqual([]);
  });
});

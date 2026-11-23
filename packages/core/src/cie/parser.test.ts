import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("CIE translator", () => {
  it("CIE-51 END IF is accepted with a warning", () => {
    expect(codes("IF TRUE THEN\n  OUTPUT 1\nEND IF")).toEqual(["W-CIE-ENDIF 3:1"]);
  });
  it("CIE-12 assigning to a constant is a checker error", () => {
    expect(codes("CONSTANT Max = 1\nMax <- 2")).toEqual(["E-CHK-CONSTANT-ASSIGN 2:1"]);
  });
  it("CIE-70 a procedure may be called before it is defined", () => {
    expect(codes("CALL P()\nPROCEDURE P()\nOUTPUT 1\nENDPROCEDURE")).toEqual([]);
  });
  it("MISC an unclosed IF is reported once", () => {
    expect(codes("IF TRUE THEN\nOUTPUT 1")).toEqual(["E-SYN-BLOCK-NOT-CLOSED 1:1"]);
  });
});

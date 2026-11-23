import { describe, expect, it } from "vitest";
import { lex } from "./lexer.ts";

const codes = (source: string): string[] =>
  lex(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("CIE lexer", () => {
  it("CIE-05 .5 is a REAL with a warning at its start", () => {
    expect(codes("R <- .5")).toEqual(["W-CIE-REAL-FORM 1:6"]);
  });
  it("CIE-07 a single-quoted string of several characters warns", () => {
    expect(codes("X <- 'ab'")).toEqual(["W-CIE-SINGLE-QUOTES 1:6"]);
  });
  it("CIE-07 a single-quoted single character is a CHAR and does not warn", () => {
    expect(codes("X <- 'a'")).toEqual([]);
  });
  it("CIE-01 a // comment runs to the end of the line", () => {
    const kinds = lex("OUTPUT 1 // hi").tokens.map((t) => t.kind);
    expect(kinds).toEqual(["word", "int", "newline", "eof"]);
  });
});

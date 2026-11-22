import { describe, expect, it } from "vitest";
import {
  compareDiagnostics,
  isDiagnosticCode,
  positionAt,
  severityOf,
  sortDiagnostics,
  spanOf,
  type Diagnostic,
} from "./diagnostics.ts";

const diag = (over: Partial<Diagnostic>): Diagnostic => ({
  code: "E-RUN-DIV-ZERO",
  line: 1,
  column: 1,
  message: "m",
  hint: "h",
  severity: "error",
  ...over,
});

describe("MISC diagnostic codes", () => {
  it.each([
    ["E-RUN-DIV-ZERO", "error"],
    ["E-CHK-SEND-ARRAY", "error"],
    ["E-PY-ZeroDivisionError", "error"],
    ["W-EDX-DOUBLE-QUOTES", "warning"],
    ["I-EDX-ARRAY-GROWS", "info"],
  ])("MISC %s has severity %s", (code, severity) => {
    expect(severityOf(code)).toBe(severity);
  });

  it.each(["", "E", "X-RUN-DIV-ZERO", "E-run-div-zero", "E-RUN-", "W-PY-SyntaxWarning", "E-RUN--ZERO"])(
    "MISC rejects the malformed code %j",
    (code) => {
      expect(isDiagnosticCode(code)).toBe(false);
      expect(() => severityOf(code)).toThrow(/Not a diagnostic code/);
    },
  );
});

describe("MISC positions in the student's source", () => {
  const source = "SET a TO 1\nSEND a TO DISPLAY\n";

  it.each([
    [0, 1, 1],
    [4, 1, 5],
    [10, 1, 11], // the \n that ends line 1
    [11, 2, 1],
    [16, 2, 6],
    [source.length, 3, 1],
  ])("MISC offset %i is line %i, column %i", (offset, line, column) => {
    expect(positionAt(source, offset)).toEqual({ line, column });
  });

  it("MISC treats \\r\\n as one line break", () => {
    const crlf = "SET a TO 1\r\nSEND a TO DISPLAY";
    expect(positionAt(crlf, 12)).toEqual({ line: 2, column: 1 });
    expect(positionAt(crlf, 17)).toEqual({ line: 2, column: 6 });
    // The \r and the \n both still belong to line 1.
    expect(positionAt(crlf, 10)).toEqual({ line: 1, column: 11 });
    expect(positionAt(crlf, 11)).toEqual({ line: 1, column: 11 });
  });

  it("MISC counts columns in characters, not UTF-16 units", () => {
    // "😀" is two UTF-16 units but one character on screen.
    const s = "x ← '😀' & y";
    // x, space, ←, space, ', 😀, ', space, &: the & is the 9th character, at UTF-16 offset 9 (the emoji is 2 units).
    expect(positionAt(s, s.indexOf("&"))).toEqual({ line: 1, column: 9 });
    expect(s.indexOf("&")).toBe(9);
  });

  it("MISC rejects offsets outside the source", () => {
    expect(() => positionAt(source, -1)).toThrow(RangeError);
    expect(() => positionAt(source, source.length + 1)).toThrow(RangeError);
    expect(() => positionAt(source, 1.5)).toThrow(RangeError);
  });

  it("MISC a span starts at the line and column of its first character", () => {
    expect(spanOf(source, 16, 17)).toEqual({ line: 2, column: 6, start: 16, end: 17 });
  });

  it("MISC a span cannot end before it starts or past the source", () => {
    expect(() => spanOf(source, 5, 4)).toThrow(RangeError);
    expect(() => spanOf(source, 0, source.length + 1)).toThrow(RangeError);
  });
});

describe("MISC diagnostic order", () => {
  it("MISC sorts by line, then column, then severity, then code", () => {
    const list = [
      diag({ code: "W-B", line: 2, column: 1, severity: "warning" }),
      diag({ code: "I-A", line: 1, column: 5, severity: "info" }),
      diag({ code: "E-B", line: 1, column: 5 }),
      diag({ code: "E-A", line: 1, column: 5 }),
      diag({ code: "W-A", line: 1, column: 2, severity: "warning" }),
    ];
    expect(sortDiagnostics(list).map((d) => d.code)).toEqual(["W-A", "E-A", "E-B", "I-A", "W-B"]);
    expect(list[0]?.code).toBe("W-B"); // the input is not modified
  });

  it("MISC equal diagnostics compare as equal", () => {
    expect(compareDiagnostics(diag({}), diag({}))).toBe(0);
  });
});

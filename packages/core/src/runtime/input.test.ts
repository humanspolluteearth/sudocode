import { describe, expect, it } from "vitest";
import type { Span } from "../diagnostics.ts";
import { convertInput } from "./input.ts";
import { RunError } from "./run-error.ts";

const span: Span = { line: 3, column: 1, start: 0, end: 10 };

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    if (e instanceof RunError) return `${e.code} ${String(e.span.line)}:${String(e.span.column)}`;
    throw e;
  }
  return "no error";
}

describe("convertInput", () => {
  it("EDX-72 an INTEGER line becomes an INTEGER", () => {
    expect(convertInput("42", "int", span)).toEqual({ kind: "int", value: 42 });
    expect(convertInput("-7", "int", span)).toEqual({ kind: "int", value: -7 });
  });

  it("SH-06 an INTEGER line that isn't a whole number is E-RUN-INPUT-TYPE at the input line", () => {
    for (const line of ["", "3.5", "abc", "1,000", "--2"]) {
      expect(
        errorCode(() => convertInput(line, "int", span)),
        line,
      ).toBe("E-RUN-INPUT-TYPE 3:1");
    }
  });

  it("SH-07 an INTEGER input too large for an INTEGER is E-RUN-NUMBER-TOO-LARGE", () => {
    expect(errorCode(() => convertInput("99999999999999999999", "int", span))).toBe("E-RUN-NUMBER-TOO-LARGE 3:1");
  });

  it("EDX-72 a REAL line becomes a REAL, a whole number included", () => {
    expect(convertInput("2.5", "real", span)).toEqual({ kind: "real", value: 2.5 });
    expect(convertInput("3", "real", span)).toEqual({ kind: "real", value: 3 });
  });

  it("SH-06 a REAL line that isn't a number is E-RUN-INPUT-TYPE", () => {
    for (const line of ["", "inf", "nan", "two", "1.2.3"]) {
      expect(
        errorCode(() => convertInput(line, "real", span)),
        line,
      ).toBe("E-RUN-INPUT-TYPE 3:1");
    }
  });

  it("EDX-72 a BOOLEAN line is TRUE or FALSE", () => {
    expect(convertInput("TRUE", "bool", span)).toEqual({ kind: "bool", value: true });
    expect(convertInput("FALSE", "bool", span)).toEqual({ kind: "bool", value: false });
    expect(errorCode(() => convertInput("T", "bool", span))).toBe("E-RUN-INPUT-TYPE 3:1");
  });

  it("EDX-72 a CHARACTER line is exactly one character", () => {
    expect(convertInput("A", "char", span)).toEqual({ kind: "char", value: "A" });
    expect(errorCode(() => convertInput("", "char", span))).toBe("E-RUN-INPUT-TYPE 3:1");
    expect(errorCode(() => convertInput("AB", "char", span))).toBe("E-RUN-INPUT-TYPE 3:1");
  });

  it("SH-05 a STRING line is kept exactly as typed", () => {
    expect(convertInput("  hello  ", "str", span)).toEqual({ kind: "str", value: "  hello  " });
    expect(convertInput("", "str", span)).toEqual({ kind: "str", value: "" });
  });

  it("SH-07 the INTEGER input range ends at ±9,007,199,254,740,991 (D12)", () => {
    expect(convertInput("9007199254740991", "int", span)).toEqual({ kind: "int", value: 9007199254740991 });
    expect(convertInput("-9007199254740991", "int", span)).toEqual({ kind: "int", value: -9007199254740991 });
    expect(errorCode(() => convertInput("9007199254740992", "int", span))).toBe("E-RUN-NUMBER-TOO-LARGE 3:1");
    expect(errorCode(() => convertInput("-9007199254740992", "int", span))).toBe("E-RUN-NUMBER-TOO-LARGE 3:1");
  });

  it.each([
    [" 42 ", "int", { kind: "int", value: 42 }],
    ["+5", "int", { kind: "int", value: 5 }],
    ["007", "int", { kind: "int", value: 7 }],
    [" 2.5 ", "real", { kind: "real", value: 2.5 }],
    [".5", "real", { kind: "real", value: 0.5 }],
    ["5.", "real", { kind: "real", value: 5 }],
    ["1e3", "real", { kind: "real", value: 1000 }],
    ["-2.5E-1", "real", { kind: "real", value: -0.25 }],
    [" true ", "bool", { kind: "bool", value: true }],
    ["False", "bool", { kind: "bool", value: false }],
  ] as const)("SH-06 D1/D2/D11 %j as %s is accepted", (line, type, value) => {
    expect(convertInput(line, type, span)).toEqual(value);
  });

  it.each([
    ["Infinity", "real"],
    ["0x10", "real"],
    ["1_0", "real"],
    ["0x10", "int"],
    ["+-5", "int"],
  ] as const)("SH-06 D11 %j as %s is E-RUN-INPUT-TYPE", (line, type) => {
    expect(errorCode(() => convertInput(line, type, span))).toBe("E-RUN-INPUT-TYPE 3:1");
  });

  it("EDX-72 a CHARACTER line is not trimmed, and one emoji is one character", () => {
    expect(convertInput(" ", "char", span)).toEqual({ kind: "char", value: " " });
    expect(errorCode(() => convertInput("A ", "char", span))).toBe("E-RUN-INPUT-TYPE 3:1");
    expect(convertInput("😀", "char", span)).toEqual({ kind: "char", value: "😀" });
  });
});

import { describe, expect, it } from "vitest";
import type { BinaryOp } from "../ir/ir.ts";
import { binary, floorDivMod, unary } from "./ops.ts";
import { RunError } from "./run-error.ts";
import { bool, char, int, real, str, type Value } from "./values.ts";

const span = { line: 2, column: 9, start: 20, end: 21 };
const apply = (op: BinaryOp, a: Value, b: Value): Value => binary(op, "?", a, b, span, "pseudocode");
const codeOf = (f: () => unknown): string => {
  try {
    f();
  } catch (error) {
    return error instanceof RunError
      ? `${error.code} ${String(error.span.column)}`
      : `not a RunError: ${String(error)}`;
  }
  return "no error";
};

describe("SH-10 floor division and remainder", () => {
  it.each([
    [7, 2, 3, 1],
    [-7, 2, -4, 1],
    [7, -2, -4, -1],
    [-7, -2, 3, -1],
    [-6, 3, -2, 0],
    [0, 5, 0, 0],
    [9007199254740991, 2, 4503599627370495, 1],
    [-9007199254740991, 10, -900719925474100, 9],
  ])("SH-10 %d DIV/MOD %d = %d remainder %d", (a, b, q, r) => {
    expect(floorDivMod(a, b)).toEqual([q, r]);
    expect([apply("intDivFloor", int(a), int(b)), apply("modFloor", int(a), int(b))]).toEqual([int(q), int(r)]);
  });

  it("SH-10 a zero result is never -0", () => {
    expect(Object.is(floorDivMod(-6, 3)[1], 0)).toBe(true);
    expect(Object.is(floorDivMod(0, -5)[0], 0)).toBe(true);
  });
});

describe("SH-07 INTEGER range", () => {
  it.each([
    ["add", 9007199254740990, 1, 9007199254740991],
    ["sub", -9007199254740990, 1, -9007199254740991],
    ["mul", 94906265, 94906265, 9007199136250225],
  ] as const)("SH-07 %s stays an INTEGER up to the limit", (op, a, b, result) => {
    expect(apply(op, int(a), int(b))).toEqual(int(result));
  });

  it.each([
    ["add", 9007199254740991, 1],
    ["sub", -9007199254740991, 1],
    ["mul", 94906266, 94906266],
    ["powIntIfNonNegative", 2, 53],
    ["powIntIfNonNegative", 10, 100],
  ] as const)("SH-07 %s past the limit is E-RUN-NUMBER-TOO-LARGE at the operator", (op, a, b) => {
    expect(codeOf(() => apply(op, int(a), int(b)))).toBe("E-RUN-NUMBER-TOO-LARGE 9");
  });

  it("SH-07 with a REAL operand there is no INTEGER limit", () => {
    expect(apply("add", int(9007199254740991), real(1))).toEqual(real(9007199254740992));
  });
});

describe("EDX-30 the ^ operator", () => {
  it.each([
    [int(2), int(10), int(1024)],
    [int(2), int(0), int(1)],
    [int(0), int(0), int(1)],
    [int(0), int(3), int(0)],
    [int(-1), int(3), int(-1)],
    [int(-1), int(4), int(1)],
    [int(-2), int(3), int(-8)],
    [int(3), int(33), int(5559060566555523)],
    [int(2), int(-1), real(0.5)],
    [real(2), int(3), real(8)],
    [int(4), real(0.5), real(2)],
  ])("EDX-30 %j ^ %j = %j", (a, b, result) => {
    expect(apply("powIntIfNonNegative", a, b)).toEqual(result);
  });

  it("SH-09 0 ^ -1 divides by zero", () => {
    expect(codeOf(() => apply("powIntIfNonNegative", int(0), int(-1)))).toBe("E-RUN-DIV-ZERO 9");
  });
});

describe("SH-09 division by zero", () => {
  it.each([
    ["divReal", int(1), int(0)],
    ["divReal", real(1.5), real(0)],
    ["intDivFloor", int(7), int(0)],
    ["modFloor", int(7), int(0)],
  ] as const)("SH-09 %s by zero is E-RUN-DIV-ZERO at the operator", (op, a, b) => {
    expect(codeOf(() => apply(op, a, b))).toBe("E-RUN-DIV-ZERO 9");
  });

  it("EDX-14 / always gives a REAL", () => {
    expect([apply("divReal", int(7), int(2)), apply("divReal", int(6), int(2))]).toEqual([real(3.5), real(3)]);
  });
});

describe("EDX-13 and EDX-16 mixed operands", () => {
  it("EDX-13 INTEGER with INTEGER gives INTEGER; anything with a REAL gives REAL", () => {
    expect([apply("add", int(2), int(3)), apply("add", int(3), real(8.25)), apply("mul", real(2.5), int(4))]).toEqual([
      int(5),
      real(11.25),
      real(10),
    ]);
  });

  it("EDX-16 & turns a non-STRING into its printed text", () => {
    expect([
      apply("concatText", str("Age "), int(18)),
      apply("concatText", int(18), str(" years")),
      apply("concatText", str("Sum: "), real(0.1 + 0.2)),
      apply("concatText", str("Ready: "), bool(true)),
      apply("concatText", char("B"), str("ob")),
    ]).toEqual([str("Age 18"), str("18 years"), str("Sum: 0.3"), str("Ready: TRUE"), str("Bob")]);
  });
});

describe("EDX-32 comparisons", () => {
  it.each([
    ["lt", "apple", "banana", true],
    ["lt", "Apple", "apple", true],
    ["lt", "ab", "abc", true],
    ["gt", "b", "abc", true],
    ["eq", "abc", "ABC", false],
    ["ne", "abc", "abd", true],
    ["le", "abc", "abc", true],
    ["eq", "a ", "a", false],
    ["lt", "￿", "😀", true],
  ] as const)("EDX-32 '%s' %s '%s' is %s, by character code", (op, a, b, result) => {
    expect(apply(op, str(a), str(b))).toEqual(bool(result));
  });

  it("EDX-32 a CHARACTER compares with a one-character STRING by content", () => {
    expect(apply("eq", char("B"), str("B"))).toEqual(bool(true));
  });

  it("MISC numbers compare by value, INTEGER with REAL", () => {
    expect([apply("eq", int(3), real(3)), apply("lt", real(0.1 + 0.2), real(0.3))]).toEqual([bool(true), bool(false)]);
  });
});

describe("MISC unary operators", () => {
  it("MISC negate keeps the kind and never makes an INTEGER -0; NOT flips a BOOLEAN", () => {
    expect([
      unary("negate", int(5)),
      unary("negate", int(0)),
      unary("negate", real(2.5)),
      unary("not", bool(true)),
    ]).toEqual([int(-5), int(0), real(-2.5), bool(false)]);
    expect(Object.is((unary("negate", int(0)) as { value: number }).value, 0)).toBe(true);
  });

  it("MISC an operand of the wrong kind is an engine bug (plain Error), not a student error", () => {
    expect(codeOf(() => unary("not", int(1)))).toMatch(/^not a RunError/);
    expect(codeOf(() => apply("add", str("a"), int(1)))).toMatch(/^not a RunError/);
  });
});

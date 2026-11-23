import { describe, expect, it } from "vitest";
import { formatPseudocodeReal, formatValue, withoutExponent } from "./format.ts";
import { array, bool, char, int, real, str } from "./values.ts";

describe("SH-03 pseudocode REAL output", () => {
  it.each([
    [7 / 2, "3.5"],
    [6 / 2, "3"],
    [0.1 + 0.2, "0.3"],
    [1 / 3, "0.3333333333"],
    [2 / 3, "0.6666666667"],
    [100 / 7, "14.2857142857"],
    [-3.5, "-3.5"],
    [2.5, "2.5"],
    [0.125, "0.125"],
    [9007199254740992, "9007199254740992"],
  ])("SH-03 rounds %d to 10 decimal places and prints the shortest form: %s", (x, shown) => {
    expect(formatPseudocodeReal(x)).toBe(shown);
  });

  it.each([
    [-0.00000000001, "0"],
    [-0, "0"],
    [0.00000000004, "0"],
    [-0.00000000004, "0"],
  ])("SH-03 a REAL that rounds to zero prints 0, never -0 (%d)", (x, shown) => {
    expect(formatPseudocodeReal(x)).toBe(shown);
  });

  it.each([
    [1e21, "1000000000000000000000"],
    [1e22, "10000000000000000000000"],
    [-1e21, "-1000000000000000000000"],
    [1e-7, "0.0000001"],
    [1e-10, "0.0000000001"],
  ])("SH-03 never uses exponent form: %d prints as %s", (x, shown) => {
    expect(formatPseudocodeReal(x)).toBe(shown);
  });
});

describe("MISC rewriting JavaScript's exponent form as plain digits", () => {
  it.each([
    ["1e+21", "1000000000000000000000"],
    ["1.5e+21", "1500000000000000000000"],
    ["-2.25e+22", "-22500000000000000000000"],
    ["1e-7", "0.0000001"],
    ["1.5e-7", "0.00000015"],
    ["-4e-10", "-0.0000000004"],
    ["123.45", "123.45"],
  ])("MISC %s is %s", (from, to) => {
    expect(withoutExponent(from)).toBe(to);
  });
});

describe("SH-04 and other values in pseudocode", () => {
  it("SH-04 Booleans print as TRUE and FALSE", () => {
    expect([formatValue(bool(true), "pseudocode"), formatValue(bool(false), "pseudocode")]).toEqual(["TRUE", "FALSE"]);
  });

  it("SH-03 INTEGERs print all their digits, and zero is never -0", () => {
    expect([int(9007199254740991), int(-42), int(-0)].map((v) => formatValue(v, "pseudocode"))).toEqual([
      "9007199254740991",
      "-42",
      "0",
    ]);
  });

  it("MISC text prints as it is; a REAL through formatValue follows SH-03", () => {
    expect([str("Hi 'you'"), char("x"), real(0.1 + 0.2)].map((v) => formatValue(v, "pseudocode"))).toEqual([
      "Hi 'you'",
      "x",
      "0.3",
    ]);
  });

  it("MISC arrays show their elements, quoting text, for the debugger", () => {
    expect(formatValue(array([str("a"), int(2), undefined]), "pseudocode")).toBe("['a', 2, (no value)]");
  });
});

import { describe, expect, it } from "vitest";
import {
  arrayOf,
  BOOLEAN,
  CHARACTER,
  commonElement,
  fits,
  INTEGER,
  REAL,
  STRING,
  typeName,
  UNKNOWN,
  withArticle,
} from "./types.ts";

describe("EDX-12 which values fit a variable's type", () => {
  it.each([
    ["an INTEGER into a REAL", { ty: INTEGER }, REAL, true],
    ["a REAL into an INTEGER", { ty: REAL }, INTEGER, false],
    ["a STRING into a BOOLEAN", { ty: STRING }, BOOLEAN, false],
    ["a one-character literal into a CHARACTER (EDX-15)", { ty: STRING, oneCharacter: true }, CHARACTER, true],
    ["a longer STRING into a CHARACTER (EDX-15)", { ty: STRING }, CHARACTER, false],
    ["a CHARACTER into a STRING (QUESTIONS.md 24, proposed)", { ty: CHARACTER }, STRING, true],
    ["an array of INTEGER into an array of REAL", { ty: arrayOf(INTEGER) }, arrayOf(REAL), true],
    ["an array of STRING into an array of INTEGER (D10)", { ty: arrayOf(STRING) }, arrayOf(INTEGER), false],
    ["an unknown (already reported) value anywhere", { ty: UNKNOWN }, INTEGER, true],
  ])("EDX-12 %s: %s", (_what, value, into, ok) => {
    expect(fits(value, into)).toBe(ok);
  });
});

describe("EDX-25 the type array elements share", () => {
  it.each([
    [INTEGER, INTEGER, "INTEGER"],
    [INTEGER, REAL, "REAL"],
    [STRING, CHARACTER, "STRING"],
    [UNKNOWN, BOOLEAN, "BOOLEAN"],
    [INTEGER, STRING, "none"],
    [BOOLEAN, INTEGER, "none"],
  ])("EDX-25 %j with %j shares %s", (a, b, shared) => {
    const t = commonElement({ ty: a }, { ty: b });
    expect(t === null ? "none" : typeName(t)).toBe(shared);
  });
});

describe("MISC type names in messages", () => {
  it("MISC types read naturally, with the right article", () => {
    expect([INTEGER, REAL, arrayOf(STRING), arrayOf(UNKNOWN)].map(withArticle)).toEqual([
      "an INTEGER",
      "a REAL",
      "an array of STRING",
      "an array",
    ]);
  });
});

// The Cambridge 9618 built-in functions as the checker sees them (CIE-120 to CIE-129): each has a name, the kinds
// of argument it takes, and the type it returns. A table instead of one `if` per function keeps the rules in one
// place (and lets the checker give the same messages for all of them).
import type { BuiltinName } from "../ir/ir.ts";
import { BOOLEAN, CHAR, DATE, INTEGER, REAL, STRING, type Ty } from "./types.ts";

/** What an argument may be: `text` is a CHAR or a STRING, `number` an INTEGER or a REAL. */
export type ParamKind = "string" | "char" | "text" | "integer" | "number" | "date";

export interface BuiltinSignature {
  ir: BuiltinName;
  params: ParamKind[];
  /** The result type; `sameAsFirst` gives back the first argument's type (TO_UPPER of a CHAR is a CHAR, CIE-122). */
  returns: Ty | "sameAsFirst";
  /** UCASE/LCASE take only a CHAR; for a STRING the hint points at this STRING version. */
  stringVersion?: string;
}

export const BUILTINS: Readonly<Record<string, BuiltinSignature>> = {
  LENGTH: { ir: "length", params: ["string"], returns: INTEGER },
  LEFT: { ir: "left", params: ["string", "integer"], returns: STRING },
  RIGHT: { ir: "right", params: ["string", "integer"], returns: STRING },
  MID: { ir: "mid", params: ["string", "integer", "integer"], returns: STRING },
  UCASE: { ir: "ucase", params: ["char"], returns: CHAR, stringVersion: "TO_UPPER" },
  LCASE: { ir: "lcase", params: ["char"], returns: CHAR, stringVersion: "TO_LOWER" },
  TO_UPPER: { ir: "toUpper", params: ["text"], returns: "sameAsFirst" },
  TO_LOWER: { ir: "toLower", params: ["text"], returns: "sameAsFirst" },
  NUM_TO_STR: { ir: "numToStr", params: ["number"], returns: STRING },
  // The result is typed REAL because the text decides at run time; an INTEGER fits into a REAL, never the reverse.
  STR_TO_NUM: { ir: "strToNum", params: ["text"], returns: REAL },
  IS_NUM: { ir: "isNum", params: ["text"], returns: BOOLEAN },
  ASC: { ir: "asc", params: ["char"], returns: INTEGER },
  CHR: { ir: "chr", params: ["integer"], returns: CHAR },
  INT: { ir: "truncate", params: ["number"], returns: INTEGER },
  RAND: { ir: "randomReal", params: ["number"], returns: REAL },
  DAY: { ir: "day", params: ["date"], returns: INTEGER },
  MONTH: { ir: "month", params: ["date"], returns: INTEGER },
  YEAR: { ir: "year", params: ["date"], returns: INTEGER },
  DAYINDEX: { ir: "dayIndex", params: ["date"], returns: INTEGER },
  SETDATE: { ir: "setDate", params: ["integer", "integer", "integer"], returns: DATE },
  TODAY: { ir: "today", params: [], returns: DATE },
};

/** The type name shown in "needs a ... here". */
export const KIND_NAME: Readonly<Record<ParamKind, string>> = {
  string: "STRING",
  char: "CHAR",
  text: "CHAR or STRING",
  integer: "INTEGER",
  number: "INTEGER or REAL",
  date: "DATE",
};

/** Does an argument of type `ty` fit this kind? A one-character STRING fits a CHAR (CIE-49). */
export function fitsKind(kind: ParamKind, ty: Ty, oneChar: boolean): boolean {
  switch (kind) {
    case "string":
      return ty.kind === "STRING" || ty.kind === "CHAR";
    case "char":
      return ty.kind === "CHAR" || (ty.kind === "STRING" && oneChar);
    case "text":
      return ty.kind === "STRING" || ty.kind === "CHAR";
    case "integer":
      return ty.kind === "INTEGER";
    case "number":
      return ty.kind === "INTEGER" || ty.kind === "REAL";
    case "date":
      return ty.kind === "DATE";
  }
}

// Cambridge 9618 types as the checker sees them (CIE-10), and the assignment rule (CIE-13, CIE-49).
//
// Compiler concept: *static type checking*. Unlike Edexcel, CIE declares every variable's type (CIE-11), so the
// checker knows each type before it sees a use. `unknown` is the type of something already reported as an error,
// and fits everywhere, so one mistake gives one error.
export type Ty =
  | { kind: "INTEGER" }
  | { kind: "REAL" }
  | { kind: "CHAR" }
  | { kind: "STRING" }
  | { kind: "BOOLEAN" }
  | { kind: "DATE" }
  /** A fixed-size array (CIE-20): `dims` is the length of each dimension, `lows` the first index of each. */
  | { kind: "ARRAY"; of: Ty; lows: number[]; dims: number[] }
  /** A record type declared with TYPE ... ENDTYPE (CIE-30). */
  | { kind: "RECORD"; name: string; fields: { name: string; ty: Ty }[] }
  /** An enumerated type (CIE-31): its values in order. */
  | { kind: "ENUM"; name: string; names: string[] }
  | { kind: "unknown" };

export const INTEGER: Ty = { kind: "INTEGER" };
export const REAL: Ty = { kind: "REAL" };
export const CHAR: Ty = { kind: "CHAR" };
export const STRING: Ty = { kind: "STRING" };
export const BOOLEAN: Ty = { kind: "BOOLEAN" };
export const DATE: Ty = { kind: "DATE" };
export const UNKNOWN: Ty = { kind: "unknown" };

/** The scalar types a DECLARE or parameter can name in this slice, by their upper-case spelling. */
export const SCALAR_TYPES: Readonly<Record<string, Ty>> = { INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE };

export const isUnknown = (t: Ty): boolean => t.kind === "unknown";
export const isNumber = (t: Ty): boolean => t.kind === "INTEGER" || t.kind === "REAL";
export const isText = (t: Ty): boolean => t.kind === "STRING" || t.kind === "CHAR";

export const typeName = (t: Ty): string =>
  t.kind === "unknown"
    ? "unknown"
    : t.kind === "ARRAY"
      ? `ARRAY OF ${typeName(t.of)}`
      : t.kind === "RECORD" || t.kind === "ENUM"
        ? t.name
        : t.kind;

/** The same type: scalars by kind, user types by name (a TYPE name is unique), arrays by shape and item type. */
export function sameType(a: Ty, b: Ty): boolean {
  if (a.kind === "ARRAY" && b.kind === "ARRAY") {
    return a.dims.length === b.dims.length && a.dims.every((d, i) => d === b.dims[i]) && sameType(a.of, b.of);
  }
  if ((a.kind === "RECORD" && b.kind === "RECORD") || (a.kind === "ENUM" && b.kind === "ENUM"))
    return a.name === b.name;
  return a.kind === b.kind;
}

/** With its article, for messages such as "but this is an INTEGER". */
export function withArticle(t: Ty): string {
  const name = typeName(t);
  return /^[AEIOU]/i.test(name) ? `an ${name}` : `a ${name}`;
}

/**
 * CIE-13 and CIE-49: a value goes into a variable of the same type; an INTEGER may go into a REAL; a one-character
 * string may go into a CHAR; a CHAR may go into a STRING. Unknown always fits (it is already an error).
 */
export function fits(value: Ty, oneChar: boolean, into: Ty): boolean {
  if (isUnknown(value) || isUnknown(into)) return true;
  if (into.kind === "REAL" && value.kind === "INTEGER") return true;
  // CIE-23: a whole array goes into another when the size and the item type match.
  if (into.kind === "ARRAY" || value.kind === "ARRAY") {
    return sameType(into, value);
  }
  if (into.kind === "CHAR" && value.kind === "STRING") return oneChar;
  if (into.kind === "STRING" && value.kind === "CHAR") return true;
  return sameType(value, into);
}

/** CIE-46: comparable when the types match, except REAL with INTEGER and CHAR with STRING (both allowed). */
export function comparable(a: Ty, b: Ty): boolean {
  if (isUnknown(a) || isUnknown(b)) return true;
  if (isNumber(a) && isNumber(b)) return true;
  if (isText(a) && isText(b)) return true;
  // CIE-48: records (like arrays and dates) cannot be compared; enumerated values can, by order (CIE-31).
  return sameType(a, b) && a.kind !== "ARRAY" && a.kind !== "DATE" && a.kind !== "RECORD";
}

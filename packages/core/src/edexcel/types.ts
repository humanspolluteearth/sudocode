// Edexcel types as the checker sees them (EDX-11), and the assignment rule (EDX-12).
//
// Compiler concept: *static type checking*. Edexcel has no declarations: a variable's type is the type of the
// first value it is given (EDX-12), and the checker works out the type of every expression from its parts
// (2 + 3 is INTEGER, 6 / 2 is REAL: EDX-13, EDX-14) before the program runs. `unknown` is the type of something
// already reported as an error (or not yet known), and fits everywhere, so one mistake gives one error.

export type Ty =
  | { kind: "INTEGER" }
  | { kind: "REAL" }
  | { kind: "BOOLEAN" }
  | { kind: "CHARACTER" }
  | { kind: "STRING" }
  | { kind: "ARRAY"; of: Ty }
  | { kind: "unknown" };

export const INTEGER: Ty = { kind: "INTEGER" };
export const REAL: Ty = { kind: "REAL" };
export const BOOLEAN: Ty = { kind: "BOOLEAN" };
export const CHARACTER: Ty = { kind: "CHARACTER" };
export const STRING: Ty = { kind: "STRING" };
export const UNKNOWN: Ty = { kind: "unknown" };
export const arrayOf = (of: Ty): Ty => ({ kind: "ARRAY", of });

/** An expression's type, and whether it is a one-character string literal (which also fits a CHARACTER, EDX-15). */
export interface Typed {
  ty: Ty;
  oneCharacter?: boolean;
}

export const isUnknown = (t: Ty): boolean => t.kind === "unknown";
export const isNumber = (t: Ty): boolean => t.kind === "INTEGER" || t.kind === "REAL";
export const isText = (t: Ty): boolean => t.kind === "STRING" || t.kind === "CHARACTER";

/** The type's name in a message: INTEGER, array of STRING. */
export function typeName(t: Ty): string {
  if (t.kind === "ARRAY") return t.of.kind === "unknown" ? "array" : `array of ${typeName(t.of)}`;
  return t.kind === "unknown" ? "unknown" : t.kind;
}

/** With its article, for messages such as "but this is an INTEGER". */
export function withArticle(t: Ty): string {
  const name = typeName(t);
  return /^[AEIOU]/i.test(name) ? `an ${name}` : `a ${name}`;
}

export function sameType(a: Ty, b: Ty): boolean {
  if (a.kind === "ARRAY" && b.kind === "ARRAY") return isUnknown(a.of) || isUnknown(b.of) || sameType(a.of, b.of);
  return a.kind === b.kind;
}

/**
 * EDX-12: a value may go into a variable of the same type; an INTEGER may go into a REAL; a one-character string
 * literal fits a CHARACTER (EDX-15); a CHARACTER fits a STRING (QUESTIONS.md 24, proposed). Arrays: element
 * types follow the same rule. Unknown types always fit (they are already errors).
 */
export function fits(value: Typed, into: Ty): boolean {
  const v = value.ty;
  if (isUnknown(v) || isUnknown(into)) return true;
  if (into.kind === "REAL" && v.kind === "INTEGER") return true;
  if (into.kind === "CHARACTER" && v.kind === "STRING") return value.oneCharacter === true;
  if (into.kind === "STRING" && v.kind === "CHARACTER") return true;
  if (into.kind === "ARRAY" && v.kind === "ARRAY") return fits({ ty: v.of }, into.of);
  return v.kind === into.kind;
}

/** The type two array elements share, or null if they can't share one (EDX-25). INTEGER with REAL is REAL (Q23). */
export function commonElement(a: Typed, b: Typed): Ty | null {
  if (isUnknown(a.ty)) return b.ty;
  if (isUnknown(b.ty)) return a.ty;
  if (isNumber(a.ty) && isNumber(b.ty)) return a.ty.kind === "REAL" || b.ty.kind === "REAL" ? REAL : INTEGER;
  if (isText(a.ty) && isText(b.ty)) return a.ty.kind === b.ty.kind ? a.ty : STRING;
  if (a.ty.kind === "ARRAY" && b.ty.kind === "ARRAY") {
    const inner = commonElement({ ty: a.ty.of }, { ty: b.ty.of });
    return inner === null ? null : arrayOf(inner);
  }
  return a.ty.kind === b.ty.kind ? a.ty : null;
}

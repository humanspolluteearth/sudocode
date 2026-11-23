// Runtime values. Each carries its kind, because the rules depend on it: 6 / 2 is the REAL 3, which prints like
// the INTEGER 3 but is a different type (EDX-14), and only INTEGER arithmetic has a range limit (SH-07).
// Pseudocode INTEGERs are JavaScript numbers checked against the safe range (DECISIONS); Python's BigInt ints
// arrive with the Python engine (M8).

export type Value =
  | { kind: "int"; value: number }
  | { kind: "real"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "char"; value: string }
  | { kind: "str"; value: string }
  /** A DATE (CIE-129): day, month and year are whole numbers; SETDATE has checked that the date exists. */
  | { kind: "date"; day: number; month: number; year: number }
  /** Arrays are shared by reference (EDX-62). `undefined` marks a gap with no value yet (EDX-27). */
  | { kind: "array"; elements: (Value | undefined)[] };

export const int = (value: number): Value => ({ kind: "int", value: value === 0 ? 0 : value });
export const real = (value: number): Value => ({ kind: "real", value });
export const TRUE: Value = Object.freeze({ kind: "bool", value: true });
export const FALSE: Value = Object.freeze({ kind: "bool", value: false });
export const bool = (value: boolean): Value => (value ? TRUE : FALSE);
export const str = (value: string): Value => ({ kind: "str", value });
export const char = (value: string): Value => ({ kind: "char", value });
export const array = (elements: (Value | undefined)[]): Value => ({ kind: "array", elements });

export const isNumber = (v: Value): v is Extract<Value, { kind: "int" | "real" }> =>
  v.kind === "int" || v.kind === "real";
export const isText = (v: Value): v is Extract<Value, { kind: "char" | "str" }> =>
  v.kind === "char" || v.kind === "str";

const SURROGATE = /[\uD800-\uDFFF]/;

/** The characters of a string as the student sees them (code points), so an emoji is one character (SH-01). */
export function characters(text: string): string[] {
  return SURROGATE.test(text) ? Array.from(text) : text.split("");
}

export function characterCount(text: string): number {
  return SURROGATE.test(text) ? Array.from(text).length : text.length;
}

/** Orders two strings by character code, one character (code point) at a time (EDX-32). */
export function compareText(a: string, b: string): number {
  if (!SURROGATE.test(a) && !SURROGATE.test(b)) return a < b ? -1 : a > b ? 1 : 0;
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i]?.codePointAt(0) ?? 0) - (y[i]?.codePointAt(0) ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return x.length - y.length < 0 ? -1 : x.length > y.length ? 1 : 0;
}

// Runtime values. Each carries its kind, because the rules depend on it: 6 / 2 is the REAL 3, which prints like
// the INTEGER 3 but is a different type (EDX-14), and only INTEGER arithmetic has a range limit (SH-07).
// Pseudocode INTEGERs are JavaScript numbers checked against the safe range (DECISIONS); Python's BigInt ints
// arrive with the Python engine (M8).

import type { Span } from "../diagnostics.ts";

export type Value =
  | { kind: "int"; value: number }
  | { kind: "real"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "char"; value: string }
  | { kind: "str"; value: string }
  /** A DATE (CIE-129): day, month and year are whole numbers; SETDATE has checked that the date exists. */
  | { kind: "date"; day: number; month: number; year: number }
  /** A record (CIE-30): fields by name; `undefined` means no value yet. Shared by reference like arrays. */
  | { kind: "record"; fields: Record<string, Value | undefined> }
  /** A value of an enumerated type (CIE-31): the type's name and ordered value names, and which one this is. */
  | { kind: "enum"; type: string; names: readonly string[]; ordinal: number }
  /** Arrays are shared by reference (EDX-62). `undefined` marks a gap with no value yet (EDX-27). */
  | { kind: "array"; elements: (Value | undefined)[] }
  // ---- Python values (M8). Python's int is a BigInt (`pyint`), its float reuses `real`, and bool and str are shared.
  | { kind: "pyint"; value: bigint }
  | { kind: "none" }
  | { kind: "list"; items: Value[] }
  | { kind: "tuple"; items: Value[] }
  /** Keys are stored under a hash key (python/hash.ts) so 1, 1.0 and True are one key; insertion order is kept. */
  | { kind: "dict"; map: Map<string, { key: Value; value: Value }> }
  | { kind: "set"; map: Map<string, Value> }
  | { kind: "range"; start: bigint; stop: bigint; step: bigint }
  /** A `def` or `lambda` value; `closure` is the frame it was made in (null at module level). */
  | {
      kind: "func";
      name: string;
      sub: string;
      params: string[];
      defaults: Value[];
      closure: Value | null;
      doc: string | null;
    }
  | { kind: "builtin"; name: string }
  /** A class such as `int` or `ValueError`, callable and usable in `isinstance` and `except`. */
  | { kind: "type"; name: string }
  | { kind: "exc"; name: string; detail: string; args: Value[]; origin: Span | null }
  /** One call frame's variables, used to build closures; never visible to the student. */
  | { kind: "env"; locals: Map<string, Value>; parent: Value | null };

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

export const pyint = (value: bigint): Value => ({ kind: "pyint", value });
export const NONE: Value = Object.freeze({ kind: "none" });
export const list = (items: Value[]): Value => ({ kind: "list", items });
export const tuple = (items: Value[]): Value => ({ kind: "tuple", items });

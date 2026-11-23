// How values print (SH-03, SH-04). The same text is used by output statements and by `&` (EDX-16).
import type { OutputFormat } from "../ir/ir.ts";
import type { Value } from "./values.ts";

/**
 * A pseudocode REAL (SH-03): rounded to 10 decimal places, then the shortest form; never `-0`, never exponent
 * form (`1e+21` prints as `1000000000000000000000`, `1e-7` as `0.0000001`).
 */
export function formatPseudocodeReal(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  // toFixed works on the exact binary value and gives exponent form only from 1e21, where no decimals remain anyway.
  const rounded = Math.abs(x) < 1e21 ? Number(x.toFixed(10)) : x;
  if (rounded === 0) return "0";
  return withoutExponent(String(rounded));
}

/** Rewrites JavaScript's shortest form (`1.5e+21`, `1e-7`) as plain digits, keeping exactly its digits. */
export function withoutExponent(text: string): string {
  const match = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
  if (match === null) return text;
  const [, sign = "", first = "", rest = "", exp = "0"] = match;
  const digits = first + rest;
  const point = 1 + Number(exp); // position of the decimal point within `digits`
  if (point >= digits.length) return sign + digits + "0".repeat(point - digits.length);
  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** The text a value prints as. Arrays print only in the debugger and in later languages (EDX-75 forbids SEND). */
export function formatValue(value: Value, format: OutputFormat): string {
  switch (value.kind) {
    case "int":
      return String(value.value);
    case "real":
      return formatPseudocodeReal(value.value);
    case "bool":
      return value.value ? "TRUE" : "FALSE";
    case "char":
    case "str":
      return value.value;
    case "array":
      return `[${value.elements.map((e) => (e === undefined ? "(no value)" : quoted(e, format))).join(", ")}]`;
    default: {
      const unreachable: never = value;
      throw new Error(`Unknown value ${JSON.stringify(unreachable)}`);
    }
  }
}

function quoted(value: Value, format: OutputFormat): string {
  return value.kind === "str" || value.kind === "char" ? `'${value.value}'` : formatValue(value, format);
}

/** The language's name for a value's type, for the debugger (VariableView.type). */
export function typeName(value: Value): string {
  switch (value.kind) {
    case "int":
      return "INTEGER";
    case "real":
      return "REAL";
    case "bool":
      return "BOOLEAN";
    case "char":
      return "CHARACTER";
    case "str":
      return "STRING";
    case "array":
      return "ARRAY";
    default: {
      const unreachable: never = value;
      throw new Error(`Unknown value ${JSON.stringify(unreachable)}`);
    }
  }
}

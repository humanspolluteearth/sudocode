// How values print (SH-03, SH-04). The same text is used by output statements and by `&` (EDX-16).
import type { OutputFormat } from "../ir/ir.ts";
import type { Value } from "./values.ts";
import { setOrder } from "./python/hash.ts";
import { pyStr, pyTypeName } from "./python/repr.ts";

/**
 * A pseudocode REAL (SH-03): rounded to 10 decimal places, then the shortest form; never `-0`, and very large
 * REALs never in exponent form (`1e+21` prints as `1000000000000000000000`, Q18). Small REALs such as `1e-7`
 * keep the shortest form until QUESTIONS.md 20 decides whether they print as `0.0000001`.
 */
export function formatPseudocodeReal(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  // toFixed works on the exact binary value and gives exponent form only from 1e21, where no decimals remain anyway.
  const rounded = Math.abs(x) < 1e21 ? Number(x.toFixed(10)) : x;
  if (rounded === 0) return "0";
  const shortest = String(rounded);
  return Math.abs(rounded) >= 1 ? withoutExponent(shortest) : shortest;
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
  if (format === "python") return pyStr(value, setOrder);
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
    case "date":
      return `${pad(value.day, 2)}/${pad(value.month, 2)}/${pad(value.year, 4)}`;
    case "enum":
      return value.names[value.ordinal] ?? "";
    case "record":
      return `{${Object.entries(value.fields)
        .map(([k, v]) => `${k}: ${v === undefined ? "(no value)" : quoted(v, format)}`)
        .join(", ")}}`;
    case "array":
      return `[${value.elements.map((e) => (e === undefined ? "(no value)" : quoted(e, format))).join(", ")}]`;
    case "pyint":
    case "none":
    case "list":
    case "tuple":
    case "dict":
    case "set":
    case "range":
    case "func":
    case "builtin":
    case "type":
    case "exc":
    case "class":
    case "instance":
    case "bound":
    case "super":
    case "env":
      return pyStr(value, setOrder); // Python values only appear in Python programs
    default: {
      const unreachable: never = value;
      throw new Error(`Unknown value ${JSON.stringify(unreachable)}`);
    }
  }
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

function quoted(value: Value, format: OutputFormat): string {
  return value.kind === "str" || value.kind === "char" ? `'${value.value}'` : formatValue(value, format);
}

/** The language's name for a value's type, for the debugger (VariableView.type). */
export function typeName(value: Value, format: OutputFormat = "pseudocode"): string {
  if (format === "python") return pyTypeName(value);
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
    case "date":
      return "DATE";
    case "enum":
      return value.type;
    case "record":
      return "RECORD";
    case "array":
      return "ARRAY";
    case "pyint":
    case "none":
    case "list":
    case "tuple":
    case "dict":
    case "set":
    case "range":
    case "func":
    case "builtin":
    case "type":
    case "exc":
    case "class":
    case "instance":
    case "bound":
    case "super":
    case "env":
      return pyTypeName(value);
    default: {
      const unreachable: never = value;
      throw new Error(`Unknown value ${JSON.stringify(unreachable)}`);
    }
  }
}

// Python's format mini-language, for f-strings, str.format and format() (PY-31).
import type { Span } from "../../diagnostics.ts";
import type { Value } from "../values.ts";
import { valueError } from "./errors.ts";
import { floatRepr, pyStr, pyTypeName } from "./repr.ts";
import { setOrder } from "./hash.ts";

/** `x.toFixed(digits)` with Python's round-half-even on exact ties (toFixed rounds ties up). */
export function fixedHalfEven(x: number, digits: number): string {
  const abs = Math.abs(x);
  if (abs >= 1e21) return BigInt(abs).toString() + (digits > 0 ? `.${"0".repeat(digits)}` : "");
  let out = abs.toFixed(digits);
  const long = abs.toFixed(Math.min(100, digits + 40));
  const dot = long.indexOf(".");
  const tail = long.slice(dot + 1 + digits);
  if (/^50*$/.test(tail)) {
    const truncated = dot >= 0 ? long.slice(0, dot + 1 + digits).replace(/\.$/, "") : long;
    const last = Number(truncated.replace(".", "").slice(-1));
    if (last % 2 === 0) out = truncated;
  }
  return out;
}

interface Spec {
  fill: string;
  align: string;
  sign: string;
  alt: boolean;
  zero: boolean;
  width: number;
  comma: string;
  precision: number | null;
  type: string;
}

function parseSpec(spec: string, span: Span): Spec {
  const m = /^(?:(.)?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([a-zA-Z%])?$/su.exec(spec);
  if (m === null) throw valueError("Invalid format specifier", span);
  return {
    fill: m[1] ?? (m[5] !== undefined && m[2] === undefined ? "0" : " "),
    align: m[2] ?? (m[5] !== undefined ? "=" : ""),
    sign: m[3] ?? "-",
    alt: m[4] !== undefined,
    zero: m[5] !== undefined,
    width: m[6] === undefined ? 0 : Number(m[6]),
    comma: m[7] ?? "",
    precision: m[8] === undefined ? null : Number(m[8]),
    type: m[9] ?? "",
  };
}

const group = (digits: string, sep: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

function pad(body: string, sign: string, s: Spec, defaultAlign: string): string {
  const align = s.align === "" ? defaultAlign : s.align;
  const room = s.width - Array.from(body).length - sign.length;
  if (room <= 0) return sign + body;
  const fill = s.fill.repeat(room);
  if (align === "<") return sign + body + fill;
  if (align === "^")
    return sign + s.fill.repeat(Math.floor(room / 2)) + body + s.fill.repeat(room - Math.floor(room / 2));
  if (align === "=") return sign + fill + body;
  return fill + sign + body;
}

function expForm(abs: number, digits: number, upper: boolean): string {
  const [mant = "", exp = "0"] = abs.toExponential(digits).split("e");
  const n = Number(exp);
  const e = `${n < 0 ? "-" : "+"}${String(Math.abs(n)).padStart(2, "0")}`;
  return `${mant}${upper ? "E" : "e"}${e}`;
}

function generalForm(abs: number, precision: number | null, upper: boolean, alt: boolean): string {
  const p = precision === null ? 6 : precision === 0 ? 1 : precision;
  if (abs === 0) return alt ? `0.${"0".repeat(p - 1)}` : "0";
  const exp = Number(abs.toExponential(p - 1).split("e")[1]);
  let text: string;
  if (exp >= -4 && exp < p) text = fixedHalfEven(abs, p - 1 - exp);
  else text = expForm(abs, p - 1, upper);
  if (alt) return text;
  const [main = "", tail = ""] = text.split(/(?=[eE])/);
  return (main.includes(".") ? main.replace(/\.?0+$/, "") : main) + tail;
}

/** `format(value, spec)`. */
export function formatWithSpec(v: Value, specText: string, span: Span): string {
  if (specText === "" && v.kind !== "list") return pyStr(v, setOrder);
  const s = parseSpec(specText, span);
  const bad = (): never => {
    throw valueError(`Unknown format code '${s.type}' for object of type '${pyTypeName(v)}'`, span);
  };
  if (v.kind === "str" || v.kind === "char") {
    if (s.type !== "" && s.type !== "s") return bad();
    const text = s.precision === null ? v.value : Array.from(v.value).slice(0, s.precision).join("");
    return pad(text, "", s, "<");
  }
  const isInt = v.kind === "pyint" || v.kind === "bool" || v.kind === "int";
  if (!isInt && v.kind !== "real") {
    if (s.type !== "" && s.type !== "s") return bad();
    return pad(pyStr(v, setOrder), "", s, "<");
  }
  const intVal =
    v.kind === "pyint" ? v.value : v.kind === "bool" ? (v.value ? 1n : 0n) : v.kind === "int" ? BigInt(v.value) : 0n;
  const type = s.type === "" && v.kind === "real" ? "" : s.type === "" ? "d" : s.type;
  const negative = v.kind === "real" ? v.value < 0 || Object.is(v.value, -0) : intVal < 0n;
  const sign = negative ? "-" : s.sign === "+" ? "+" : s.sign === " " ? " " : "";
  const sep = s.comma === "" ? "" : s.comma;
  const withGroup = (digits: string): string => {
    if (sep === "") return digits;
    const [whole = "", frac] = digits.split(".");
    return group(whole, sep) + (frac === undefined ? "" : `.${frac}`);
  };
  if (isInt && "dbxXocn".includes(type) && type !== "") {
    const abs = intVal < 0n ? -intVal : intVal;
    let body: string;
    let prefix = "";
    switch (type) {
      case "b":
        body = abs.toString(2);
        prefix = s.alt ? "0b" : "";
        break;
      case "o":
        body = abs.toString(8);
        prefix = s.alt ? "0o" : "";
        break;
      case "x":
        body = abs.toString(16);
        prefix = s.alt ? "0x" : "";
        break;
      case "X":
        body = abs.toString(16).toUpperCase();
        prefix = s.alt ? "0X" : "";
        break;
      case "c":
        body = String.fromCodePoint(Number(abs));
        break;
      default:
        body = withGroup(abs.toString());
    }
    return pad(body, sign + prefix, s, ">");
  }
  const x = v.kind === "real" ? v.value : Number(intVal);
  const abs = Math.abs(x);
  if (!Number.isFinite(x)) return pad(Number.isNaN(x) ? "nan" : "inf", Number.isNaN(x) ? "" : sign, s, ">");
  let body: string;
  switch (type) {
    case "f":
    case "F":
      body = withGroup(fixedHalfEven(abs, s.precision ?? 6));
      break;
    case "e":
    case "E":
      body = expForm(abs, s.precision ?? 6, type === "E");
      break;
    case "g":
    case "G":
      body = withGroup(generalForm(abs, s.precision, type === "G", s.alt));
      break;
    case "%":
      body = `${withGroup(fixedHalfEven(abs * 100, s.precision ?? 6))}%`;
      break;
    case "":
      body = s.precision === null ? withGroup(floatRepr(abs)) : generalForm(abs, s.precision, false, false);
      if (s.precision !== null && !/[.eEn]/.test(body)) body += ".0";
      break;
    default:
      return bad();
  }
  return pad(body, sign, s, ">");
}

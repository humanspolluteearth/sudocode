// Python arithmetic, comparison and number conversion (PY-10, PY-11, PY-20 messages are CPython's own).
import type { Span } from "../../diagnostics.ts";
import type { PyArithOp, PyCompareOp } from "../../ir/python-ir.ts";
import { bool, list, pyint, real, tuple, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { fixedHalfEven } from "./format-spec.ts";
import { pyEq } from "./hash.ts";
import { pyTypeName } from "./repr.ts";

const SYMBOL: Record<PyArithOp, string> = {
  add: "+",
  sub: "-",
  mul: "*",
  truediv: "/",
  floordiv: "//",
  mod: "%",
  pow: "**",
  bitor: "|",
  bitand: "&",
  bitxor: "^",
};
const CMP_SYMBOL: Record<string, string> = { lt: "<", le: "<=", gt: ">", ge: ">=" };

/** An int-like (int or bool) as a bigint, or null. */
export const asBig = (v: Value): bigint | null =>
  v.kind === "pyint" ? v.value : v.kind === "bool" ? (v.value ? 1n : 0n) : null;
export const isNumeric = (v: Value): boolean => v.kind === "pyint" || v.kind === "bool" || v.kind === "real";
export const toFloat = (v: Value): number => (v.kind === "real" ? v.value : Number(asBig(v) ?? 0n));

const floorDiv = (a: bigint, b: bigint): bigint => {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
};

function floatMod(a: number, b: number): number {
  const r = a % b;
  return r !== 0 && r < 0 !== b < 0 ? r + b : r;
}

function bigToFloat(n: bigint, span: Span): number {
  const f = Number(n);
  if (!Number.isFinite(f)) throw pyError("OverflowError", "int too large to convert to float", span);
  return f;
}

function numeric(op: PyArithOp, a: Value, b: Value, span: Span): Value {
  const x = asBig(a);
  const y = asBig(b);
  if (x !== null && y !== null) {
    switch (op) {
      case "add":
        return pyint(x + y);
      case "sub":
        return pyint(x - y);
      case "bitor":
        return pyint(x | y);
      case "bitand":
        return pyint(x & y);
      case "bitxor":
        return pyint(x ^ y);
      case "mul":
        return pyint(x * y);
      case "truediv":
        if (y === 0n) throw pyError("ZeroDivisionError", "division by zero", span);
        return real(bigToFloat(x, span) / bigToFloat(y, span));
      case "floordiv":
        if (y === 0n) throw pyError("ZeroDivisionError", "integer division or modulo by zero", span);
        return pyint(floorDiv(x, y));
      case "mod":
        if (y === 0n) throw pyError("ZeroDivisionError", "integer modulo by zero", span);
        return pyint(x - floorDiv(x, y) * y);
      case "pow":
        if (y >= 0n) return pyint(x ** y);
        if (x === 0n) throw pyError("ZeroDivisionError", "0.0 cannot be raised to a negative power", span);
        return real(Math.pow(Number(x), Number(y)));
    }
  }
  const p = toFloat(a);
  const q = toFloat(b);
  switch (op) {
    case "add":
      return real(p + q);
    case "sub":
      return real(p - q);
    case "mul":
      return real(p * q);
    case "truediv":
      if (q === 0) throw pyError("ZeroDivisionError", "float division by zero", span);
      return real(p / q);
    case "floordiv":
      if (q === 0) throw pyError("ZeroDivisionError", "float floor division by zero", span);
      return real(Math.floor(p / q));
    case "mod":
      if (q === 0) throw pyError("ZeroDivisionError", "float modulo", span);
      return real(floatMod(p, q));
    case "pow":
      if (p === 0 && q < 0) throw pyError("ZeroDivisionError", "0.0 cannot be raised to a negative power", span);
      return real(Math.pow(p, q));
    case "bitor":
    case "bitand":
    case "bitxor":
      throw typeError(`unsupported operand type(s) for ${SYMBOL[op]}: 'float' and '${pyTypeName(b)}'`, span);
  }
}

/** `|` `&` `-` `^` on two sets: a new set, keeping the left operand's order first (PY-17). */
function setOp(
  op: PyArithOp,
  a: Extract<Value, { kind: "set" }>,
  b: Extract<Value, { kind: "set" }>,
  span: Span,
): Value {
  const out = new Map<string, Value>();
  const keep = (m: Map<string, Value>, other: Map<string, Value>, when: boolean): void => {
    for (const [k, v] of m) if (other.has(k) === when) out.set(k, v);
  };
  switch (op) {
    case "bitor":
      keep(a.map, b.map, true);
      keep(a.map, b.map, false);
      keep(b.map, a.map, false);
      break;
    case "bitand":
      keep(a.map, b.map, true);
      break;
    case "sub":
      keep(a.map, b.map, false);
      break;
    case "bitxor":
      keep(a.map, b.map, false);
      keep(b.map, a.map, false);
      break;
    default:
      throw typeError(`unsupported operand type(s) for ${SYMBOL[op]}: 'set' and 'set'`, span);
  }
  return { kind: "set", map: out };
}

/** Python's binary arithmetic on two values (PY-10). */
export function arith(op: PyArithOp, a: Value, b: Value, span: Span): Value {
  if (isNumeric(a) && isNumeric(b)) return numeric(op, a, b, span);
  if (a.kind === "set" && b.kind === "set") return setOp(op, a, b, span);
  const textA = a.kind === "str" || a.kind === "char";
  const textB = b.kind === "str" || b.kind === "char";
  if (op === "add") {
    if (textA && textB) return { kind: "str", value: (a as { value: string }).value + (b as { value: string }).value };
    if (a.kind === "list" && b.kind === "list") return list([...a.items, ...b.items]);
    if (a.kind === "tuple" && b.kind === "tuple") return tuple([...a.items, ...b.items]);
    if (textA || a.kind === "list" || a.kind === "tuple") {
      throw typeError(`can only concatenate ${pyTypeName(a)} (not "${pyTypeName(b)}") to ${pyTypeName(a)}`, span);
    }
  }
  if (op === "mul") {
    const [seq, n] = isNumeric(a) ? [b, a] : [a, b];
    if (seq.kind === "str" || seq.kind === "char" || seq.kind === "list" || seq.kind === "tuple") {
      const k = asBig(n);
      if (k === null) throw typeError(`can't multiply sequence by non-int of type '${pyTypeName(n)}'`, span);
      const count = k < 0n ? 0 : Number(k);
      if (seq.kind === "str" || seq.kind === "char") return { kind: "str", value: seq.value.repeat(count) };
      const items: Value[] = [];
      for (let i = 0; i < count; i++) items.push(...seq.items);
      return seq.kind === "list" ? list(items) : tuple(items);
    }
  }
  if (op === "mod" && textA) throw typeError("'%' formatting is not supported in Sudocode yet; use an f-string", span);
  throw typeError(`unsupported operand type(s) for ${SYMBOL[op]}: '${pyTypeName(a)}' and '${pyTypeName(b)}'`, span);
}

export function negate(v: Value, span: Span): Value {
  if (v.kind === "real") return real(-v.value);
  const n = asBig(v);
  if (n === null) throw typeError(`bad operand type for unary -: '${pyTypeName(v)}'`, span);
  return pyint(-n);
}

export function unaryPlus(v: Value, span: Span): Value {
  if (v.kind === "real") return v;
  const n = asBig(v);
  if (n === null) throw typeError(`bad operand type for unary +: '${pyTypeName(v)}'`, span);
  return pyint(n);
}

/** Orders two values, or throws the TypeError CPython gives. `symbol` names the operator in that message. */
export function compareOrder(a: Value, b: Value, symbol: string, span: Span): number {
  if (isNumeric(a) && isNumeric(b)) {
    const x = asBig(a);
    const y = asBig(b);
    if (x !== null && y !== null) return x < y ? -1 : x > y ? 1 : 0;
    const p = toFloat(a);
    const q = toFloat(b);
    return p < q ? -1 : p > q ? 1 : 0;
  }
  if ((a.kind === "str" || a.kind === "char") && (b.kind === "str" || b.kind === "char")) {
    const x = Array.from(a.value);
    const y = Array.from(b.value);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const d = (x[i]?.codePointAt(0) ?? 0) - (y[i]?.codePointAt(0) ?? 0);
      if (d !== 0) return d < 0 ? -1 : 1;
    }
    return x.length < y.length ? -1 : x.length > y.length ? 1 : 0;
  }
  if ((a.kind === "list" && b.kind === "list") || (a.kind === "tuple" && b.kind === "tuple")) {
    const y = (b as { items: Value[] }).items;
    for (let i = 0; i < Math.min(a.items.length, y.length); i++) {
      if (!pyEq(a.items[i] as Value, y[i] as Value))
        return compareOrder(a.items[i] as Value, y[i] as Value, symbol, span);
    }
    return a.items.length < y.length ? -1 : a.items.length > y.length ? 1 : 0;
  }
  throw typeError(`'${symbol}' not supported between instances of '${pyTypeName(a)}' and '${pyTypeName(b)}'`, span);
}

/** One comparison link (`==`, `<`, ...); `in` and `is` are handled by the evaluator, which has the containers. */
export function compareOp(op: PyCompareOp, a: Value, b: Value, span: Span): Value {
  switch (op) {
    case "eq":
      return bool(pyEq(a, b));
    case "ne":
      return bool(!pyEq(a, b));
    case "lt":
    case "le":
    case "gt":
    case "ge": {
      const c = compareOrder(a, b, CMP_SYMBOL[op] ?? "<", span);
      return bool(op === "lt" ? c < 0 : op === "le" ? c <= 0 : op === "gt" ? c > 0 : c >= 0);
    }
    default:
      throw new Error(`compareOp got ${op}`);
  }
}

// ---------- conversions

/** `int("...")`: optional sign and digits with single underscores between digits, spaces around ignored. */
export function parseIntText(text: string, span: Span): Value {
  const t = text.trim();
  if (!/^[+-]?\d+(_\d+)*$/.test(t)) throw valueError(`invalid literal for int() with base 10: ${pyQuote(text)}`, span);
  return pyint(BigInt(t.replace(/_/g, "")));
}

function pyQuote(text: string): string {
  return text.includes("'") && !text.includes('"')
    ? `"${text}"`
    : `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function parseFloatText(text: string, span: Span): Value {
  const t = text.trim();
  const lower = t.toLowerCase().replace(/^[+-]/, "");
  const sign = t.startsWith("-") ? -1 : 1;
  if (lower === "inf" || lower === "infinity") return real(sign * Infinity);
  if (lower === "nan") return real(NaN);
  if (!/^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)(e[+-]?\d+)?$/i.test(t)) {
    throw valueError(`could not convert string to float: ${pyQuote(text)}`, span);
  }
  return real(Number(t.replace(/_/g, "")));
}

/** `int(x)`: truncates floats toward zero. */
export function floatToInt(x: number, span: Span): Value {
  if (Number.isNaN(x)) throw valueError("cannot convert float NaN to integer", span);
  if (!Number.isFinite(x)) throw pyError("OverflowError", "cannot convert float infinity to integer", span);
  return pyint(BigInt(Math.trunc(x)));
}

/** `round(x)` and `round(x, n)`: ties go to the even digit (PY-10). */
export function pyRound(x: Value, digits: Value | null, span: Span): Value {
  const n = digits === null || digits.kind === "none" ? null : asBig(digits);
  if (digits !== null && digits.kind !== "none" && n === null) {
    throw typeError(`'${pyTypeName(digits)}' object cannot be interpreted as an integer`, span);
  }
  const whole = asBig(x);
  if (whole !== null) {
    if (n === null || n >= 0n) return pyint(whole);
    const unit = 10n ** -n;
    const q = floorDiv(whole, unit);
    const r = whole - q * unit;
    const twice = r * 2n;
    const up = twice > unit || (twice === unit && q % 2n !== 0n);
    return pyint((up ? q + 1n : q) * unit);
  }
  if (x.kind !== "real") throw typeError(`type ${pyTypeName(x)} doesn't define __round__ method`, span);
  const f = x.value;
  if (n === null) {
    if (!Number.isFinite(f)) return floatToInt(f, span);
    return pyint(BigInt(fixedHalfEven(f, 0)) * (f < 0 ? -1n : 1n));
  }
  if (!Number.isFinite(f)) return x;
  const k = Number(n);
  if (k >= 0) return real(Number(fixedHalfEven(f, Math.min(k, 100))) * (f < 0 || Object.is(f, -0) ? -1 : 1));
  const scale = 10 ** -k;
  return real(Number(fixedHalfEven(f / scale, 0)) * scale * (f < 0 ? -1 : 1));
}

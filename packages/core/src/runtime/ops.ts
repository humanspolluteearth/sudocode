// Operators, each with the rule its IR name states. The checker has already made sure operand types fit; a
// value of the wrong kind here is a bug in Sudocode, not in the student's program, so it throws a plain Error
// (the driver reports it as E-INTERNAL-ENGINE).
import type { Span } from "../diagnostics.ts";
import type { BinaryOp, OutputFormat, UnaryOp } from "../ir/ir.ts";
import { formatValue } from "./format.ts";
import { RunError } from "./run-error.ts";
import { bool, compareText, int, isNumber, isText, real, str, type Value } from "./values.ts";

const bug = (what: string, ...values: Value[]): Error =>
  new Error(`${what} got ${values.map((v) => v.kind).join(" and ")}`);

/** SH-07: an INTEGER result must stay within ±9,007,199,254,740,991. */
function checkedInt(value: number, span: Span): Value {
  if (!Number.isSafeInteger(value)) throw new RunError("E-RUN-NUMBER-TOO-LARGE", span);
  return int(value);
}

function numbers(op: string, a: Value, b: Value): [number, number, boolean] {
  if (!isNumber(a) || !isNumber(b)) throw bug(op, a, b);
  return [a.value, b.value, a.kind === "int" && b.kind === "int"];
}

const zeroDivisor = (symbol: string, span: Span): RunError =>
  new RunError("E-RUN-DIV-ZERO", span, { operator: symbol });

/** Floor division and remainder of two safe integers, exactly (SH-10: -7 DIV 2 = -4, -7 MOD 2 = 1). */
export function floorDivMod(a: number, b: number): [number, number] {
  let r = a % b; // exact for integers; takes the sign of a
  let q = (a - r) / b; // exact: a - r is a multiple of b no larger than a
  if (r !== 0 && r < 0 !== b < 0) {
    q -= 1;
    r += b;
  }
  return [q === 0 ? 0 : q, r === 0 ? 0 : r];
}

function power(a: Value, b: Value, symbol: string, span: Span): Value {
  const [x, y, ints] = numbers("^", a, b);
  if (ints && y >= 0) {
    // EDX-30: an INTEGER. Worked out exactly (Math.pow can round big results), then range-checked (SH-07).
    if (x === 0) return int(y === 0 ? 1 : 0);
    if (x === 1) return int(1);
    if (x === -1) return int(y % 2 === 0 ? 1 : -1);
    if (y > 64) throw new RunError("E-RUN-NUMBER-TOO-LARGE", span); // |x| >= 2, so already beyond 2^53
    const exact = BigInt(x) ** BigInt(y);
    if (exact > BigInt(Number.MAX_SAFE_INTEGER) || exact < -BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RunError("E-RUN-NUMBER-TOO-LARGE", span);
    }
    return int(Number(exact));
  }
  if (x === 0 && y < 0) throw zeroDivisor(symbol, span); // 0 ^ -1 is 1 / 0 (SH-09)
  return real(x ** y);
}

function compare(op: BinaryOp, a: Value, b: Value): Value {
  let order: number;
  if (isNumber(a) && isNumber(b)) order = a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  else if (isText(a) && isText(b)) order = compareText(a.value, b.value);
  else if (a.kind === "bool" && b.kind === "bool" && (op === "eq" || op === "ne")) order = a.value === b.value ? 0 : 1;
  else throw bug(op, a, b);
  switch (op) {
    case "eq":
      return bool(order === 0);
    case "ne":
      return bool(order !== 0);
    case "lt":
      return bool(order < 0);
    case "le":
      return bool(order <= 0);
    case "gt":
      return bool(order > 0);
    case "ge":
      return bool(order >= 0);
    default:
      throw new Error(`${op} is not a comparison`);
  }
}

export function binary(op: BinaryOp, symbol: string, a: Value, b: Value, span: Span, format: OutputFormat): Value {
  switch (op) {
    case "add": {
      const [x, y, ints] = numbers(op, a, b);
      return ints ? checkedInt(x + y, span) : real(x + y);
    }
    case "sub": {
      const [x, y, ints] = numbers(op, a, b);
      return ints ? checkedInt(x - y, span) : real(x - y);
    }
    case "mul": {
      const [x, y, ints] = numbers(op, a, b);
      return ints ? checkedInt(x * y, span) : real(x * y);
    }
    case "divReal": {
      const [x, y] = numbers(op, a, b);
      if (y === 0) throw zeroDivisor(symbol, span);
      return real(x / y);
    }
    case "intDivFloor":
    case "modFloor": {
      const [x, y, ints] = numbers(op, a, b);
      if (!ints) throw bug(op, a, b);
      if (y === 0) throw zeroDivisor(symbol, span);
      const [q, r] = floorDivMod(x, y);
      return op === "intDivFloor" ? checkedInt(q, span) : int(r);
    }
    case "powIntIfNonNegative":
      return power(a, b, symbol, span);
    case "concatText":
      return str(formatValue(a, format) + formatValue(b, format));
    case "eq":
    case "ne":
    case "lt":
    case "le":
    case "gt":
    case "ge":
      return compare(op, a, b);
    default: {
      const unreachable: never = op;
      throw new Error(`Unknown operator ${String(unreachable)}`);
    }
  }
}

export function unary(op: UnaryOp, a: Value): Value {
  switch (op) {
    case "negate":
      if (a.kind === "int") return int(-a.value);
      if (a.kind === "real") return real(-a.value);
      throw bug(op, a);
    case "not":
      if (a.kind === "bool") return bool(!a.value);
      throw bug(op, a);
    default: {
      const unreachable: never = op;
      throw new Error(`Unknown operator ${String(unreachable)}`);
    }
  }
}

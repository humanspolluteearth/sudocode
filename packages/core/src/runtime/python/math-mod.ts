// Python's `math` module (PY-40): sqrt, floor, ceil, pi, e, pow, fabs, trunc, log, sin, cos, tan.
//
// The results follow CPython 3.12, so `math.floor` gives an int, `math.sqrt` a float, and the errors read the same
// ("math domain error", "must be real number, not str").
import type { Span } from "../../diagnostics.ts";
import { pyint, real, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { pyTypeName } from "./repr.ts";

export const MATH_CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E };
export const MATH_FUNCTIONS = new Set(["sqrt", "floor", "ceil", "pow", "fabs", "trunc", "log", "sin", "cos", "tan"]);

const domain = (span: Span) => valueError("math domain error", span);

/** A number argument as a JS float; bool, int and float are accepted, anything else is CPython's TypeError. */
function number(v: Value | undefined, span: Span): number {
  if (v === undefined || (v.kind !== "pyint" && v.kind !== "real" && v.kind !== "bool"))
    throw typeError(`must be real number, not ${v === undefined ? "NoneType" : pyTypeName(v)}`, span);
  if (v.kind === "real") return v.value;
  const n = v.kind === "bool" ? (v.value ? 1 : 0) : Number(v.value);
  if (!Number.isFinite(n)) throw pyError("OverflowError", "int too large to convert to float", span);
  return n;
}

/** `floor`, `ceil` and `trunc` give a whole number (an int, however big) for a float. */
function whole(x: number, span: Span): Value {
  if (Number.isNaN(x)) throw valueError("cannot convert float NaN to integer", span);
  if (!Number.isFinite(x)) throw pyError("OverflowError", "cannot convert float infinity to integer", span);
  return pyint(BigInt(x));
}

/** ln of an int too big for a float: split off powers of two so the rest fits. */
function bigLog(n: bigint): number {
  const shift = n.toString(2).length - 53;
  return Math.log(Number(n >> BigInt(shift))) + shift * Math.LN2;
}

function logOf(v: Value | undefined, span: Span): number {
  if (v !== undefined && v.kind === "pyint" && v.value > 0n && !Number.isFinite(Number(v.value)))
    return bigLog(v.value);
  const x = number(v, span);
  if (x <= 0) throw domain(span);
  return Math.log(x);
}

export function mathCall(name: string, args: Value[], span: Span): Value {
  const want = name === "pow" ? 2 : 1;
  if (name === "log") {
    if (args.length < 1 || args.length > 2)
      throw typeError(
        args.length === 0
          ? "log expected at least 1 argument, got 0"
          : `log expected at most 2 arguments, got ${String(args.length)}`,
        span,
      );
  } else if (args.length !== want) {
    throw typeError(
      `math.${name}() takes ${want === 1 ? "exactly one argument" : "exactly 2 arguments"} (${String(args.length)} given)`,
      span,
    );
  }
  const a = args[0];
  switch (name) {
    case "sqrt": {
      const x = number(a, span);
      if (x < 0) throw domain(span);
      return real(Math.sqrt(x));
    }
    case "floor":
      return a?.kind === "pyint" || a?.kind === "bool"
        ? pyint(a.kind === "bool" ? (a.value ? 1n : 0n) : a.value)
        : whole(Math.floor(number(a, span)), span);
    case "ceil":
      return a?.kind === "pyint" || a?.kind === "bool"
        ? pyint(a.kind === "bool" ? (a.value ? 1n : 0n) : a.value)
        : whole(Math.ceil(number(a, span)), span);
    case "trunc":
      return a?.kind === "pyint" || a?.kind === "bool"
        ? pyint(a.kind === "bool" ? (a.value ? 1n : 0n) : a.value)
        : whole(Math.trunc(number(a, span)), span);
    case "fabs":
      return real(Math.abs(number(a, span)));
    case "pow": {
      const x = number(a, span);
      const y = number(args[1], span);
      if (x === 0 && y < 0) throw domain(span);
      if (x < 0 && Number.isFinite(x) && Number.isFinite(y) && !Number.isInteger(y)) throw domain(span);
      const r = x === 1 || y === 0 ? 1 : Math.pow(x, y);
      if (!Number.isFinite(r) && Number.isFinite(x) && Number.isFinite(y))
        throw pyError("OverflowError", "math range error", span);
      return real(r);
    }
    case "log": {
      const top = logOf(a, span);
      if (args.length === 1) return real(top);
      return real(top / logOf(args[1], span));
    }
    case "sin":
    case "cos":
    case "tan": {
      const x = number(a, span);
      if (!Number.isFinite(x)) throw domain(span);
      return real(name === "sin" ? Math.sin(x) : name === "cos" ? Math.cos(x) : Math.tan(x));
    }
    default:
      throw typeError(`math.${name} is not a function`, span);
  }
}

// Calling values: student functions, built-ins and classes such as int() or ValueError("x") (PY-30, PY-20).
import type { Span } from "../../diagnostics.ts";
import type { Env, Run } from "../evaluate.ts";
import { bool, list, NONE, pyint, real, str, tuple, type Value } from "../values.ts";
import { BUILTIN_FUNCTIONS, callBuiltin } from "./builtins.ts";
import { EXCEPTION_NAMES, pyError, typeError, valueError } from "./errors.ts";
import { hashKey, setOrder } from "./hash.ts";
import { newDict, newSet } from "./methods-coll.ts";
import { asBig, floatToInt, parseFloatText, parseIntText, toFloat } from "./numbers.ts";
import { pyStr, pyTypeName } from "./repr.ts";
import { iterate, repr, truthy } from "./seq.ts";

export const TYPE_NAMES = new Set(["int", "float", "str", "bool", "list", "tuple", "dict", "set", "range", "object"]);

/** The value a built-in name stands for, or undefined when it is not a built-in. */
export function builtinValue(name: string): Value | undefined {
  if (BUILTIN_FUNCTIONS.has(name)) return { kind: "builtin", name };
  if (TYPE_NAMES.has(name) || EXCEPTION_NAMES.includes(name)) return { kind: "type", name };
  return undefined;
}

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

function quotedList(names: string[]): string {
  const q = names.map((n) => `'${n}'`);
  if (q.length <= 2) return q.join(" and ");
  return `${q.slice(0, -1).join(", ")}, and ${q[q.length - 1] as string}`;
}

/** Binds positional and keyword arguments to a function's parameters with CPython's own errors. */
function bind(fn: Extract<Value, { kind: "func" }>, args: Value[], kwargs: Map<string, Value>, span: Span): Value[] {
  const n = fn.params.length;
  const required = n - fn.defaults.length;
  if (args.length > n) {
    const takes =
      fn.defaults.length === 0
        ? plural(n, "positional argument")
        : `from ${String(required)} to ${String(n)} positional arguments`;
    throw typeError(
      `${fn.name}() takes ${takes} but ${String(args.length)} ${args.length === 1 ? "was" : "were"} given`,
      span,
    );
  }
  const bound: (Value | undefined)[] = fn.params.map((_, i) => args[i]);
  for (const [k, v] of kwargs) {
    const i = fn.params.indexOf(k);
    if (i < 0) throw typeError(`${fn.name}() got an unexpected keyword argument '${k}'`, span);
    if (bound[i] !== undefined) throw typeError(`${fn.name}() got multiple values for argument '${k}'`, span);
    bound[i] = v;
  }
  const missing: string[] = [];
  const out = bound.map((v, i) => {
    if (v !== undefined) return v;
    const d = i >= required ? fn.defaults[i - required] : undefined;
    if (d === undefined) missing.push(fn.params[i] as string);
    return d ?? NONE;
  });
  if (missing.length > 0) {
    throw typeError(
      `${fn.name}() missing ${plural(missing.length, "required positional argument")}: ${quotedList(missing)}`,
      span,
    );
  }
  return out;
}

export function* callValue(fn: Value, args: Value[], kwargs: Map<string, Value>, env: Env, span: Span): Run<Value> {
  switch (fn.kind) {
    case "func": {
      const bound = bind(fn, args, kwargs, span);
      const result = yield { type: "call", callee: fn.sub, args: [...bound, fn.closure ?? NONE], span };
      return (result as Value | undefined) ?? NONE;
    }
    case "builtin":
      return yield* callBuiltin(fn.name, args, kwargs, env, span);
    case "type":
      return construct(fn.name, args, kwargs, span);
    default:
      throw typeError(`'${pyTypeName(fn)}' object is not callable`, span);
  }
}

function intFromBase(text: string, base: number, span: Span): Value {
  let t = text.trim().toLowerCase().replace(/_/g, "");
  let neg = false;
  if (t.startsWith("-") || t.startsWith("+")) {
    neg = t[0] === "-";
    t = t.slice(1);
  }
  const prefix = { 2: "0b", 8: "0o", 16: "0x" }[base];
  if (prefix !== undefined && t.startsWith(prefix)) t = t.slice(prefix.length);
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, base);
  if (t === "" || Array.from(t).some((c) => !digits.includes(c))) {
    throw valueError(`invalid literal for int() with base ${String(base)}: ${repr(str(text))}`, span);
  }
  let n = 0n;
  for (const c of t) n = n * BigInt(base) + BigInt(digits.indexOf(c));
  return pyint(neg ? -n : n);
}

function makeRange(args: Value[], span: Span): Value {
  const big = (v: Value): bigint => {
    const n = asBig(v);
    if (n === null) throw typeError(`'${pyTypeName(v)}' object cannot be interpreted as an integer`, span);
    return n;
  };
  if (args.length === 0 || args.length > 3)
    throw typeError(`range expected at most 3 arguments, got ${String(args.length)}`, span);
  const [a, b, c] = args.map(big);
  const range =
    args.length === 1
      ? { start: 0n, stop: a as bigint, step: 1n }
      : { start: a as bigint, stop: b as bigint, step: c ?? 1n };
  if (range.step === 0n) throw valueError("range() arg 3 must not be zero", span);
  return { kind: "range", ...range };
}

function construct(name: string, args: Value[], kwargs: Map<string, Value>, span: Span): Value {
  const a0 = args[0];
  switch (name) {
    case "int": {
      if (a0 === undefined) return pyint(0n);
      if (args[1] !== undefined) {
        if (a0.kind !== "str") throw typeError("int() can't convert non-string with explicit base", span);
        return intFromBase(a0.value, Number(asBig(args[1]) ?? 10n), span);
      }
      if (a0.kind === "str" || a0.kind === "char") return parseIntText(a0.value, span);
      if (a0.kind === "real") return floatToInt(a0.value, span);
      if (a0.kind === "pyint") return a0;
      if (a0.kind === "bool") return pyint(a0.value ? 1n : 0n);
      throw typeError(
        `int() argument must be a string, a bytes-like object or a real number, not '${pyTypeName(a0)}'`,
        span,
      );
    }
    case "float": {
      if (a0 === undefined) return real(0);
      if (a0.kind === "str" || a0.kind === "char") return parseFloatText(a0.value, span);
      if (a0.kind === "pyint" || a0.kind === "bool" || a0.kind === "real") {
        const f = toFloat(a0);
        if (!Number.isFinite(f) && a0.kind === "pyint")
          throw pyError("OverflowError", "int too large to convert to float", span);
        return real(f);
      }
      throw typeError(`float() argument must be a string or a real number, not '${pyTypeName(a0)}'`, span);
    }
    case "str":
      return str(a0 === undefined ? "" : pyStr(a0, setOrder));
    case "bool":
      return bool(a0 !== undefined && truthy(a0));
    case "list":
      return list(a0 === undefined ? [] : iterate(a0, span).slice());
    case "tuple":
      return tuple(a0 === undefined ? [] : iterate(a0, span).slice());
    case "set":
      return newSet(a0 === undefined ? [] : iterate(a0, span), span);
    case "dict": {
      const base: [Value, Value][] = [];
      if (a0 !== undefined) {
        if (a0.kind === "dict") for (const e of a0.map.values()) base.push([e.key, e.value]);
        else
          for (const p of iterate(a0, span)) {
            const kv = iterate(p, span);
            if (kv.length !== 2)
              throw valueError(
                `dictionary update sequence element #0 has length ${String(kv.length)}; 2 is required`,
                span,
              );
            base.push([kv[0] as Value, kv[1] as Value]);
          }
      }
      for (const [k, v] of kwargs) base.push([str(k), v]);
      return newDict(base, span);
    }
    case "range":
      return makeRange(args, span);
    case "object":
      return NONE;
    default: {
      if (!EXCEPTION_NAMES.includes(name)) throw typeError(`'${name}' cannot be called`, span);
      // An exception's text is its one argument (KeyError shows the repr of its key, like CPython).
      const detail =
        args.length === 0
          ? ""
          : args.length === 1
            ? name === "KeyError"
              ? repr(a0 as Value)
              : pyStr(a0 as Value, setOrder)
            : repr(tuple(args));
      return { kind: "exc", name, detail, args, origin: null };
    }
  }
}

export { hashKey };

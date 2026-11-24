// The parts of classes that run student code: creating instances, `__str__` / `__repr__` / `__eq__` and
// friends. They are generators because the student's method is called through the driver (trampolined calls).
//
// Compiler concept: *dunder dispatch*. `a == b`, `print(a)` and `x in items` look for a method named
// `__eq__`, `__str__` ... on the object's class. `pyStr` and `pyEq` are plain functions that cannot call
// student code, so `prepare` calls `__str__` / `__repr__` first and stores the text on the instance.
import type { Span } from "../../diagnostics.ts";
import type { Env, Run } from "../evaluate.ts";
import { bool, type Value } from "../values.ts";
import { callValue } from "./call.ts";
import { baseInitialise, lookupMro, type ClassValue } from "./classes.ts";
import { typeError, valueError } from "./errors.ts";
import { hashKey, pyEq, setOrder } from "./hash.ts";
import { asBig, compareOrder } from "./numbers.ts";
import { pyStr, pyTypeName } from "./repr.ts";
import { mergeSort, truthy } from "./seq.ts";

// Identity numbers for instances that are hashed by identity. Only their uniqueness matters, never the value.
let nextIdentity = 1;

/** `Cat(args)`: make the instance, then run `__init__` (found through the MRO). */
export function* instantiate(
  cls: ClassValue,
  args: Value[],
  kwargs: Map<string, Value>,
  env: Env,
  span: Span,
): Run<Value> {
  const inst: Extract<Value, { kind: "instance" }> = { kind: "instance", cls, attrs: new Map(), shown: {} };
  if (cls.exc) baseInitialise(inst, args);
  const init = lookupMro(cls, "__init__");
  if (init === undefined) {
    if (!cls.exc && (args.length > 0 || kwargs.size > 0)) throw typeError(`${cls.name}() takes no arguments`, span);
    yield* fixHash(inst, env, span);
    return inst;
  }
  const result = yield* callValue(init, [inst, ...args], kwargs, env, span);
  if (result.kind !== "none") throw typeError(`__init__() should return None, not '${pyTypeName(result)}'`, span);
  yield* fixHash(inst, env, span);
  return inst;
}

/**
 * Compiler concept: *precomputation for a synchronous table*. A dict or set looks keys up in plain code that cannot
 * call the student's `__hash__`, so we call it once, right after `__init__`, and keep the key on the instance.
 * Approximation (logged in M9.md): two keys are equal when their hashes are equal, and the key is not refreshed
 * if the object changes later. A class with `__eq__` but no `__hash__` is unhashable, as in CPython.
 */
function* fixHash(inst: Extract<Value, { kind: "instance" }>, env: Env, span: Span): Run<void> {
  const own = lookupMro(inst.cls, "__hash__");
  if (own !== undefined) {
    if (own.kind === "none") {
      inst.hashed = null;
      return;
    }
    const h = yield* callValue(own, [inst], new Map(), env, span);
    if (asBig(h) === null) throw typeError("__hash__ method should return an integer", span);
    inst.hashed = hashKey(h, span).replace(/^n:/, "h:");
    return;
  }
  inst.hashed = lookupMro(inst.cls, "__eq__") !== undefined ? null : `i:${String(nextIdentity++)}`;
}

/** `hash(x)` as a number: an instance's hash comes from its key; other values are hashed by their key text. */
export function hashNumber(v: Value, span: Span): bigint {
  const key = hashKey(v, span);
  if (/^[nh]:-?\d+$/.test(key)) return BigInt(key.slice(2)) === -1n ? -2n : BigInt(key.slice(2));
  let h = 0n;
  for (const ch of key) h = (h * 131n + BigInt(ch.codePointAt(0) ?? 0)) % (1n << 61n);
  return h;
}

/** Truthiness that honours `__bool__` and `__len__` on instances (the plain `truthy` cannot call student code). */
export function* truth(v: Value, env: Env, span: Span): Run<boolean> {
  if (v.kind !== "instance") return truthy(v);
  const b = lookupMro(v.cls, "__bool__");
  if (b !== undefined) {
    const r = yield* callValue(b, [v], new Map(), env, span);
    if (r.kind !== "bool") throw typeError(`__bool__ should return bool, returned ${pyTypeName(r)}`, span);
    return r.value;
  }
  const n = yield* userLength(v, env, span);
  return n === undefined ? true : n > 0;
}

/** `len(x)` through `__len__`, or undefined when the class has none. */
export function* userLength(v: Value, env: Env, span: Span): Run<number | undefined> {
  if (v.kind !== "instance") return undefined;
  const fn = lookupMro(v.cls, "__len__");
  if (fn === undefined) return undefined;
  const r = yield* callValue(fn, [v], new Map(), env, span);
  const n = asBig(r);
  if (n === null || r.kind === "real")
    throw typeError(`'${pyTypeName(r)}' object cannot be interpreted as an integer`, span);
  if (n < 0n) throw valueError("__len__() should return >= 0", span);
  return Number(n);
}

/** `a < b` for sorting: the student's `__lt__` when an instance is involved, else the built-in order. */
export function* lessThan(a: Value, b: Value, env: Env, span: Span): Run<boolean> {
  if (a.kind === "instance" || b.kind === "instance") {
    const r = yield* userCompare("lt", a, b, env, span);
    if (r !== undefined) return yield* truth(r, env, span);
  }
  return compareOrder(a, b, "<", span) < 0;
}

/** A stable merge sort whose comparison may run student code (a generator version of `mergeSort`). */
export function* sortWith<T>(items: T[], less: (a: T, b: T) => Run<boolean>): Run<T[]> {
  if (items.length < 2) return items.slice();
  const mid = items.length >> 1;
  const left = yield* sortWith(items.slice(0, mid), less);
  const right = yield* sortWith(items.slice(mid), less);
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (yield* less(right[j] as T, left[i] as T)) out.push(right[j++] as T);
    else out.push(left[i++] as T);
  }
  while (i < left.length) out.push(left[i++] as T);
  while (j < right.length) out.push(right[j++] as T);
  return out;
}

/** Sorts pairs by key like `sortPairs`, but with `__lt__` support. */
export function* sortPairsUser(
  pairs: { key: Value; item: Value }[],
  reverse: boolean,
  env: Env,
  span: Span,
): Run<Value[]> {
  if (!pairs.some((p) => p.key.kind === "instance")) return sortPlain(pairs, reverse, span);
  const ordered = reverse ? pairs.slice().reverse() : pairs;
  const sorted = yield* sortWith(ordered, (a, b) => lessThan(a.key, b.key, env, span));
  return (reverse ? sorted.reverse() : sorted).map((p) => p.item);
}

function sortPlain(pairs: { key: Value; item: Value }[], reverse: boolean, span: Span): Value[] {
  const ordered = reverse ? pairs.slice().reverse() : pairs;
  const sorted = mergeSort(ordered, (a, b) => compareOrder(a.key, b.key, "<", span) < 0);
  return (reverse ? sorted.reverse() : sorted).map((p) => p.item);
}

/** `NotImplemented`: what a dunder returns to say "ask the other operand". */
export const isNotImplemented = (v: Value): boolean => v.kind === "builtin" && v.name === "NotImplemented";

function* show(
  inst: Extract<Value, { kind: "instance" }>,
  dunder: "__str__" | "__repr__",
  env: Env,
  span: Span,
): Run<string | undefined> {
  const fn = lookupMro(inst.cls, dunder);
  if (fn === undefined) return undefined;
  const r = yield* callValue(fn, [inst], new Map(), env, span);
  if (r.kind !== "str") throw typeError(`${dunder} returned non-string (type ${pyTypeName(r)})`, span);
  return r.value;
}

/**
 * Fills `shown` on every instance `v` reaches (through lists, tuples, dicts and sets) so the synchronous
 * `pyStr` can print them. The top value is shown with `mode`; anything nested is always shown with repr.
 */
export function* prepare(
  v: Value,
  env: Env,
  span: Span,
  mode: "str" | "repr" = "str",
  seen = new Set<Value>(),
): Run<void> {
  if (seen.has(v)) return;
  switch (v.kind) {
    case "instance": {
      seen.add(v);
      if (mode === "str") {
        const s = yield* show(v, "__str__", env, span);
        v.shown = { ...v.shown, str: s };
      }
      const r = yield* show(v, "__repr__", env, span);
      v.shown = { ...v.shown, repr: r };
      return;
    }
    case "list":
    case "tuple":
      seen.add(v);
      for (const x of v.items) yield* prepare(x, env, span, "repr", seen);
      return;
    case "dict":
      seen.add(v);
      for (const e of v.map.values()) {
        yield* prepare(e.key, env, span, "repr", seen);
        yield* prepare(e.value, env, span, "repr", seen);
      }
      return;
    case "set":
      seen.add(v);
      for (const x of v.map.values()) yield* prepare(x, env, span, "repr", seen);
      return;
    default:
      return;
  }
}

const DUNDER: Record<string, string> = {
  eq: "__eq__",
  ne: "__ne__",
  lt: "__lt__",
  gt: "__gt__",
  le: "__le__",
  ge: "__ge__",
};
const REFLECT: Record<string, string> = { eq: "eq", ne: "ne", lt: "gt", gt: "lt", le: "ge", ge: "le" };

/** A comparison through the student's dunder method, or undefined when neither side has one (so the default applies). */
export function* userCompare(op: string, left: Value, right: Value, env: Env, span: Span): Run<Value | undefined> {
  const call = function* (self: Value, other: Value, name: string): Run<Value | undefined> {
    if (self.kind !== "instance") return undefined;
    const fn = lookupMro(self.cls, name);
    if (fn === undefined) return undefined;
    const r = yield* callValue(fn, [self, other], new Map(), env, span);
    return isNotImplemented(r) ? undefined : r;
  };
  const direct = yield* call(left, right, DUNDER[op] as string);
  if (direct !== undefined) return direct;
  if (op === "ne") {
    const eq = yield* call(left, right, "__eq__");
    if (eq !== undefined) return bool(!truthy(eq));
  }
  const back = yield* call(right, left, DUNDER[REFLECT[op] as string] as string);
  if (back !== undefined) return back;
  if (op === "ne") {
    const eq = yield* call(right, left, "__eq__");
    if (eq !== undefined) return bool(!truthy(eq));
  }
  return undefined;
}

/** Equality that honours a student's `__eq__` (used by `in` over lists and tuples). */
export function* eqValues(a: Value, b: Value, env: Env, span: Span): Run<boolean> {
  if (a.kind === "instance" || b.kind === "instance") {
    const r = yield* userCompare("eq", a, b, env, span);
    if (r !== undefined) return truthy(r);
  }
  return pyEq(a, b);
}

/** `x in items` when items may hold instances with an `__eq__`. */
export function* containsWithEq(container: Value, item: Value, env: Env, span: Span): Run<boolean | undefined> {
  if (container.kind !== "list" && container.kind !== "tuple") return undefined;
  if (item.kind !== "instance" && !container.items.some((x) => x.kind === "instance")) return undefined;
  for (const x of container.items) if (yield* eqValues(x, item, env, span)) return true;
  return false;
}

/** The text of an exception instance for the error message, honouring `__str__`. */
export function* excText(inst: Extract<Value, { kind: "instance" }>, env: Env, span: Span): Run<string> {
  yield* prepare(inst, env, span);
  return pyStr(inst, setOrder);
}

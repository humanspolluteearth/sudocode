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
import { typeError } from "./errors.ts";
import { pyEq, setOrder } from "./hash.ts";
import { pyStr, pyTypeName } from "./repr.ts";
import { truthy } from "./seq.ts";

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
    return inst;
  }
  const result = yield* callValue(init, [inst, ...args], kwargs, env, span);
  if (result.kind !== "none") throw typeError(`__init__() should return None, not '${pyTypeName(result)}'`, span);
  return inst;
}

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
    return fn === undefined ? undefined : yield* callValue(fn, [self, other], new Map(), env, span);
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

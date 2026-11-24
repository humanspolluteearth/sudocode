// The four modules Python programs may import (PY-22): math, random, datetime and time.
//
// Compiler concept: a *module table*. `import math` does not load any file; the runtime owns a fixed table of
// modules, and a module's members are looked up here by name. A function member is a `builtin` value called
// "math.sqrt", so calling it goes through the same path as `len(...)`.
import type { Span } from "../../diagnostics.ts";
import type { Env, Run } from "../evaluate.ts";
import { real, str, type Value } from "../values.ts";
import { MOMENT_TYPES } from "./datetime-mod.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { MATH_CONSTANTS, MATH_FUNCTIONS, mathCall } from "./math-mod.ts";
import { RANDOM_FUNCTIONS, randomCall } from "./random-mod.ts";
import { pyTypeName } from "./repr.ts";

const FUNCTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  math: MATH_FUNCTIONS,
  random: RANDOM_FUNCTIONS,
  time: new Set(["time", "sleep"]),
};

export const moduleValue = (name: string): Value => ({ kind: "module", name });

/** `module.name`: a constant, a function, or (for datetime) a class. */
export function moduleAttr(mod: Extract<Value, { kind: "module" }>, name: string, span: Span): Value {
  if (mod.name === "math" && name in MATH_CONSTANTS) return real(MATH_CONSTANTS[name] as number);
  if (mod.name === "datetime" && MOMENT_TYPES.has(name)) return { kind: "type", name };
  if (name === "__name__") return str(mod.name);
  if (FUNCTIONS[mod.name]?.has(name) === true) return { kind: "builtin", name: `${mod.name}.${name}` };
  throw pyError("AttributeError", `module '${mod.name}' has no attribute '${name}'`, span);
}

/** `from m import x`: the same lookup, but a missing name is an ImportError. */
export function importMember(module: string, member: string, span: Span): Value {
  try {
    return moduleAttr({ kind: "module", name: module }, member, span);
  } catch {
    throw pyError("ImportError", `cannot import name '${member}' from '${module}' (unknown location)`, span);
  }
}

/** Calls a module function; `full` is "math.sqrt". */
export function* callModuleFunction(full: string, args: Value[], env: Env, span: Span): Run<Value> {
  const dot = full.indexOf(".");
  const module = full.slice(0, dot);
  const name = full.slice(dot + 1);
  switch (module) {
    case "math":
      return mathCall(name, args, span);
    case "random":
      return randomCall(name, args, env.machine, span);
    case "time":
      if (name === "time") return real(env.machine.nowMs() / 1000);
      return yield* sleep(args, span);
    default:
      throw typeError(`${full}() is not available`, span);
  }
}

function* sleep(args: Value[], span: Span): Run<Value> {
  const a = args[0];
  if (args.length !== 1) throw typeError(`sleep() takes exactly one argument (${String(args.length)} given)`, span);
  if (a === undefined || (a.kind !== "pyint" && a.kind !== "real" && a.kind !== "bool"))
    throw typeError(
      `'${a === undefined ? "NoneType" : pyTypeName(a)}' object cannot be interpreted as an integer`,
      span,
    );
  const seconds = a.kind === "real" ? a.value : Number(a.kind === "bool" ? (a.value ? 1 : 0) : a.value);
  if (seconds < 0) throw valueError("sleep length must be non-negative", span);
  yield { type: "sleep", ms: seconds * 1000, span };
  return { kind: "none" };
}

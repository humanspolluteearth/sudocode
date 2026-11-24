// Evaluating Python expressions (PY-10 to PY-36). Every function here is a generator so a call to a student
// function can `yield` a request to the driver (trampolined calls, see runtime/driver.ts) and the caller resumes
// with the result: Python recursion never nests JavaScript frames.
import { MOMENT_TYPES, momentAttr, momentClassMethod, momentMethod } from "./datetime-mod.ts";
import { importMember, moduleAttr, moduleValue } from "./modules.ts";
import type { Span } from "../../diagnostics.ts";
import type { PyCompClause, PyExpr, PyFPart, PyKeyword, PyTarget } from "../../ir/python-ir.ts";
import type { Env, Run } from "../evaluate.ts";
import { bool, list, NONE, pyint, real, str, tuple, type Value } from "../values.ts";
import { builtinValue, callValue } from "./call.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { formatWithSpec } from "./format-spec.ts";
import { hashKey, pyEq, setOrder } from "./hash.ts";
import { newDict, newSet, dictMethod, listMethod, setMethod, tupleMethod } from "./methods-coll.ts";
import { strMethod, type CallArgs } from "./methods-str.ts";
import { arith, compareOp, negate, unaryPlus } from "./numbers.ts";
import { pyStr, pyTypeName } from "./repr.ts";
import { containsWithEq, prepare, sortPairsUser, truth, userCompare } from "./class-calls.ts";
import { getAttr, setAttr } from "./classes.ts";
import { fileMethod } from "./files.ts";
import { contains, indexValue, iterate, repr, sliceValue, truthy } from "./seq.ts";

const MUTATING = new Set([
  "append",
  "extend",
  "insert",
  "pop",
  "remove",
  "clear",
  "reverse",
  "sort",
  "update",
  "setdefault",
  "popitem",
  "add",
  "discard",
]);

/** `is`: same object. Small ints, strings and None compare by value the way CPython's caching makes them behave. */
function same(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "none":
      return true;
    case "bool":
    case "pyint":
    case "str":
    case "real":
      return pyEq(a, b);
    case "type":
    case "builtin":
      return (b as typeof a).name === a.name;
    default:
      return false;
  }
}

function lookupName(name: string, where: "global" | "local" | "free", hops: number, env: Env, span: Span): Value {
  if (where === "free") {
    let e = env.locals?.get("$closure");
    for (let i = 1; i < hops && e !== undefined && e.kind === "env"; i++) e = e.parent ?? undefined;
    const v = e !== undefined && e.kind === "env" ? e.locals.get(name) : undefined;
    if (v === undefined)
      throw pyError(
        "NameError",
        `cannot access free variable '${name}' where it is not associated with a value in enclosing scope`,
        span,
      );
    return v;
  }
  if (where === "local" && env.locals !== null) {
    const v = env.locals.get(name);
    if (v === undefined)
      throw pyError(
        "UnboundLocalError",
        `cannot access local variable '${name}' where it is not associated with a value`,
        span,
      );
    return v;
  }
  const g = env.machine.globals.get(name);
  if (g !== undefined) return g;
  const b = builtinValue(name);
  if (b === undefined) throw pyError("NameError", `name '${name}' is not defined`, span);
  return b;
}

function* evalAll(items: readonly PyExpr[], env: Env): Run<Value[]> {
  const out: Value[] = [];
  for (const e of items) out.push(yield* pyEval(e, env));
  return out;
}

function* evalKeywords(kws: readonly PyKeyword[], env: Env): Run<Map<string, Value>> {
  const m = new Map<string, Value>();
  for (const k of kws) m.set(k.name, yield* pyEval(k.value, env));
  return m;
}

function* fstringText(parts: readonly PyFPart[], env: Env, span: Span): Run<string> {
  let out = "";
  for (const p of parts) {
    if (p.kind === "text") {
      out += p.text;
      continue;
    }
    let v = yield* pyEval(p.value, env);
    yield* prepare(v, env, span, p.conversion === "r" || p.conversion === "a" ? "repr" : "str");
    if (p.conversion === "r" || p.conversion === "a") v = str(repr(v));
    else if (p.conversion === "s") v = str(pyStr(v, setOrder));
    const spec = yield* fstringText(p.spec, env, span);
    out += spec === "" && p.conversion === null ? pyStr(v, setOrder) : formatWithSpec(v, spec, span);
  }
  return out;
}

function* comprehension(
  clauses: readonly PyCompClause[],
  i: number,
  element: PyExpr,
  env: Env,
  out: Value[],
): Run<void> {
  const c = clauses[i];
  if (c === undefined) {
    out.push(yield* pyEval(element, env));
    return;
  }
  if (c.kind === "if") {
    if (yield* truth(yield* pyEval(c.expr, env), env, c.expr.span))
      yield* comprehension(clauses, i + 1, element, env, out);
    return;
  }
  const source = yield* pyEval(c.expr, env);
  for (const item of iterate(source, c.expr.span)) {
    if (c.target !== undefined) yield* assignTarget(c.target, item, env, c.expr.span);
    yield* comprehension(clauses, i + 1, element, env, out);
  }
}

function* method(e: Extract<PyExpr, { kind: "pyMethod" }>, env: Env): Run<Value> {
  const target = yield* pyEval(e.target, env);
  const args = yield* evalAll(e.args, env);
  const kwargs = yield* evalKeywords(e.keywords, env);
  const ca: CallArgs = { args, kwargs };
  let result: Value | undefined;
  switch (target.kind) {
    case "str":
      result = strMethod(target.value, e.name, ca, e.span);
      break;
    case "list":
      if (e.name === "sort") {
        const key = kwargs.get("key");
        const pairs: { key: Value; item: Value }[] = [];
        for (const item of target.items) {
          pairs.push({
            key:
              key === undefined || key.kind === "none" ? item : yield* callValue(key, [item], new Map(), env, e.span),
            item,
          });
        }
        target.items = yield* sortPairsUser(pairs, truthy(kwargs.get("reverse") ?? NONE), env, e.span);
        result = NONE;
      } else result = listMethod(target, e.name, ca, e.span);
      break;
    case "tuple":
      result = tupleMethod(target, e.name, ca, e.span);
      break;
    case "dict":
      result = dictMethod(target, e.name, ca, e.span);
      break;
    case "set":
      result = setMethod(target, e.name, ca, e.span);
      break;
    case "file":
      result = fileMethod(target, e.name, ca, env.machine, e.span);
      break;
    case "module":
      return yield* callValue(moduleAttr(target, e.name, e.span), args, kwargs, env, e.span);
    case "moment":
      result = momentMethod(target, e.name, args, e.span);
      break;
    case "type":
      if (MOMENT_TYPES.has(target.name))
        return momentClassMethod(target.name, e.name, args, env.machine.nowMs(), e.span);
      break;
    case "instance":
    case "class":
    case "super":
      return yield* callValue(getAttr(target, e.name, e.span), args, kwargs, env, e.span);
    default:
      break;
  }
  if (result === undefined)
    throw pyError("AttributeError", `'${pyTypeName(target)}' object has no attribute '${e.name}'`, e.span);
  if (
    e.target.kind === "pyName" &&
    MUTATING.has(e.name) &&
    (target.kind === "list" || target.kind === "dict" || target.kind === "set")
  ) {
    env.machine.assigned(e.target.name, target, e.span);
  }
  return result;
}

export function* pyEval(e: PyExpr, env: Env): Run<Value> {
  switch (e.kind) {
    case "pyConst": {
      const v = e.value;
      switch (v.kind) {
        case "int":
          return pyint(v.value);
        case "float":
          return real(v.value);
        case "str":
          return str(v.value);
        case "bool":
          return bool(v.value);
        case "none":
          return NONE;
      }
      break;
    }
    case "pyName":
      return lookupName(e.name, e.where, e.hops, env, e.span);
    case "pyArith": {
      const left = yield* pyEval(e.left, env);
      const right = yield* pyEval(e.right, env);
      return arith(e.op, left, right, e.span);
    }
    case "pyUnary": {
      const v = yield* pyEval(e.operand, env);
      return e.op === "neg" ? negate(v, e.span) : unaryPlus(v, e.span);
    }
    case "pyCompare": {
      let left = yield* pyEval(e.operands[0] as PyExpr, env);
      let result: Value = bool(true);
      for (let i = 0; i < e.ops.length; i++) {
        const right = yield* pyEval(e.operands[i + 1] as PyExpr, env);
        const op = e.ops[i] as (typeof e.ops)[number];
        if (op === "in" || op === "notIn") {
          const found = (yield* containsWithEq(right, left, env, e.span)) ?? contains(right, left, e.span);
          result = bool(op === "in" ? found : !found);
        } else if (op === "is") result = bool(same(left, right));
        else if (op === "isNot") result = bool(!same(left, right));
        else {
          const custom =
            left.kind === "instance" || right.kind === "instance"
              ? yield* userCompare(op, left, right, env, e.span)
              : undefined;
          result = custom ?? compareOp(op, left, right, e.span);
        }
        if (!(yield* truth(result, env, e.span))) return result;
        left = right;
      }
      return result;
    }
    case "pyBoolOp": {
      const left = yield* pyEval(e.left, env);
      const lt = yield* truth(left, env, e.span);
      if (e.op === "and" ? !lt : lt) return left;
      return yield* pyEval(e.right, env);
    }
    case "pyNot":
      return bool(!(yield* truth(yield* pyEval(e.operand, env), env, e.span)));
    case "pyTruth":
      return bool(yield* truth(yield* pyEval(e.operand, env), env, e.span));
    case "pyIfExpr":
      return yield* pyEval((yield* truth(yield* pyEval(e.test, env), env, e.span)) ? e.then : e.else, env);
    case "pyList":
      return list(yield* evalAll(e.items, env));
    case "pyTuple":
      return tuple(yield* evalAll(e.items, env));
    case "pySet":
      return newSet(yield* evalAll(e.items, env), e.span);
    case "pyDict": {
      const pairs: [Value, Value][] = [];
      for (const p of e.pairs) {
        const k = yield* pyEval(p.key, env); // the key is evaluated before its value, as CPython does
        pairs.push([k, yield* pyEval(p.value, env)]);
      }
      return newDict(pairs, e.span);
    }
    case "pyIndex": {
      const target = yield* pyEval(e.target, env);
      return indexValue(target, yield* pyEval(e.index, env), e.span);
    }
    case "pySlice": {
      const target = yield* pyEval(e.target, env);
      const lo = e.lower === null ? null : yield* pyEval(e.lower, env);
      const hi = e.upper === null ? null : yield* pyEval(e.upper, env);
      const st = e.step === null ? null : yield* pyEval(e.step, env);
      return sliceValue(target, lo, hi, st, e.span);
    }
    case "pyAttr": {
      const t = yield* pyEval(e.target, env);
      if (t.kind === "func" && e.name === "__doc__") return t.doc === null ? NONE : str(t.doc);
      if ((t.kind === "func" || t.kind === "type" || t.kind === "builtin") && e.name === "__name__") return str(t.name);
      if (t.kind === "module") return moduleAttr(t, e.name, e.span);
      if (t.kind === "moment") return momentAttr(t, e.name, e.span);
      if (t.kind === "exc" && e.name === "args") return tuple(t.args);
      if (t.kind === "instance" || t.kind === "class" || t.kind === "super") return getAttr(t, e.name, e.span);
      throw pyError("AttributeError", `'${pyTypeName(t)}' object has no attribute '${e.name}'`, e.span);
    }
    case "pyCall": {
      const callee = yield* pyEval(e.callee, env);
      const args = yield* evalAll(e.args, env);
      const kwargs = yield* evalKeywords(e.keywords, env);
      return yield* callValue(callee, args, kwargs, env, e.span);
    }
    case "pyMethod":
      return yield* method(e, env);
    case "pyFString":
      return str(yield* fstringText(e.parts, env, e.span));
    case "pyComp": {
      const out: Value[] = [];
      yield* comprehension(e.clauses, 0, e.element, env, out);
      return list(out);
    }
    case "pyModule":
      return e.member === null ? moduleValue(e.module) : importMember(e.module, e.member, e.span);
    case "pySuper": {
      const cls = yield* pyEval(e.klass, env);
      const self = yield* pyEval(e.self, env);
      if (cls.kind !== "class") throw typeError("super(): __class__ cell not found", e.span);
      return { kind: "super", cls, self };
    }
    case "pyFunction": {
      const defaults = yield* evalAll(e.defaults, env);
      const parent = env.locals?.get("$closure");
      const enclosing = parent !== undefined && parent.kind === "env" ? parent : null;
      // A method's closure skips the class body: Python scoping ignores class variables inside methods (PY-19).
      const closure: Value | null =
        env.locals === null
          ? null
          : env.locals.has("$isclass")
            ? enclosing
            : { kind: "env", locals: env.locals, parent: enclosing };
      return { kind: "func", name: e.name, sub: e.sub, params: e.params, defaults, closure, doc: e.doc, qual: e.qual };
    }
  }
  throw new Error(`Unknown Python expression ${(e as { kind: string }).kind}`);
}

// ---------- assignment

export function setName(name: string, where: "global" | "local" | "free", value: Value, env: Env, span: Span): void {
  const store = where === "global" || env.locals === null ? env.machine.globals : env.locals;
  store.set(name, value);
  if (!name.startsWith("$")) env.machine.assigned(name, value, span);
}

export function storeIndex(container: Value, index: Value, value: Value, span: Span): void {
  if (container.kind === "list") {
    const n = index.kind === "pyint" ? index.value : index.kind === "bool" ? (index.value ? 1n : 0n) : null;
    if (n === null) throw typeError(`list indices must be integers or slices, not ${pyTypeName(index)}`, span);
    const i = Number(n < 0n ? n + BigInt(container.items.length) : n);
    if (i < 0 || i >= container.items.length) throw pyError("IndexError", "list assignment index out of range", span);
    container.items[i] = value;
  } else if (container.kind === "dict") {
    container.map.set(hashKey(index, span), { key: container.map.get(hashKey(index, span))?.key ?? index, value });
  } else {
    throw typeError(`'${pyTypeName(container)}' object does not support item assignment`, span);
  }
}

export function* assignTarget(t: PyTarget, value: Value, env: Env, span: Span): Run<void> {
  switch (t.kind) {
    case "name":
      setName(t.name, t.where, value, env, span);
      return;
    case "attr": {
      const container = yield* pyEval(t.target, env);
      setAttr(container, t.name, value, span);
      if (t.root !== null) env.machine.assigned(t.root, container, span);
      return;
    }
    case "index": {
      const container = yield* pyEval(t.target, env);
      const index = yield* pyEval(t.index, env);
      storeIndex(container, index, value, span);
      if (t.root !== null) env.machine.assigned(t.root, container, span);
      return;
    }
    case "tuple": {
      if (!["list", "tuple", "str", "dict", "set", "range"].includes(value.kind)) {
        throw typeError(`cannot unpack non-iterable ${pyTypeName(value)} object`, span);
      }
      const items = iterate(value, span);
      if (items.length > t.items.length)
        throw valueError(`too many values to unpack (expected ${String(t.items.length)})`, span);
      if (items.length < t.items.length)
        throw valueError(
          `not enough values to unpack (expected ${String(t.items.length)}, got ${String(items.length)})`,
          span,
        );
      for (let i = 0; i < t.items.length; i++)
        yield* assignTarget(t.items[i] as PyTarget, items[i] as Value, env, span);
      return;
    }
  }
}

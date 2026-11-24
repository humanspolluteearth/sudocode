// Executing Python statements (PY-10 to PY-23). A body is a generator that `yield`s a "step" before each statement
// so the debugger can pause anywhere; `break`, `continue` and `return` travel back up as a `Returned` signal.
import type { Span } from "../../diagnostics.ts";
import type { PyExpr, PyStmt, PyTarget } from "../../ir/python-ir.ts";
import type { Env, Returned, Run } from "../evaluate.ts";
import { RunError } from "../run-error.ts";
import { NONE, pyint, str, type Value } from "../values.ts";
import { callValue } from "./call.ts";
import { isSubclass, pyError, typeError } from "./errors.ts";
import { hashKey, setOrder } from "./hash.ts";
import { arith } from "./numbers.ts";
import { pyStr } from "./repr.ts";
import { indexValue, iterate, repr, truthy } from "./seq.ts";
import { assignTarget, pyEval, setName, storeIndex } from "./eval.ts";
import { excText } from "./class-calls.ts";
import { getAttr, makeClass, setAttr } from "./classes.ts";

export function* pyBlock(stmts: readonly PyStmt[], env: Env): Run<Returned | undefined> {
  for (const s of stmts) {
    yield { type: "step", span: s.span };
    const done = yield* pyStatement(s, env);
    if (done !== undefined) return done;
  }
  return undefined;
}

/** After a loop body: stop the loop (break), go on (continue / no signal) or pass a `return` upward. */
function afterBody(done: Returned | undefined): "next" | "break" | Returned {
  if (done === undefined) return "next";
  if (done.signal === "break") return "break";
  if (done.signal === "continue") return "next";
  return done;
}

function* augment(s: Extract<PyStmt, { kind: "pyAugAssign" }>, env: Env): Run<undefined> {
  const t = s.target;
  if (t.kind === "tuple") throw new Error("Augmented assignment to a tuple");
  if (t.kind === "name") {
    const current = yield* pyEval({ kind: "pyName", name: t.name, where: t.where, hops: 0, span: t.span }, env);
    const rhs = yield* pyEval(s.value, env);
    setName(t.name, t.where, inPlace(s.op, current, rhs, s.span), env, s.span);
    return undefined;
  }
  if (t.kind === "attr") {
    const obj = yield* pyEval(t.target, env);
    const rhs = yield* pyEval(s.value, env);
    setAttr(obj, t.name, inPlace(s.op, getAttr(obj, t.name, s.span), rhs, s.span), s.span);
    if (t.root !== null) env.machine.assigned(t.root, obj, s.span);
    return undefined;
  }
  const container = yield* pyEval(t.target, env);
  const index = yield* pyEval(t.index, env);
  const rhs = yield* pyEval(s.value, env);
  storeIndex(container, index, inPlace(s.op, indexValue(container, index, s.span), rhs, s.span), s.span);
  if (t.root !== null) env.machine.assigned(t.root, container, s.span);
  return undefined;
}

/** `list += x` and `list *= n` change the list itself (so other names for it see it); everything else is `arith`. */
function inPlace(op: Extract<PyStmt, { kind: "pyAugAssign" }>["op"], a: Value, b: Value, span: Span): Value {
  if (a.kind === "list" && op === "add") {
    a.items.push(...iterate(b, span));
    return a;
  }
  if (a.kind === "list" && op === "mul") {
    const r = arith("mul", a, b, span);
    if (r.kind === "list") a.items = r.items;
    return a;
  }
  return arith(op, a, b, span);
}

function* del(t: PyTarget, env: Env, span: Span): Run<void> {
  if (t.kind === "name") {
    const store = t.where === "global" || env.locals === null ? env.machine.globals : env.locals;
    if (!store.delete(t.name)) throw pyError("NameError", `name '${t.name}' is not defined`, span);
    return;
  }
  if (t.kind === "tuple") {
    for (const x of t.items) yield* del(x, env, span);
    return;
  }
  if (t.kind === "attr") {
    const obj = yield* pyEval(t.target, env);
    if ((obj.kind !== "instance" && obj.kind !== "class") || !obj.attrs.delete(t.name)) getAttr(obj, t.name, span);
    if (t.root !== null) env.machine.assigned(t.root, obj, span);
    return;
  }
  const container = yield* pyEval(t.target, env);
  const index = yield* pyEval(t.index, env);
  if (container.kind === "list") {
    indexValue(container, index, span); // raises the right IndexError / TypeError
    const n = index.kind === "pyint" ? Number(index.value) : index.kind === "bool" && index.value ? 1 : 0;
    container.items.splice(n < 0 ? n + container.items.length : n, 1);
  } else if (container.kind === "dict") {
    if (!container.map.delete(hashKey(index, span))) throw pyError("KeyError", repr(index), span);
  } else throw typeError(`'${container.kind}' object doesn't support item deletion`, span);
  if (t.root !== null) env.machine.assigned(t.root, container, span);
}

function* raise(s: Extract<PyStmt, { kind: "pyRaise" }>, env: Env): Run<never> {
  if (s.exc === null) throw pyError("RuntimeError", "No active exception to reraise", s.span);
  let v = yield* pyEval(s.exc, env);
  if (v.kind === "type" || v.kind === "class") v = yield* callValue(v, [], new Map(), env, s.span);
  if (v.kind === "instance" && v.cls.exc) {
    throw new RunError(`E-PY-${v.cls.name}`, s.span, { detail: yield* excText(v, env, s.span) }, undefined, v);
  }
  if (v.kind !== "exc") throw typeError("exceptions must derive from BaseException", s.span);
  throw new RunError(`E-PY-${v.name}`, s.reraise ? (v.origin ?? s.span) : s.span, { detail: v.detail });
}

function* handles(types: PyExpr, exc: Value, env: Env, span: Span): Run<boolean> {
  const t = yield* pyEval(types, env);
  const options = t.kind === "tuple" ? t.items : [t];
  for (const o of options) {
    const ok = o.kind === "class" ? o.exc : o.kind === "type" && isExceptionType(o.name);
    if (!ok) throw typeError("catching classes that do not inherit from BaseException is not allowed", span);
  }
  return options.some((o) => {
    if (exc.kind === "instance")
      return o.kind === "class"
        ? exc.cls.mro.includes(o)
        : exc.cls.mro.some((c) => c.kind === "type" && c.name === (o as { name: string }).name);
    return o.kind === "type" && exc.kind === "exc" && isSubclass(exc.name, o.name);
  });
}

const isExceptionType = (name: string): boolean => name === "BaseException" || isSubclass(name, "BaseException");

function* tryCore(s: Extract<PyStmt, { kind: "pyTry" }>, env: Env): Run<Returned | undefined> {
  let caught: RunError | null = null;
  let flow: Returned | undefined;
  try {
    flow = yield* pyBlock(s.body, env);
  } catch (err) {
    // Only Python exceptions can be caught; engine errors (such as the step limit) keep going.
    if (!(err instanceof RunError) || !err.code.startsWith("E-PY-")) throw err;
    caught = err;
  }
  if (caught === null) return flow === undefined && s.orelse.length > 0 ? yield* pyBlock(s.orelse, env) : flow;
  const detail = String(caught.args["detail"] ?? "");
  const exc: Value = caught.payload ?? {
    kind: "exc",
    name: caught.code.slice(5),
    detail,
    args: detail === "" ? [] : [str(detail)],
    origin: caught.span,
  };
  for (const h of s.handlers) {
    if (h.types !== null && !(yield* handles(h.types, exc, env, h.span))) continue;
    yield* assignTarget(h.hidden, exc, env, h.span);
    if (h.name !== null) yield* assignTarget(h.name, exc, env, h.span);
    try {
      return yield* pyBlock(h.body, env);
    } finally {
      if (h.name !== null && h.name.kind === "name") {
        (h.name.where === "global" || env.locals === null ? env.machine.globals : env.locals).delete(h.name.name);
      }
    }
  }
  throw caught;
}

function* tryStatement(s: Extract<PyStmt, { kind: "pyTry" }>, env: Env): Run<Returned | undefined> {
  if (s.final.length === 0) return yield* tryCore(s, env);
  let flow: Returned | undefined;
  let pending: unknown;
  let failed = false;
  try {
    flow = yield* tryCore(s, env);
  } catch (err) {
    pending = err;
    failed = true;
  }
  const fin = yield* pyBlock(s.final, env);
  if (fin !== undefined) return fin; // a return / break in `finally` replaces the pending error
  if (failed) throw pending;
  return flow;
}

function* evalAllBases(bases: readonly PyExpr[], env: Env): Run<Value[]> {
  const out: Value[] = [];
  for (const b of bases) out.push(yield* pyEval(b, env));
  return out;
}

export function* pyStatement(s: PyStmt, env: Env): Run<Returned | undefined> {
  switch (s.kind) {
    case "pyExpr":
      yield* pyEval(s.value, env);
      return undefined;
    case "pyAssign": {
      const v = yield* pyEval(s.value, env);
      for (const t of s.targets) yield* assignTarget(t, v, env, s.span);
      return undefined;
    }
    case "pyAugAssign":
      return yield* augment(s, env);
    case "pyIf":
      return yield* pyBlock(truthy(yield* pyEval(s.test, env)) ? s.then : s.else, env);
    case "pyWhile": {
      for (let k = 0; truthy(yield* pyEval(s.test, env)); k++) {
        if (k > 0) yield { type: "step", span: s.span };
        const r = afterBody(yield* pyBlock(s.body, env));
        if (r === "break") return undefined;
        if (r !== "next") return r;
      }
      return yield* pyBlock(s.orelse, env);
    }
    case "pyFor": {
      const source = yield* pyEval(s.iter, env);
      const next = ((): ((i: number) => Value | null) => {
        if (source.kind === "list") return (i) => source.items[i] ?? null; // visited live, by position
        if (source.kind === "range") {
          return (i) => {
            const v = source.start + BigInt(i) * source.step;
            return (source.step > 0n ? v < source.stop : v > source.stop) ? pyint(v) : null;
          };
        }
        const items = iterate(source, s.iter.span);
        return (i) => items[i] ?? null;
      })();
      for (let i = 0; ; i++) {
        const item = next(i);
        if (item === null) break;
        if (i > 0) yield { type: "step", span: s.span };
        yield* assignTarget(s.target, item, env, s.span);
        const r = afterBody(yield* pyBlock(s.body, env));
        if (r === "break") return undefined;
        if (r !== "next") return r;
      }
      return yield* pyBlock(s.orelse, env);
    }
    case "pyBreak":
      return { value: undefined, signal: "break" };
    case "pyContinue":
      return { value: undefined, signal: "continue" };
    case "pyReturn":
      return { value: s.value === null ? NONE : yield* pyEval(s.value, env) };
    case "pyDel":
      for (const t of s.targets) yield* del(t, env, s.span);
      return undefined;
    case "pyRaise":
      return yield* raise(s, env);
    case "pyTry":
      return yield* tryStatement(s, env);
    case "pyClass": {
      const bases = yield* evalAllBases(s.bases, env);
      // The body runs in its own namespace; whatever it assigns becomes the class's attributes.
      const parent = env.locals?.get("$closure");
      const enclosing: Value | null =
        env.locals === null
          ? null
          : { kind: "env", locals: env.locals, parent: parent !== undefined && parent.kind === "env" ? parent : null };
      const locals = new Map<string, Value>([["$isclass", NONE]]);
      if (enclosing !== null) locals.set("$closure", enclosing);
      const done = yield* pyBlock(s.body, { ...env, locals });
      if (done !== undefined) return done;
      const attrs = new Map([...locals].filter(([k]) => !k.startsWith("$")));
      const cls = makeClass(s.name, bases, attrs, s.span);
      yield* assignTarget(s.target, cls, env, s.span);
      return undefined;
    }
    case "pyAssert": {
      if (truthy(yield* pyEval(s.test, env))) return undefined;
      const detail = s.message === null ? "" : pyStr(yield* pyEval(s.message, env), setOrder);
      throw pyError("AssertionError", detail, s.span);
    }
  }
}

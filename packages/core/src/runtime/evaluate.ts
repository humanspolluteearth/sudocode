// Expression evaluation for the interpreter (interpreter.ts runs the statements).
// Expressions without a subprogram call are evaluated by plain functions; only those with a call go through
// generators, so ordinary arithmetic costs no generator objects.
import type { Span } from "../diagnostics.ts";
import type { Expr, FileMode, OutputFormat, VarRef } from "../ir/ir.ts";
import type { MessageArgs } from "../messages/index.ts";
import { cieBuiltin } from "./builtins.ts";
import { binary, unary } from "./ops.ts";
import { RunError } from "./run-error.ts";
import { isPyExpr } from "../ir/python-ir.ts";
import { pyEval } from "./python/eval.ts";
import { array, char, characterCount, characters, int, real, type Value } from "./values.ts";

/** What a running body asks the driver for. */
export type Request =
  | { type: "step"; span: Span }
  | { type: "call"; callee: string; args: Value[]; span: Span }
  /** Wait for a line of input; `device` is null for the keyboard (EDX-74). Resumed with the line as a STRING. */
  | { type: "input"; prompt: string; device: string | null; span: Span };

/** What the interpreter needs from the driver. */
export interface Machine {
  readonly format: OutputFormat;
  readonly globals: Map<string, Value>;
  /** Prints one line (its text ends with a newline); `span` is the output statement, for the trace table. */
  output(text: string, span: Span): void;
  /** The next line of a virtual file, without its newline (EDX-82, SH-11); a runtime error when there is none. */
  readLine(file: string, span: Span, strict?: boolean): string;
  /** Adds one line to a virtual file; the first write of a run replaces the old contents (EDX-83). */
  writeLine(file: string, text: string, span: Span, strict?: boolean): void;
  /** OPENFILE (CIE-90, CIE-91, CIE-94, CIE-97): WRITE empties the file, APPEND keeps it, the others need it to exist. */
  openFile(file: string, mode: FileMode, span: Span): void;
  closeFile(file: string, span: Span): void;
  /** EOF (CIE-130): TRUE when no lines are left; the file must be open for READ. */
  eof(file: string, span: Span): boolean;
  /** Random files (CIE-94, CIE-95): the file must be open FOR RANDOM. */
  seek(file: string, address: number, span: Span): void;
  getRecord(file: string, span: Span): Value;
  putRecord(file: string, value: Value, span: Span): void;
  /** The first OPENFILE of a file still open now (CIE-96), or null. */
  leftOpen(): { file: string; span: Span } | null;
  /** A variable was given a value (SH-17 trace table). For an element change, `value` is the whole array. */
  assigned(name: string, value: Value, span: Span): void;
  /** A runtime info note (e.g. I-EDX-ARRAY-GROWS). The driver decides how often it is shown. */
  note(code: string, span: Span, args: MessageArgs): void;
  /** The next random whole number from 0 to `max` inclusive, from the run's seeded generator (SH-12). */
  random(max: number): number;
  /** The next random REAL from 0 up to, but not including, 1, from the same seeded generator (CIE-128). */
  randomReal(): number;
  /** Today's date (CIE-129), from the clock; tests pass a fixed one. */
  today(): { day: number; month: number; year: number };
}

/** One frame's view of the variables: its locals (null in the main program) and the globals. */
export interface Env {
  machine: Machine;
  locals: Map<string, Value> | null;
}

/** A body's generator: yields requests, is resumed with a call's result (or input), returns a RETURN value. */
export type Body = Generator<Request, Value | undefined, unknown>;
export type Run<T> = Generator<Request, T, unknown>;
export interface Returned {
  value: Value | undefined;
  /** Python `break` / `continue` travelling up to the loop that handles them (python/exec.ts). */
  signal?: "break" | "continue";
}

export const bug = (what: string): Error => new Error(what);

// ---------- variables

export function slot(ref: VarRef, env: Env): Map<string, Value> {
  if (ref.scope === "global" || env.locals === null) return env.machine.globals;
  return env.locals;
}

export function read(ref: VarRef, env: Env): Value {
  const value = slot(ref, env).get(ref.name);
  if (value === undefined) throw new RunError("E-RUN-NO-VALUE", ref.span, { name: ref.name });
  return value;
}

// ---------- expressions

const callCache = new WeakMap<Expr, boolean>();

/** Whether evaluating `e` may call a subprogram. Expressions without calls take the plain (non-generator) path. */
function hasCall(e: Expr): boolean {
  if (isPyExpr(e)) return true; // Python expressions always take the generator path (python/eval.ts)
  const cached = callCache.get(e);
  if (cached !== undefined) return cached;
  let result: boolean;
  switch (e.kind) {
    case "call":
      result = true;
      break;
    case "literal":
    case "var":
    case "fail":
      result = false;
      break;
    case "binary":
    case "logical":
      result = hasCall(e.left) || hasCall(e.right);
      break;
    case "unary":
      result = hasCall(e.operand);
      break;
    case "index":
      result = hasCall(e.target) || hasCall(e.index);
      break;
    case "arrayLiteral":
      result = e.elements.some(hasCall);
      break;
    case "newArray":
      result = false;
      break;
    case "newRecord":
    case "enumValue":
      result = false;
      break;
    case "field":
      result = hasCall(e.target);
      break;
    case "enumStep":
      result = hasCall(e.operand) || hasCall(e.by);
      break;
    case "enumOrdinal":
      result = hasCall(e.operand);
      break;
    case "copyArray":
      result = hasCall(e.source);
      break;
    case "builtin":
      result = e.args.some(hasCall);
      break;
    default: {
      const unreachable: never = e;
      throw bug(`Unknown expression ${JSON.stringify(unreachable)}`);
    }
  }
  callCache.set(e, result);
  return result;
}

export function asBoolean(v: Value): boolean {
  if (v.kind !== "bool") throw bug(`A condition got ${v.kind}`);
  return v.value;
}

export function asIndex(v: Value): number {
  if (v.kind !== "int") throw bug(`An index got ${v.kind}`);
  return v.value;
}

export function indexError(node: { text: string; span: Span; base: number }, shown: number, target: Value): RunError {
  const length =
    target.kind === "array" ? target.elements.length : characterCount(target.kind === "str" ? target.value : "");
  const args = {
    index: shown,
    array: node.text,
    length,
    last: length - 1 + node.base,
    low: node.base,
    high: length - 1 + node.base,
  };
  const variant = target.kind === "str" ? "string" : length === 0 ? "empty" : undefined;
  return new RunError("E-RUN-INDEX-RANGE", node.span, args, variant);
}

/** CIE-20: an array of the given dimensions with no item set yet. */
function unsetArray(dims: readonly number[], fill: Expr | undefined, env: Env): Value {
  const [first, ...rest] = dims;
  if (first === undefined) throw bug("An array needs at least one dimension");
  // `fill` (an array of records) builds a fresh record for every item, so no two items share one.
  const item = (): Value | undefined =>
    rest.length === 0 ? (fill === undefined ? undefined : evaluate(fill, env)) : unsetArray(rest, fill, env);
  return array(Array.from({ length: first }, item));
}

function newRecord(e: Extract<Expr, { kind: "newRecord" }>, env: Env): Value {
  const fields: Record<string, Value | undefined> = {};
  for (const f of e.fields) fields[f.name] = f.init === null ? undefined : evaluate(f.init, env);
  return { kind: "record", fields };
}

function fieldOf(e: Extract<Expr, { kind: "field" }>, target: Value): Value {
  if (target.kind !== "record") throw bug(`Field access got ${target.kind}`);
  const v = target.fields[e.name];
  if (v === undefined) throw new RunError("E-RUN-NO-VALUE", e.span, { name: `${e.text}.${e.name}` });
  return v;
}

function enumOf(v: Value): Extract<Value, { kind: "enum" }> {
  if (v.kind !== "enum") throw bug(`An enumerated value got ${v.kind}`);
  return v;
}

function enumStep(e: Extract<Expr, { kind: "enumStep" }>, from: Value, by: Value): Value {
  const v = enumOf(from);
  const steps = asIndex(by);
  const to = v.ordinal + steps;
  if (v.names[to] === undefined || to < 0) {
    throw new RunError("E-RUN-ENUM-RANGE", e.span, { value: v.names[v.ordinal] ?? "", type: v.type, steps });
  }
  return { kind: "enum", type: v.type, names: v.names, ordinal: to };
}

/** CIE-23: copies an array and any arrays inside it; other values are immutable, so they are shared. */
export function copyOf(v: Value): Value {
  if (v.kind === "record") {
    const fields: Record<string, Value | undefined> = {};
    for (const [k, x] of Object.entries(v.fields)) fields[k] = x === undefined ? undefined : copyOf(x);
    return { kind: "record", fields };
  }
  return v.kind === "array" ? array(v.elements.map((x) => (x === undefined ? undefined : copyOf(x)))) : v;
}

function element(node: Extract<Expr, { kind: "index" }>, target: Value, index: Value): Value {
  const shown = asIndex(index);
  const i = shown - node.base;
  if (target.kind === "array") {
    if (i < 0 || i >= target.elements.length) throw indexError(node, shown, target);
    const item = target.elements[i];
    if (item === undefined) throw new RunError("E-RUN-ARRAY-GAP", node.span, { array: node.text, index: shown });
    return item;
  }
  if (target.kind === "str") {
    const chars = characters(target.value);
    const c = chars[i];
    if (i < 0 || c === undefined) throw indexError(node, shown, target);
    return char(c);
  }
  throw bug(`Indexing got ${target.kind}`);
}

/** Built-in functions: LENGTH (EDX-90) and RANDOM (EDX-91). */
function builtin(e: Extract<Expr, { kind: "builtin" }>, args: Value[], env: Env): Value {
  const [x] = args;
  if (e.name === "random") {
    if (x?.kind !== "int") throw bug(`RANDOM got ${x?.kind ?? "nothing"}`);
    if (x.value < 0) throw new RunError("E-RUN-RANDOM-RANGE", e.span, { value: x.value });
    return int(env.machine.random(x.value));
  }
  if (e.name !== "length") return cieBuiltin(e.name, args, e.span, env.machine);
  if (x?.kind === "array") return int(x.elements.length);
  if (x?.kind === "str" || x?.kind === "char") return int(characterCount(x.value));
  throw bug(`${e.name} got ${x?.kind ?? "nothing"}`);
}

/** Evaluates an expression that contains no call (no generator needed). */
function evaluate(e: Expr, env: Env): Value {
  if (isPyExpr(e)) throw bug("A Python expression must be evaluated by the generator path");
  switch (e.kind) {
    case "literal":
      return e.value.kind === "int" ? int(e.value.value) : e.value.kind === "real" ? real(e.value.value) : e.value;
    case "var":
      return read(e, env);
    case "binary":
      return binary(e.op, e.symbol, evaluate(e.left, env), evaluate(e.right, env), e.span, env.machine.format);
    case "logical": {
      const left = asBoolean(evaluate(e.left, env));
      if (e.op === "andThen" ? !left : left) return { kind: "bool", value: left };
      return { kind: "bool", value: asBoolean(evaluate(e.right, env)) };
    }
    case "unary":
      return unary(e.op, evaluate(e.operand, env));
    case "index":
      return element(e, evaluate(e.target, env), evaluate(e.index, env));
    case "arrayLiteral":
      return array(e.elements.map((x) => evaluate(x, env)));
    case "newArray":
      return unsetArray(e.dims, e.fill, env);
    case "newRecord":
      return newRecord(e, env);
    case "field":
      return fieldOf(e, evaluate(e.target, env));
    case "enumValue":
      return { kind: "enum", type: e.type, names: e.names, ordinal: e.ordinal };
    case "enumStep":
      return enumStep(e, evaluate(e.operand, env), evaluate(e.by, env));
    case "enumOrdinal":
      return int(enumOf(evaluate(e.operand, env)).ordinal);
    case "copyArray":
      return copyOf(evaluate(e.source, env));
    case "builtin":
      return builtin(
        e,
        e.args.map((x) => evaluate(x, env)),
        env,
      );
    case "fail":
      throw new RunError(e.code, e.span, e.args);
    case "call":
      throw bug("A call must be evaluated by the generator path");
    default: {
      const unreachable: never = e;
      throw bug(`Unknown expression ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Evaluates any expression; only parts that contain a call go through generators. */
export function* evaluateWithCalls(e: Expr, env: Env): Run<Value> {
  if (isPyExpr(e)) return yield* pyEval(e, env);
  if (!hasCall(e)) return evaluate(e, env);
  switch (e.kind) {
    case "binary": {
      const left = yield* evaluateWithCalls(e.left, env);
      const right = yield* evaluateWithCalls(e.right, env);
      return binary(e.op, e.symbol, left, right, e.span, env.machine.format);
    }
    case "logical": {
      const left = asBoolean(yield* evaluateWithCalls(e.left, env));
      if (e.op === "andThen" ? !left : left) return { kind: "bool", value: left };
      return { kind: "bool", value: asBoolean(yield* evaluateWithCalls(e.right, env)) };
    }
    case "unary":
      return unary(e.op, yield* evaluateWithCalls(e.operand, env));
    case "index": {
      const target = yield* evaluateWithCalls(e.target, env);
      return element(e, target, yield* evaluateWithCalls(e.index, env));
    }
    case "arrayLiteral":
      return array(yield* evaluateAll(e.elements, env));
    case "field":
      return fieldOf(e, yield* evaluateWithCalls(e.target, env));
    case "enumStep":
      return enumStep(e, yield* evaluateWithCalls(e.operand, env), yield* evaluateWithCalls(e.by, env));
    case "enumOrdinal":
      return int(enumOf(yield* evaluateWithCalls(e.operand, env)).ordinal);
    case "copyArray":
      return copyOf(yield* evaluateWithCalls(e.source, env));
    case "builtin":
      return builtin(e, yield* evaluateAll(e.args, env), env);
    case "call": {
      const args = yield* evaluateAll(e.args, env);
      const result = yield { type: "call", callee: e.callee, args, span: e.span };
      if (result === undefined) throw bug(`${e.callee} returned no value`);
      return result as Value;
    }
    default:
      throw bug(`${e.kind} has no call inside`);
  }
}

export function* evaluateAll(list: readonly Expr[], env: Env): Run<Value[]> {
  const values: Value[] = [];
  for (const e of list) values.push(yield* evaluateWithCalls(e, env));
  return values;
}

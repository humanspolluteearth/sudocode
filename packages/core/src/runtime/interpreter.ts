// The tree-walking interpreter over the core IR.
//
// Compiler concept: a *tree-walking interpreter* runs a program by visiting its tree nodes. Ours is written with
// generator functions (`function*`): before each statement it `yield`s a "step" request, which lets the driver
// pause (breakpoints, stepping, Stop, the SH-14 step limit) without the interpreter knowing why. A subprogram call
// also `yield`s, as a "call" request: the driver starts the callee on its own explicit stack and later resumes the
// caller with the result. So interpreted calls never nest JavaScript frames (see driver.ts).
import type { Span } from "../diagnostics.ts";
import type { AssignTarget, Expr, Stmt, Subprogram, VarRef } from "../ir/ir.ts";
import {
  asBoolean,
  asIndex,
  bug,
  evaluateAll,
  evaluateWithCalls,
  indexError,
  read,
  slot,
  type Body,
  type Env,
  type Machine,
  type Returned,
  type Run,
} from "./evaluate.ts";
import { formatValue } from "./format.ts";
import { convertInput } from "./input.ts";
import { RunError } from "./run-error.ts";
import { array, char, characters, int, real, type Value } from "./values.ts";

/** The name of a file: a plain string (Edexcel) or an expression (Cambridge, where it may be a variable). */
function* fileName(file: string | Expr, env: Env): Run<string> {
  if (typeof file === "string") return file;
  const v = yield* evaluateWithCalls(file, env);
  if (v.kind !== "str") throw bug(`A file name was ${v.kind}`);
  return v.value;
}

export type { Body, Machine, Request } from "./evaluate.ts";

// ---------- statements

function* assign(target: AssignTarget, value: Value, env: Env): Run<undefined> {
  if (target.kind === "var") {
    setVariable(target, value, env, target.span);
    return undefined;
  }
  if (target.kind === "field") {
    // CIE-30: the record is found first (it may be `Form[2]` or `A.Inner`), then the field is set on the stored one.
    const record = yield* evaluateWithCalls(target.record, env);
    if (record.kind !== "record") throw bug(`Field assignment got ${record.kind}`);
    record.fields[target.name] = value;
    env.machine.assigned(target.root.name, read(target.root, env), target.span);
    return undefined;
  }
  const whole = read(target.array, env);
  let arr = whole;
  let shown = asIndex(yield* evaluateWithCalls(target.index, env));
  let i = shown - target.base;
  if (arr.kind !== "array") throw bug(`Element assignment got ${arr.kind}`);
  let where = { text: target.text, span: target.span, base: target.base };
  if (target.index2 !== undefined) {
    // EDX-24: grid[row, col] first finds the row, which must already exist, then the item inside it.
    if (i < 0 || i >= arr.elements.length) throw indexError(where, shown, arr);
    const row = arr.elements[i];
    if (row === undefined) throw new RunError("E-RUN-ARRAY-GAP", target.span, { array: target.text, index: shown });
    if (row.kind !== "array") throw bug(`A grid row is ${row.kind}`);
    arr = row;
    where = { ...where, base: target.base2 ?? target.base, text: `${target.array.name}[${String(shown)}]` }; // a bad column is outside the row, e.g. grid[0]
    shown = asIndex(yield* evaluateWithCalls(target.index2, env));
    i = shown - (target.base2 ?? target.base);
  }
  if (i < 0 || (i >= arr.elements.length && !target.growOnWrite)) throw indexError(where, shown, arr);
  if (i >= arr.elements.length) {
    // EDX-27: writing past the end grows the array; the gap has no value until it is set.
    while (arr.elements.length <= i) arr.elements.push(undefined);
    env.machine.note("I-EDX-ARRAY-GROWS", target.span, { array: target.text, length: i + 1, index: shown });
  }
  arr.elements[i] = value;
  env.machine.assigned(target.array.name, whole, target.span); // D5: the trace records the whole array
  return undefined;
}

/** Sets a variable and records it in the trace table (SH-17: every assignment, with its line). */
function setVariable(ref: VarRef, value: Value, env: Env, span: Span): void {
  slot(ref, env).set(ref.name, value);
  env.machine.assigned(ref.name, value, span);
}

function* block(stmts: readonly Stmt[], env: Env): Run<Returned | undefined> {
  for (const s of stmts) {
    yield { type: "step", span: s.span };
    const done = yield* statement(s, env);
    if (done !== undefined) return done;
  }
  return undefined;
}

function number(v: Value, what: string): number {
  if (v.kind !== "int" && v.kind !== "real") throw bug(`${what} got ${v.kind}`);
  return v.value;
}

function* statement(s: Stmt, env: Env): Run<Returned | undefined> {
  switch (s.kind) {
    case "assign": {
      // As in Python, the value is worked out before the target's index.
      const value = yield* evaluateWithCalls(s.value, env);
      yield* assign(s.target, value, env);
      return undefined;
    }
    case "output": {
      const text = formatValue(yield* evaluateWithCalls(s.value, env), env.machine.format);
      env.machine.output(s.device === null ? `${text}\n` : `[${s.device}] ${text}\n`, s.span);
      return undefined;
    }
    case "input": {
      // The driver waits for the line (SH-05) and resumes this generator with it as a STRING.
      const line = (yield { type: "input", prompt: s.prompt ?? "", device: s.device, span: s.span }) as
        Value | undefined;
      if (line?.kind !== "str") throw bug("Input resumed without a line");
      yield* assign(s.target, convertInput(line.value, s.convert, s.span), env);
      return undefined;
    }
    case "fileRead": {
      const file = yield* fileName(s.file, env);
      const line = env.machine.readLine(file, s.span, s.strict === true);
      setVariable(s.target, convertInput(line, s.convert, s.span, file), env, s.span);
      return undefined;
    }
    case "fileWrite": {
      const file = yield* fileName(s.file, env);
      const text = formatValue(yield* evaluateWithCalls(s.value, env), env.machine.format);
      env.machine.writeLine(file, text, s.span, s.strict === true);
      return undefined;
    }
    case "fileOpen":
      env.machine.openFile(yield* fileName(s.file, env), s.mode, s.span);
      return undefined;
    case "fileClose":
      env.machine.closeFile(yield* fileName(s.file, env), s.span);
      return undefined;
    case "fileSeek": {
      const file = yield* fileName(s.file, env);
      const address = yield* evaluateWithCalls(s.address, env);
      if (address.kind !== "int") throw bug(`SEEK got ${address.kind}`);
      env.machine.seek(file, address.value, s.span);
      return undefined;
    }
    case "fileGet": {
      const file = yield* fileName(s.file, env);
      yield* assign(s.target, env.machine.getRecord(file, s.span), env);
      return undefined;
    }
    case "filePut": {
      const file = yield* fileName(s.file, env);
      env.machine.putRecord(file, yield* evaluateWithCalls(s.value, env), s.span);
      return undefined;
    }
    case "if": {
      const yes = asBoolean(yield* evaluateWithCalls(s.condition, env));
      return yield* block(yes ? s.then : s.else, env);
    }
    case "tryCatch": {
      // Exception handling: the driver re-throws a failing call's RunError into this generator, so a JS
      // try/catch around the delegated `yield*` catches errors from the body and from subprograms it calls.
      try {
        return yield* block(s.body, env);
      } catch (e) {
        if (!(e instanceof RunError)) throw e;
        return yield* block(s.handler, env);
      }
    }
    case "while":
      while (asBoolean(yield* evaluateWithCalls(s.condition, env))) {
        const done = yield* block(s.body, env);
        if (done !== undefined) return done;
        yield { type: "step", span: s.span }; // every test of the condition is a step (SH-14 catches empty loops)
      }
      return undefined;
    case "repeatUntil":
      for (;;) {
        const done = yield* block(s.body, env);
        if (done !== undefined) return done;
        yield { type: "step", span: s.condition.span };
        if (asBoolean(yield* evaluateWithCalls(s.condition, env))) return undefined;
      }
    case "repeatTimes": {
      const count = yield* evaluateWithCalls(s.count, env);
      if (count.kind !== "int") throw bug(`REPEAT TIMES got ${count.kind}`);
      for (let k = 0; k < count.value; k++) {
        if (k > 0) yield { type: "step", span: s.span };
        const done = yield* block(s.body, env);
        if (done !== undefined) return done;
      }
      return undefined;
    }
    case "forInclusive":
      return yield* forInclusive(s, env);
    case "forEach":
      return yield* forEach(s, env);
    case "callStatement": {
      const args = yield* evaluateAll(s.args, env);
      const back = (yield { type: "call", callee: s.callee, args, span: s.span }) as Value | undefined;
      if (s.outs !== undefined && back !== undefined && back.kind === "array") {
        let k = 0;
        for (const place of s.outs) {
          if (place === null) continue;
          const final = back.elements[k++];
          if (final !== undefined) yield* assign(place, final, env);
        }
      }
      return undefined;
    }
    case "return":
      return { value: s.value === null ? undefined : yield* evaluateWithCalls(s.value, env) };
    default: {
      const unreachable: never = s;
      throw bug(`Unknown statement ${JSON.stringify(unreachable)}`);
    }
  }
}

function* forInclusive(s: Extract<Stmt, { kind: "forInclusive" }>, env: Env): Run<Returned | undefined> {
  // EDX-55: start, end and step are evaluated once, before the loop.
  const startValue = yield* evaluateWithCalls(s.start, env);
  const endValue = yield* evaluateWithCalls(s.end, env);
  const stepValue = s.step === null ? int(1) : yield* evaluateWithCalls(s.step, env);
  const start = number(startValue, "FOR start");
  const end = number(endValue, "FOR end");
  const step = number(stepValue, "FOR step");
  if (step === 0) throw new RunError("E-RUN-STEP-ZERO", s.step?.span ?? s.span);
  const ints = startValue.kind === "int" && stepValue.kind === "int";
  for (let k = 0; ; k++) {
    // The loop's own counter: assigning to the variable inside the body doesn't change the next value.
    const v = start + k * step;
    if (step > 0 ? v > end : v < end) return undefined;
    if (k > 0) yield { type: "step", span: s.span };
    setVariable(s.variable, ints ? int(v) : real(v), env, s.span);
    const done = yield* block(s.body, env);
    if (done !== undefined) return done;
  }
}

function* forEach(s: Extract<Stmt, { kind: "forEach" }>, env: Env): Run<Returned | undefined> {
  const items = yield* evaluateWithCalls(s.iterable, env);
  let next: (i: number) => Value | undefined | null; // null: no more items; undefined: a gap (EDX-27)
  if (items.kind === "array") {
    // Visited live, by position, as Python does.
    next = (i) => (i < items.elements.length ? items.elements[i] : null);
  } else if (items.kind === "str") {
    const chars = characters(items.value);
    next = (i) => {
      const c = chars[i];
      return c === undefined ? null : char(c);
    };
  } else {
    throw bug(`FOR EACH got ${items.kind}`);
  }
  for (let i = 0; ; i++) {
    const item = next(i);
    if (item === null) return undefined;
    if (i > 0) yield { type: "step", span: s.span };
    if (item === undefined) {
      const name = s.iterable.kind === "var" ? s.iterable.name : "the array";
      throw new RunError("E-RUN-ARRAY-GAP", s.iterable.span, { array: name, index: i });
    }
    setVariable(s.variable, item, env, s.span);
    const done = yield* block(s.body, env);
    if (done !== undefined) return done;
  }
}

// ---------- entry points for the driver

export function* runMain(main: readonly Stmt[], machine: Machine): Body {
  yield* block(main, { machine, locals: null });
  return undefined;
}

/** Runs one call. `locals` starts empty; the driver keeps a reference to show the frame's variables. */
export function* runSubprogram(
  sub: Subprogram,
  args: readonly Value[],
  machine: Machine,
  locals: Map<string, Value>,
): Body {
  sub.params.forEach((p, i) => {
    const arg = args[i];
    if (arg === undefined) throw bug(`${sub.name} got too few arguments`);
    locals.set(p, arg);
  });
  const done = yield* block(sub.body, { machine, locals });
  if (sub.kind === "function" && done?.value === undefined) {
    throw new RunError("E-RUN-NO-RETURN", sub.span, { name: sub.name });
  }
  if (sub.kind === "procedure" && sub.byRef?.includes(true) === true) {
    // BYREF copy-out (CIE-73): hand the final values of the BYREF parameters back, in parameter order.
    const finals = sub.params.flatMap((p, i) => (sub.byRef?.[i] === true ? [locals.get(p)] : []));
    return array(finals);
  }
  return done?.value;
}

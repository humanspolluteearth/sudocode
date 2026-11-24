// Python's built-in functions (PY-30 to PY-36). Functions that call back into student code (sorted(key=...),
// map, filter, min/max with key) are generators: they `yield` a call request like any other call (trampolined
// calls, runtime/driver.ts), so a callback never nests JavaScript frames.
import type { Span } from "../../diagnostics.ts";
import type { Env, Run } from "../evaluate.ts";
import { bool, list, NONE, pyint, real, str, tuple, type Value } from "../values.ts";
import { callValue } from "./call.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { arith, asBig, compareOrder, isNumeric, pyRound, toFloat } from "./numbers.ts";
import { pyStr, pyTypeName } from "./repr.ts";
import { iterate, lengthOf, repr, sortPairs, truthy } from "./seq.ts";
import { setOrder } from "./hash.ts";
import { formatWithSpec } from "./format-spec.ts";
import { callModuleFunction } from "./modules.ts";
import { openFile } from "./files.ts";
import { prepare } from "./class-calls.ts";
import { baseInitialise, isClassSubclass } from "./classes.ts";

export const BUILTIN_FUNCTIONS = new Set([
  "print",
  "open",
  "input",
  "len",
  "abs",
  "min",
  "max",
  "sum",
  "round",
  "divmod",
  "pow",
  "sorted",
  "reversed",
  "enumerate",
  "zip",
  "any",
  "all",
  "map",
  "filter",
  "ord",
  "chr",
  "isinstance",
  "type",
  "repr",
  "hex",
  "format",
  "bin",
  "oct",
  "issubclass",
]);

type Kwargs = Map<string, Value>;

const exactly = (name: string, args: Value[], n: number, span: Span): void => {
  if (args.length !== n) {
    throw typeError(
      `${name}() takes exactly ${n === 1 ? "one argument" : `${String(n)} arguments`} (${String(args.length)} given)`,
      span,
    );
  }
};

const bigOf = (v: Value | undefined, span: Span): bigint => {
  const n = v === undefined ? null : asBig(v);
  if (n === null)
    throw typeError(
      `'${v === undefined ? "NoneType" : pyTypeName(v)}' object cannot be interpreted as an integer`,
      span,
    );
  return n;
};

/** Python 3.12's float sum is compensated (Neumaier), so sum([0.1] * 10) is exactly 1.0. */
function sumValues(items: Value[], start: Value, span: Span): Value {
  let acc = start;
  let i = 0;
  while (i < items.length && !(acc.kind === "real" || (items[i] as Value).kind === "real")) {
    acc = arith("add", acc, items[i] as Value, span);
    i++;
  }
  if (i < items.length && isNumeric(acc) && isNumeric(items[i] as Value)) {
    let f = toFloat(acc);
    let c = 0;
    while (i < items.length && isNumeric(items[i] as Value)) {
      const x = toFloat(items[i] as Value);
      const t = f + x;
      if (Number.isFinite(t)) c += Math.abs(f) >= Math.abs(x) ? f - t + x : x - t + f;
      f = t;
      i++;
    }
    acc = real(Number.isFinite(c) && c !== 0 ? f + c : f);
  }
  for (; i < items.length; i++) acc = arith("add", acc, items[i] as Value, span);
  return acc;
}

function modPow(base: bigint, exp: bigint, mod: bigint, span: Span): Value {
  if (mod === 0n) throw valueError("pow() 3rd argument cannot be 0", span);
  if (exp < 0n) throw valueError("base is not invertible for the given modulus", span);
  const m = mod < 0n ? -mod : mod;
  let result = 1n;
  let b = ((base % m) + m) % m;
  for (let e = exp; e > 0n; e >>= 1n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
  }
  return pyint(mod < 0n && result !== 0n ? result + mod : result);
}

function radix(name: string, prefix: string, base: number, v: Value | undefined, span: Span): Value {
  const n = v === undefined ? null : asBig(v);
  if (n === null)
    throw typeError(
      `'${v === undefined ? "NoneType" : pyTypeName(v)}' object cannot be interpreted as an integer`,
      span,
    );
  return str(`${n < 0n ? "-" : ""}${prefix}${(n < 0n ? -n : n).toString(base)}`);
}

export function typeMatches(value: Value, cls: Value, span: Span): boolean {
  if (cls.kind === "tuple") return cls.items.some((c) => typeMatches(value, c, span));
  if (cls.kind === "class") return value.kind === "instance" && value.cls.mro.includes(cls);
  if (cls.kind !== "type") throw typeError("isinstance() arg 2 must be a type, a tuple of types, or a union", span);
  if (value.kind === "instance")
    return cls.name === "object" || value.cls.mro.some((c) => c.kind === "type" && c.name === cls.name);
  const own = pyTypeName(value);
  if (own === cls.name) return true;
  if (cls.name === "int" && value.kind === "bool") return true;
  if (cls.name === "date" && value.kind === "moment" && value.type === "datetime") return true;
  if (value.kind === "exc") return isSubclassName(value.name, cls.name);
  return cls.name === "object";
}

import { isSubclass } from "./errors.ts";
const isSubclassName = isSubclass;

export function* callBuiltin(name: string, args: Value[], kwargs: Kwargs, env: Env, span: Span): Run<Value> {
  const a0 = args[0];
  if (name.includes(".")) return yield* callModuleFunction(name, args, env, span);
  switch (name) {
    case "print": {
      const sep = kwargs.get("sep");
      const end = kwargs.get("end");
      for (const a of args) yield* prepare(a, env, span);
      const text = args
        .map((a) => pyStr(a, setOrder))
        .join(sep === undefined || sep.kind === "none" ? " " : pyStr(sep, setOrder));
      env.machine.output(text + (end === undefined || end.kind === "none" ? "\n" : pyStr(end, setOrder)), span);
      return NONE;
    }
    case "open":
      return openFile(args, kwargs, env.machine, span);
    case "input": {
      const prompt = a0 === undefined ? "" : pyStr(a0, setOrder);
      const line = (yield { type: "input", prompt, device: null, span }) as Value | undefined;
      if (line === undefined || line.kind !== "str") throw new Error("Input resumed without a line");
      return line;
    }
    case "len":
      exactly("len", args, 1, span);
      return pyint(BigInt(lengthOf(a0 as Value, span)));
    case "abs": {
      exactly("abs", args, 1, span);
      const v = a0 as Value;
      if (v.kind === "real") return real(Math.abs(v.value));
      const n = asBig(v);
      if (n === null) throw typeError(`bad operand type for abs(): '${pyTypeName(v)}'`, span);
      return pyint(n < 0n ? -n : n);
    }
    case "min":
    case "max": {
      const items = args.length === 1 ? iterate(a0 as Value, span) : args;
      const key = kwargs.get("key");
      const symbol = name === "min" ? "<" : ">";
      if (items.length === 0) {
        const d = kwargs.get("default");
        if (d !== undefined) return d;
        throw valueError(`${name}() iterable argument is empty`, span);
      }
      let best = items[0] as Value;
      let bestKey =
        key === undefined || key.kind === "none" ? best : yield* callValue(key, [best], new Map(), env, span);
      for (const item of items.slice(1)) {
        const k = key === undefined || key.kind === "none" ? item : yield* callValue(key, [item], new Map(), env, span);
        if (compareOrder(k, bestKey, symbol, span) * (name === "min" ? 1 : -1) < 0) {
          best = item;
          bestKey = k;
        }
      }
      return best;
    }
    case "sum":
      return sumValues(iterate(a0 ?? NONE, span), args[1] ?? kwargs.get("start") ?? pyint(0n), span);
    case "round":
      return pyRound(a0 ?? NONE, args[1] === undefined || args[1].kind === "none" ? null : args[1], span);
    case "divmod":
      exactly("divmod", args, 2, span);
      return tuple([
        arith("floordiv", a0 as Value, args[1] as Value, span),
        arith("mod", a0 as Value, args[1] as Value, span),
      ]);
    case "pow": {
      const [b, e, m] = [a0 ?? NONE, args[1] ?? NONE, args[2]];
      if (m !== undefined && m.kind !== "none") return modPow(bigOf(b, span), bigOf(e, span), bigOf(m, span), span);
      return arith("pow", b, e, span);
    }
    case "sorted": {
      const key = kwargs.get("key");
      const items = iterate(a0 ?? NONE, span);
      const pairs: { key: Value; item: Value }[] = [];
      for (const item of items)
        pairs.push({
          key: key === undefined || key.kind === "none" ? item : yield* callValue(key, [item], new Map(), env, span),
          item,
        });
      return list(sortPairs(pairs, truthy(kwargs.get("reverse") ?? NONE), span));
    }
    case "reversed":
      return list(
        iterate(a0 ?? NONE, span)
          .slice()
          .reverse(),
      );
    case "enumerate": {
      const start = bigOf(args[1] ?? kwargs.get("start") ?? pyint(0n), span);
      return list(iterate(a0 ?? NONE, span).map((x, i) => tuple([pyint(start + BigInt(i)), x])));
    }
    case "zip": {
      const lists = args.map((a) => iterate(a, span));
      const n = lists.length === 0 ? 0 : Math.min(...lists.map((l) => l.length));
      return list(Array.from({ length: n }, (_, i) => tuple(lists.map((l) => l[i] as Value))));
    }
    case "any":
      return bool(iterate(a0 ?? NONE, span).some(truthy));
    case "all":
      return bool(iterate(a0 ?? NONE, span).every(truthy));
    case "map": {
      const f = a0 ?? NONE;
      const lists = args.slice(1).map((a) => iterate(a, span));
      const n = Math.min(...lists.map((l) => l.length));
      const out: Value[] = [];
      for (let i = 0; i < n; i++)
        out.push(
          yield* callValue(
            f,
            lists.map((l) => l[i] as Value),
            new Map(),
            env,
            span,
          ),
        );
      return list(out);
    }
    case "filter": {
      const f = a0 ?? NONE;
      const out: Value[] = [];
      for (const item of iterate(args[1] ?? NONE, span)) {
        const keep = f.kind === "none" ? truthy(item) : truthy(yield* callValue(f, [item], new Map(), env, span));
        if (keep) out.push(item);
      }
      return list(out);
    }
    case "ord": {
      const v = a0 ?? NONE;
      if (v.kind !== "str" && v.kind !== "char")
        throw typeError(`ord() expected string of length 1, but ${pyTypeName(v)} found`, span);
      const cs = Array.from(v.value);
      if (cs.length !== 1)
        throw typeError(`ord() expected a character, but string of length ${String(cs.length)} found`, span);
      return pyint(BigInt(cs[0]?.codePointAt(0) ?? 0));
    }
    case "chr": {
      const n = bigOf(a0, span);
      if (n < 0n || n >= 0x110000n) throw valueError("chr() arg not in range(0x110000)", span);
      return str(String.fromCodePoint(Number(n)));
    }
    case "isinstance":
      exactly("isinstance", args, 2, span);
      return bool(typeMatches(a0 as Value, args[1] as Value, span));
    case "type":
      exactly("type", args, 1, span);
      if ((a0 as Value).kind === "instance") return (a0 as Extract<Value, { kind: "instance" }>).cls;
      return { kind: "type", name: pyTypeName(a0 as Value) };
    case "repr":
      exactly("repr", args, 1, span);
      yield* prepare(a0 as Value, env, span, "repr");
      return str(repr(a0 as Value));
    case "issubclass": {
      exactly("issubclass", args, 2, span);
      const [c, t] = [a0 as Value, args[1] as Value];
      if (c.kind !== "class" && c.kind !== "type") throw typeError("issubclass() arg 1 must be a class", span);
      const targets = t.kind === "tuple" ? t.items : [t];
      const own = c.kind === "class" ? c : null;
      return bool(
        targets.some((x) =>
          own !== null
            ? isClassSubclass(own, x)
            : x.kind === "type" && (x.name === "object" || isSubclassName((c as { name: string }).name, x.name)),
        ),
      );
    }
    case "$base_init":
      baseInitialise(a0 ?? NONE, args.slice(1));
      return NONE;
    case "format": {
      if (args.length < 1 || args.length > 2)
        throw typeError(`format expected at most 2 arguments, got ${String(args.length)}`, span);
      const spec = args[1];
      if (spec !== undefined && spec.kind !== "str")
        throw typeError(`format() argument 2 must be str, not ${pyTypeName(spec)}`, span);
      return str(formatWithSpec(a0 as Value, spec?.value ?? "", span));
    }
    case "hex":
      return radix(name, "0x", 16, a0, span);
    case "bin":
      return radix(name, "0b", 2, a0, span);
    case "oct":
      return radix(name, "0o", 8, a0, span);
    default:
      throw pyError("NameError", `name '${name}' is not defined`, span);
  }
}

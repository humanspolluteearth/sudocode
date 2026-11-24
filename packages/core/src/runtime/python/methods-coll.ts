// list, tuple, dict and set methods (PY-32, PY-33, PY-34, PY-35).
import type { Span } from "../../diagnostics.ts";
import { bool, list, NONE, pyint, tuple, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { hashKey, pyEq } from "./hash.ts";
import { asBig } from "./numbers.ts";
import { pyTypeName } from "./repr.ts";
import { iterate, repr } from "./seq.ts";
import type { CallArgs } from "./methods-str.ts";

const index = (v: Value | undefined, span: Span): number => {
  const n = v === undefined ? null : asBig(v);
  if (n === null)
    throw typeError(
      `'${v === undefined ? "NoneType" : pyTypeName(v)}' object cannot be interpreted as an integer`,
      span,
    );
  return Number(n);
};

export function newDict(pairs: [Value, Value][], span: Span): Value {
  const map = new Map<string, { key: Value; value: Value }>();
  for (const [key, value] of pairs) {
    const h = hashKey(key, span);
    const old = map.get(h);
    if (old === undefined) map.set(h, { key, value });
    else old.value = value; // a repeated key keeps its first position, with the newest value
  }
  return { kind: "dict", map };
}

export function newSet(items: Value[], span: Span): Value {
  const map = new Map<string, Value>();
  for (const v of items) {
    const h = hashKey(v, span);
    if (!map.has(h)) map.set(h, v);
  }
  return { kind: "set", map };
}

export function listMethod(
  l: Extract<Value, { kind: "list" }>,
  name: string,
  { args }: CallArgs,
  span: Span,
): Value | undefined {
  const a0 = args[0];
  const items = l.items;
  switch (name) {
    case "append":
      items.push(a0 ?? NONE);
      return NONE;
    case "extend":
      items.push(...(a0 === undefined ? [] : iterate(a0, span)));
      return NONE;
    case "insert": {
      let i = index(a0, span);
      if (i < 0) i = Math.max(0, items.length + i);
      items.splice(Math.min(i, items.length), 0, args[1] ?? NONE);
      return NONE;
    }
    case "pop": {
      if (items.length === 0) throw pyError("IndexError", "pop from empty list", span);
      let i = a0 === undefined ? items.length - 1 : index(a0, span);
      if (i < 0) i += items.length;
      if (i < 0 || i >= items.length) throw pyError("IndexError", "pop index out of range", span);
      return items.splice(i, 1)[0];
    }
    case "remove": {
      const i = items.findIndex((x) => pyEq(x, a0 ?? NONE));
      if (i < 0) throw valueError("list.remove(x): x not in list", span);
      items.splice(i, 1);
      return NONE;
    }
    case "clear":
      items.length = 0;
      return NONE;
    case "copy":
      return list(items.slice());
    case "reverse":
      items.reverse();
      return NONE;
    case "index":
    case "count":
      return seqSearch(items, name, args, "list", span);
    default:
      return undefined;
  }
}

function seqSearch(items: Value[], name: string, args: Value[], what: string, span: Span): Value {
  const target = args[0] ?? NONE;
  if (name === "count") return pyint(BigInt(items.filter((x) => pyEq(x, target)).length));
  const i = items.findIndex((x) => pyEq(x, target));
  if (i < 0) throw valueError(`${repr(target)} is not in ${what}`, span);
  return pyint(BigInt(i));
}

export function tupleMethod(
  t: Extract<Value, { kind: "tuple" }>,
  name: string,
  { args }: CallArgs,
  span: Span,
): Value | undefined {
  return name === "index" || name === "count" ? seqSearch(t.items, name, args, "tuple", span) : undefined;
}

function pairsOf(v: Value, span: Span): [Value, Value][] {
  if (v.kind === "dict") return [...v.map.values()].map((e): [Value, Value] => [e.key, e.value]);
  return iterate(v, span).map((p): [Value, Value] => {
    const kv = iterate(p, span);
    if (kv.length !== 2)
      throw valueError(`dictionary update sequence element has length ${String(kv.length)}; 2 is required`, span);
    return [kv[0] as Value, kv[1] as Value];
  });
}

export function dictMethod(
  d: Extract<Value, { kind: "dict" }>,
  name: string,
  { args, kwargs }: CallArgs,
  span: Span,
): Value | undefined {
  const a0 = args[0] ?? NONE;
  switch (name) {
    case "get":
      return d.map.get(hashKey(a0, span))?.value ?? args[1] ?? NONE;
    case "setdefault": {
      const h = hashKey(a0, span);
      const old = d.map.get(h);
      if (old !== undefined) return old.value;
      d.map.set(h, { key: a0, value: args[1] ?? NONE });
      return args[1] ?? NONE;
    }
    case "pop": {
      const h = hashKey(a0, span);
      const old = d.map.get(h);
      if (old === undefined) {
        if (args[1] !== undefined) return args[1];
        throw pyError("KeyError", repr(a0), span);
      }
      d.map.delete(h);
      return old.value;
    }
    case "popitem": {
      const last = [...d.map.entries()].pop();
      if (last === undefined) throw pyError("KeyError", "'popitem(): dictionary is empty'", span);
      d.map.delete(last[0]);
      return tuple([last[1].key, last[1].value]);
    }
    case "update": {
      const add = [
        ...(args[0] === undefined ? [] : pairsOf(args[0], span)),
        ...[...kwargs].map(([k, v]): [Value, Value] => [{ kind: "str", value: k }, v]),
      ];
      for (const [k, v] of add) {
        const h = hashKey(k, span);
        const old = d.map.get(h);
        if (old === undefined) d.map.set(h, { key: k, value: v });
        else old.value = v;
      }
      return NONE;
    }
    // keys(), values() and items() give lists, not live views (documented difference, M8.md).
    case "keys":
      return list([...d.map.values()].map((e) => e.key));
    case "values":
      return list([...d.map.values()].map((e) => e.value));
    case "items":
      return list([...d.map.values()].map((e) => tuple([e.key, e.value])));
    case "clear":
      d.map.clear();
      return NONE;
    case "copy":
      return { kind: "dict", map: new Map([...d.map].map(([k, e]) => [k, { ...e }])) };
    default:
      return undefined;
  }
}

const members = (v: Value, span: Span): Value[] => (v.kind === "set" ? [...v.map.values()] : iterate(v, span));

export function setMethod(
  s: Extract<Value, { kind: "set" }>,
  name: string,
  { args }: CallArgs,
  span: Span,
): Value | undefined {
  const a0 = args[0] ?? NONE;
  const mine = [...s.map.values()];
  const otherKeys = (): Set<string> => new Set(members(a0, span).map((x) => hashKey(x, span)));
  switch (name) {
    case "add": {
      const h = hashKey(a0, span);
      if (!s.map.has(h)) s.map.set(h, a0);
      return NONE;
    }
    case "remove": {
      if (!s.map.delete(hashKey(a0, span))) throw pyError("KeyError", repr(a0), span);
      return NONE;
    }
    case "discard":
      s.map.delete(hashKey(a0, span));
      return NONE;
    case "pop": {
      const first = s.map.keys().next();
      if (first.done === true) throw pyError("KeyError", "'pop from an empty set'", span);
      const v = s.map.get(first.value) as Value;
      s.map.delete(first.value);
      return v;
    }
    case "clear":
      s.map.clear();
      return NONE;
    case "copy":
      return newSet(mine, span);
    case "update":
      for (const x of members(a0, span)) s.map.set(hashKey(x, span), x);
      return NONE;
    case "union":
      return newSet([...mine, ...members(a0, span)], span);
    case "intersection": {
      const o = otherKeys();
      return newSet(
        mine.filter((x) => o.has(hashKey(x, span))),
        span,
      );
    }
    case "difference": {
      const o = otherKeys();
      return newSet(
        mine.filter((x) => !o.has(hashKey(x, span))),
        span,
      );
    }
    case "symmetric_difference": {
      const o = otherKeys();
      const theirs = members(a0, span);
      return newSet(
        [...mine.filter((x) => !o.has(hashKey(x, span))), ...theirs.filter((x) => !s.map.has(hashKey(x, span)))],
        span,
      );
    }
    case "issubset": {
      const o = otherKeys();
      return bool(mine.every((x) => o.has(hashKey(x, span))));
    }
    case "issuperset":
      return bool(members(a0, span).every((x) => s.map.has(hashKey(x, span))));
    case "isdisjoint": {
      const o = otherKeys();
      return bool(mine.every((x) => !o.has(hashKey(x, span))));
    }
    default:
      return undefined;
  }
}

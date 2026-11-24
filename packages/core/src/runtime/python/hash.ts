// Equality, hashing and set order for Python values (PY-34, PY-35).
//
// Compiler concept: a *hash key*. Python dicts and sets find an item by hash and equality, so 1, 1.0 and True are the
// same key. We map every hashable value to a string key and keep the real key beside it, in insertion order.
import type { Span } from "../../diagnostics.ts";
import type { Value } from "../values.ts";
import { typeError } from "./errors.ts";
import { pyTypeName } from "./repr.ts";

export function hashKey(v: Value, span: Span): string {
  switch (v.kind) {
    case "pyint":
      return `n:${v.value.toString()}`;
    case "int":
      return `n:${String(v.value)}`;
    case "bool":
      return v.value ? "n:1" : "n:0";
    case "real":
      return Number.isInteger(v.value) ? `n:${BigInt(v.value).toString()}` : `f:${String(v.value)}`;
    case "str":
    case "char":
      return `s:${v.value}`;
    case "none":
      return "N";
    case "tuple":
      return `t(${v.items.map((i) => hashKey(i, span)).join(",")})`;
    case "range":
      return `r:${String(v.start)}:${String(v.stop)}:${String(v.step)}`;
    case "func":
    case "builtin":
    case "type":
      return `o:${v.kind}:${"name" in v ? v.name : ""}`;
    default:
      throw typeError(`unhashable type: '${pyTypeName(v)}'`, span);
  }
}

const isNum = (v: Value): boolean => v.kind === "pyint" || v.kind === "bool" || v.kind === "real" || v.kind === "int";
function numVal(v: Value): bigint | number {
  if (v.kind === "pyint") return v.value;
  if (v.kind === "bool") return v.value ? 1n : 0n;
  if (v.kind === "int" || v.kind === "real") return v.value;
  return 0n;
}

/** Python `==`. */
export function pyEq(a: Value, b: Value): boolean {
  if (isNum(a) && isNum(b)) {
    const x = numVal(a);
    const y = numVal(b);
    if (typeof x === "bigint" && typeof y === "bigint") return x === y;
    if (typeof x === "number" && typeof y === "number") return x === y;
    const f = typeof x === "number" ? x : (y as number);
    const n = typeof x === "bigint" ? x : (y as bigint);
    return Number.isInteger(f) && BigInt(f) === n;
  }
  if ((a.kind === "str" || a.kind === "char") && (b.kind === "str" || b.kind === "char")) return a.value === b.value;
  if (a.kind === "none" || b.kind === "none") return a.kind === b.kind;
  if ((a.kind === "list" && b.kind === "list") || (a.kind === "tuple" && b.kind === "tuple")) {
    const y = (b as { items: Value[] }).items;
    return a.items.length === y.length && a.items.every((v, i) => pyEq(v, y[i] as Value));
  }
  if (a.kind === "dict" && b.kind === "dict") {
    if (a.map.size !== b.map.size) return false;
    for (const [k, e] of a.map) {
      const o = b.map.get(k);
      if (o === undefined || !pyEq(e.value, o.value)) return false;
    }
    return true;
  }
  if (a.kind === "set" && b.kind === "set") {
    if (a.map.size !== b.map.size) return false;
    for (const k of a.map.keys()) if (!b.map.has(k)) return false;
    return true;
  }
  if (a.kind === "range" && b.kind === "range") return a.start === b.start && a.stop === b.stop && a.step === b.step;
  if (a.kind === "exc" && b.kind === "exc") return a === b;
  if (a.kind === "func" && b.kind === "func") return a === b;
  if (a.kind === "instance" || a.kind === "class" || a.kind === "bound") return a === b; // identity, unless __eq__
  if ((a.kind === "type" || a.kind === "builtin") && a.kind === b.kind) return a.name === (b as { name: string }).name;
  return false;
}

const MASK64 = (1n << 64n) - 1n;
const MODULUS = (1n << 61n) - 1n;

function intHash(n: bigint): bigint {
  const m = (n < 0n ? -n : n) % MODULUS;
  const h = n < 0n ? -m : m;
  return h === -1n ? -2n : h;
}

/**
 * The order CPython iterates a set of whole numbers in (PY-35): it is a hash table of size 8 that grows ×4 when
 * 3/5 full. We replay the same inserts. Sets of other things keep insertion order (documented in M8.md).
 */
export function setOrder(items: Value[]): Value[] {
  if (items.length === 0 || !items.every((v) => v.kind === "pyint" || v.kind === "bool")) return items;
  let size = 8;
  let table: (Value | undefined)[] = new Array<Value | undefined>(size).fill(undefined);
  let fill = 0;
  const hashOf = (v: Value): bigint => intHash(v.kind === "pyint" ? v.value : v.kind === "bool" && v.value ? 1n : 0n);
  const place = (v: Value): void => {
    const h = hashOf(v) & MASK64;
    const mask = BigInt(size - 1);
    let perturb = h;
    let i = Number(h & mask);
    for (;;) {
      const probes = i + 9 <= size - 1 ? 9 : 0;
      for (let j = 0; j <= probes; j++) {
        if (table[i + j] === undefined) {
          table[i + j] = v;
          return;
        }
      }
      perturb >>= 5n;
      i = Number((BigInt(i) * 5n + 1n + perturb) & mask);
    }
  };
  for (const v of items) {
    place(v);
    fill++;
    if (fill * 5 >= (size - 1) * 3) {
      const old = table.filter((x): x is Value => x !== undefined);
      size = 8;
      while (size <= fill * 4) size <<= 1;
      table = new Array<Value | undefined>(size).fill(undefined);
      for (const o of old) place(o);
    }
  }
  return table.filter((x): x is Value => x !== undefined);
}

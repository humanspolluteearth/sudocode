// Sequences and containers: iteration, indexing, slicing, membership, sorting (PY-12, PY-33, PY-34).
import type { Span } from "../../diagnostics.ts";
import { list, pyint, str, tuple, type Value } from "../values.ts";
import { fileLines } from "./files.ts";
import { pyError, typeError } from "./errors.ts";
import { hashKey, pyEq, setOrder } from "./hash.ts";
import { asBig, compareOrder } from "./numbers.ts";
import { pyRepr, pyTypeName } from "./repr.ts";

export const repr = (v: Value): string => pyRepr(v, setOrder);

export function rangeLength(r: { start: bigint; stop: bigint; step: bigint }): bigint {
  if (r.step > 0n) return r.start >= r.stop ? 0n : (r.stop - r.start + r.step - 1n) / r.step;
  return r.start <= r.stop ? 0n : (r.start - r.stop - r.step - 1n) / -r.step;
}

/** The items of anything a `for` loop or `list()` can walk over. */
export function iterate(v: Value, span: Span): Value[] {
  switch (v.kind) {
    case "list":
    case "tuple":
      return v.items;
    case "str":
    case "char":
      return Array.from(v.value, (c) => str(c));
    case "file":
      return fileLines(v, span);
    case "dict":
      return [...v.map.values()].map((e) => e.key);
    case "set":
      return setOrder([...v.map.values()]);
    case "range": {
      const out: Value[] = [];
      const n = rangeLength(v);
      for (let i = 0n; i < n; i++) out.push(pyint(v.start + i * v.step));
      return out;
    }
    default:
      throw typeError(`'${pyTypeName(v)}' object is not iterable`, span);
  }
}

export function lengthOf(v: Value, span: Span): number {
  switch (v.kind) {
    case "list":
    case "tuple":
      return v.items.length;
    case "str":
    case "char":
      return Array.from(v.value).length;
    case "dict":
    case "set":
      return v.map.size;
    case "range":
      return Number(rangeLength(v));
    default:
      throw typeError(`object of type '${pyTypeName(v)}' has no len()`, span);
  }
}

export function truthy(v: Value): boolean {
  switch (v.kind) {
    case "none":
      return false;
    case "bool":
      return v.value;
    case "pyint":
      return v.value !== 0n;
    case "int":
    case "real":
      return v.value !== 0;
    case "str":
    case "char":
      return v.value !== "";
    case "list":
    case "tuple":
      return v.items.length > 0;
    case "dict":
    case "set":
      return v.map.size > 0;
    case "range":
      return rangeLength(v) > 0n;
    default:
      return true;
  }
}

function position(index: Value, length: number, what: string, span: Span): number {
  const n = asBig(index);
  if (n === null) {
    throw typeError(
      what === "string"
        ? `string indices must be integers, not '${pyTypeName(index)}'`
        : `${what} indices must be integers or slices, not ${pyTypeName(index)}`,
      span,
    );
  }
  const i = n < 0n ? n + BigInt(length) : n;
  if (i < 0n || i >= BigInt(length)) throw pyError("IndexError", `${what} index out of range`, span);
  return Number(i);
}

export function indexValue(target: Value, index: Value, span: Span): Value {
  switch (target.kind) {
    case "list":
    case "tuple":
      return target.items[position(index, target.items.length, target.kind, span)] as Value;
    case "str":
    case "char": {
      const chars = Array.from(target.value);
      return str(chars[position(index, chars.length, "string", span)] as string);
    }
    case "range": {
      const n = Number(rangeLength(target));
      return pyint(target.start + BigInt(position(index, n, "range object", span)) * target.step);
    }
    case "dict": {
      const e = target.map.get(hashKey(index, span));
      if (e === undefined) throw pyError("KeyError", repr(index), span);
      return e.value;
    }
    default:
      throw typeError(`'${pyTypeName(target)}' object is not subscriptable`, span);
  }
}

/** Slice bounds as Python computes them (clamped, with negative steps). Returns the positions to take. */
export function sliceIndices(
  length: number,
  lo: Value | null,
  hi: Value | null,
  st: Value | null,
  span: Span,
): number[] {
  const toBig = (v: Value | null): bigint | null => {
    if (v === null || v.kind === "none") return null;
    const n = asBig(v);
    if (n === null) throw typeError("slice indices must be integers or None or have an __index__ method", span);
    return n;
  };
  const step = toBig(st) ?? 1n;
  if (step === 0n) throw pyError("ValueError", "slice step cannot be zero", span);
  const len = BigInt(length);
  const clamp = (v: bigint | null, dflt: bigint, lowest: bigint, highest: bigint): bigint => {
    if (v === null) return dflt;
    const w = v < 0n ? v + len : v;
    return w < lowest ? lowest : w > highest ? highest : w;
  };
  const out: number[] = [];
  if (step > 0n) {
    for (let i = clamp(toBig(lo), 0n, 0n, len); i < clamp(toBig(hi), len, 0n, len); i += step) out.push(Number(i));
  } else {
    for (let i = clamp(toBig(lo), len - 1n, -1n, len - 1n); i > clamp(toBig(hi), -1n, -1n, len - 1n); i += step)
      out.push(Number(i));
  }
  return out;
}

export function sliceValue(target: Value, lo: Value | null, hi: Value | null, st: Value | null, span: Span): Value {
  switch (target.kind) {
    case "list":
    case "tuple": {
      const items = sliceIndices(target.items.length, lo, hi, st, span).map((i) => target.items[i] as Value);
      return target.kind === "list" ? list(items) : tuple(items);
    }
    case "str":
    case "char": {
      const chars = Array.from(target.value);
      return str(
        sliceIndices(chars.length, lo, hi, st, span)
          .map((i) => chars[i] as string)
          .join(""),
      );
    }
    default:
      throw typeError(`'${pyTypeName(target)}' object is not subscriptable`, span);
  }
}

export function contains(container: Value, item: Value, span: Span): boolean {
  switch (container.kind) {
    case "list":
    case "tuple":
      return container.items.some((x) => pyEq(x, item));
    case "str":
    case "char":
      if (item.kind !== "str" && item.kind !== "char") {
        throw typeError(`'in <string>' requires string as left operand, not ${pyTypeName(item)}`, span);
      }
      return container.value.includes(item.value);
    case "dict":
      return container.map.has(hashKey(item, span));
    case "set":
      return container.map.has(hashKey(item, span));
    case "range": {
      const n = asBig(item);
      return n !== null && iterate(container, span).some((x) => pyEq(x, item));
    }
    default:
      throw typeError(`argument of type '${pyTypeName(container)}' is not iterable`, span);
  }
}

/** A stable merge sort that asks `before(later, earlier)` as CPython's `<` does, so TypeErrors name the same types. */
export function mergeSort<T>(items: T[], lessThan: (a: T, b: T) => boolean): T[] {
  if (items.length < 2) return items.slice();
  const mid = items.length >> 1;
  const left = mergeSort(items.slice(0, mid), lessThan);
  const right = mergeSort(items.slice(mid), lessThan);
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (lessThan(right[j] as T, left[i] as T)) out.push(right[j++] as T);
    else out.push(left[i++] as T);
  }
  while (i < left.length) out.push(left[i++] as T);
  while (j < right.length) out.push(right[j++] as T);
  return out;
}

/** Sorts values (already mapped through `key`) and keeps the originals alongside. */
export function sortPairs(pairs: { key: Value; item: Value }[], reverse: boolean, span: Span): Value[] {
  const ordered = reverse ? pairs.slice().reverse() : pairs;
  const sorted = mergeSort(ordered, (a, b) => compareOrder(a.key, b.key, "<", span) < 0);
  return (reverse ? sorted.reverse() : sorted).map((p) => p.item);
}

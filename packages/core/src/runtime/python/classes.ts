// Classes and instances (PY-19, PY-20): method resolution order, attribute lookup and `super()`.
//
// Compiler concept: *C3 linearisation*. A class's MRO (method resolution order) is the list of classes searched,
// in order, when looking up an attribute. C3 merges the parents' lists so a class always comes before its
// parents and the parents keep the order they were written in.
//
// Compiler concept: *bound methods*. Reading `obj.speak` finds the function in the class and pairs it with
// `obj` (a `bound` value), so calling it later passes `obj` as the first argument, `self`.
import type { Span } from "../../diagnostics.ts";
import { str, tuple, type Value } from "../values.ts";
import { EXCEPTION_NAMES, PARENT, pyError } from "./errors.ts";

export type ClassValue = Extract<Value, { kind: "class" }>;
export type InstanceValue = Extract<Value, { kind: "instance" }>;

/** The MRO of a built-in class such as `ValueError`: itself, its parents, then `object`. */
function builtinMro(name: string): Value[] {
  const out: Value[] = [];
  for (let n: string | undefined = name; n !== undefined; n = PARENT[n]) out.push({ kind: "type", name: n });
  if (name !== "object") out.push({ kind: "type", name: "object" });
  return out;
}

const sameEntry = (a: Value, b: Value): boolean =>
  a === b || (a.kind === "type" && b.kind === "type" && a.name === b.name);

/** C3 merge of the parents' MROs plus the list of parents itself. Returns null when no consistent order exists. */
export function linearise(bases: Value[]): Value[] | null {
  const lists: Value[][] = bases.map((b) =>
    b.kind === "class" ? [...b.mro] : builtinMro((b as { name: string }).name),
  );
  lists.push([...bases]);
  const out: Value[] = [];
  for (;;) {
    const live = lists.filter((l) => l.length > 0);
    if (live.length === 0) return out;
    let pick: Value | undefined;
    for (const l of live) {
      const head = l[0] as Value;
      if (!live.some((m) => m.slice(1).some((x) => sameEntry(x, head)))) {
        pick = head;
        break;
      }
    }
    if (pick === undefined) return null;
    out.push(pick);
    for (const l of lists) if (l[0] !== undefined && sameEntry(l[0], pick)) l.shift();
  }
}

export function makeClass(name: string, bases: Value[], attrs: Map<string, Value>, span: Span): ClassValue {
  for (const b of bases) {
    if (b.kind !== "class" && !(b.kind === "type" && (b.name === "object" || EXCEPTION_NAMES.includes(b.name)))) {
      throw pyError("TypeError", "this base class is not supported; use object or an exception", span);
    }
  }
  const effective = bases.length === 0 ? [{ kind: "type", name: "object" } as Value] : bases;
  const tail = linearise(effective);
  if (tail === null) throw pyError("TypeError", "Cannot create a consistent method resolution order (MRO)", span);
  const cls: ClassValue = { kind: "class", name, bases: effective, mro: [], attrs, exc: false };
  cls.mro = [cls, ...tail];
  cls.exc = tail.some((c) => c.kind === "type" && EXCEPTION_NAMES.includes(c.name));
  return cls;
}

/** The first class in the MRO that defines `name`. */
export function lookupMro(cls: ClassValue, name: string): Value | undefined {
  for (const c of cls.mro) {
    if (c.kind !== "class") continue;
    const v = c.attrs.get(name);
    if (v !== undefined) return v;
  }
  return undefined;
}

export function isClassSubclass(cls: ClassValue, target: Value): boolean {
  return cls.mro.some((c) => sameEntry(c, target)) || (target.kind === "type" && target.name === "object");
}

const baseInit: Value = { kind: "builtin", name: "$base_init" };

function missing(v: Value, name: string, span: Span): never {
  if (v.kind === "class") throw pyError("AttributeError", `type object '${v.name}' has no attribute '${name}'`, span);
  const own = v.kind === "instance" ? v.cls.name : v.kind === "super" ? "super" : v.kind;
  throw pyError("AttributeError", `'${own}' object has no attribute '${name}'`, span);
}

/** `obj.name` for an instance, class or `super()` object. */
export function getAttr(v: Value, name: string, span: Span): Value {
  switch (v.kind) {
    case "instance": {
      const own = v.attrs.get(name);
      if (own !== undefined) return own;
      if (name === "__class__") return v.cls;
      const found = lookupMro(v.cls, name);
      if (found === undefined) return missing(v, name, span);
      return found.kind === "func" ? { kind: "bound", fn: found, self: v } : found;
    }
    case "class": {
      if (name === "__name__") return str(v.name);
      const found = lookupMro(v, name);
      return found ?? missing(v, name, span);
    }
    case "super": {
      const start = v.self.kind === "instance" ? v.self.cls.mro : v.cls.mro;
      const at = start.indexOf(v.cls);
      for (const c of start.slice(at + 1)) {
        if (c.kind === "class") {
          const f = c.attrs.get(name);
          if (f !== undefined) return f.kind === "func" ? { kind: "bound", fn: f, self: v.self } : f;
        } else if (name === "__init__") {
          return { kind: "bound", fn: baseInit, self: v.self };
        }
      }
      return missing(v, name, span);
    }
    default:
      return missing(v, name, span);
  }
}

export function setAttr(target: Value, name: string, value: Value, span: Span): void {
  if (target.kind === "instance" || target.kind === "class") target.attrs.set(name, value);
  else
    throw pyError(
      "AttributeError",
      `'${target.kind === "super" ? "super" : target.kind}' object has no attribute '${name}'`,
      span,
    );
}

/** What `BaseException.__init__` does: store the arguments (an instance of a non-exception class ignores them). */
export function baseInitialise(self: Value, args: Value[]): void {
  if (self.kind === "instance" && self.cls.exc) self.attrs.set("args", tuple(args));
}

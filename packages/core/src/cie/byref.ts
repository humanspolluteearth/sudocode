// BYREF arguments (CIE-73, CIE-76).
//
// Compiler concept: an *l-value* is an expression that names a storage place (a variable, an array item, a record
// field). BYREF is copy-in/copy-out: the value goes in when the call starts, and the procedure's final value is
// written back to the caller's place when it ends. So each BYREF argument must be an l-value, and we turn the
// argument's IR back into an assignment target to write it back.
import type { AssignTarget, Expr, VarRef } from "../ir/ir.ts";

function rootOf(e: Expr): VarRef | null {
  switch (e.kind) {
    case "var":
      return e;
    case "index":
    case "field":
      return rootOf(e.target);
    default:
      return null;
  }
}

/** The place an argument expression names, or null when it is only a value (a literal, a sum, a call...). */
export function placeOf(e: Expr): AssignTarget | null {
  if (e.kind === "var") return e;
  if (e.kind === "field") {
    const root = rootOf(e);
    return root === null ? null : { kind: "field", record: e.target, root, name: e.name, text: e.text, span: e.span };
  }
  if (e.kind === "index") {
    const inner = e.target;
    if (inner.kind === "var") {
      return {
        kind: "element",
        array: inner,
        index: e.index,
        base: e.base,
        growOnWrite: false,
        text: e.text,
        span: e.span,
      };
    }
    if (inner.kind === "index" && inner.target.kind === "var") {
      return {
        kind: "element",
        array: inner.target,
        index: inner.index,
        index2: e.index,
        base: inner.base,
        growOnWrite: false,
        text: e.text,
        span: e.span,
      };
    }
  }
  return null;
}

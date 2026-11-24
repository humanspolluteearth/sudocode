// CIE INPUT, OUTPUT and assignment (variables, array items, record fields). Split out of statements.ts.

import type { AssignTarget, VarRef, InputConversion, Stmt as Ir, Expr as IrExpr } from "../ir/ir.ts";
import type { Span } from "../diagnostics.ts";
import type { Token } from "../edexcel/tokens.ts";
import type { Variable } from "./env.ts";
import { attrAssign } from "./classes.ts";
import type { Typed } from "./expressions.ts";
import { isUnknown, typeName, UNKNOWN } from "./types.ts";
import type { Ty } from "./types.ts";
import { ref } from "./declarations.ts";
import type { Statements } from "./statements.ts";

const CONVERT: Readonly<Record<string, InputConversion>> = {
  INTEGER: "int",
  REAL: "real",
  BOOLEAN: "bool",
  CHAR: "char",
  STRING: "str",
};

export function input(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "INPUT");
  // CIE-81: an optional string literal before the variable is the prompt, shown as console output.
  let prompt: string | undefined;
  if (c.peek().kind === "string" && c.peek().quote === "double") {
    prompt = c.peek().value ?? "";
    c.next();
  }
  const name = c.peek();
  if (name.kind !== "word") return c.fail("a variable", "Write the variable that receives the input, e.g. INPUT Age.");
  c.next();
  const v = s.x.lookupVar(name);
  const indexes = c.isSymbol("[") ? s.x.subscripts(name, v?.ty ?? UNKNOWN).indexes : null;
  if (v === undefined) {
    s.x.undeclared(name);
    return c.failSilently();
  }
  if (v.constant) {
    c.report("E-CHK-CONSTANT-ASSIGN", name.span, { name: name.text });
    return c.failSilently();
  }
  c.endStatement();
  // CIE-80: the variable can be an array element; the line is converted to the item's type.
  const item = v.ty.kind === "ARRAY" ? v.ty.of : v.ty;
  const convert = CONVERT[typeName(item)] ?? "str";
  const target = indexes === null ? ref(s, name) : elementTarget(s, name, v.ty, indexes, c.spanFrom(first));
  const span = c.spanFrom(first);
  return [
    prompt === undefined
      ? { kind: "input", target, convert, device: null, span }
      : { kind: "input", target, convert, device: null, prompt, span },
  ];
}

export function output(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "OUTPUT");
  const values: Typed[] = [s.x.expr()];
  while (c.isSymbol(",")) {
    c.next();
    values.push(s.x.expr());
  }
  c.endStatement();
  // CIE-82: an output list prints its values one after another, so it is one text join.
  const [head, ...rest] = values.map((v) => v.ir);
  if (head === undefined) return c.failSilently();
  const joined = rest.reduce<IrExpr>(
    (left, right) => ({ kind: "binary", op: "concatText", symbol: ",", left, right, span: right.span }),
    head,
  );
  return [{ kind: "output", value: joined, device: null, span: c.spanFrom(first) }];
}

export function assignOrCall(s: Statements, first: Token): Ir[] {
  const c = s.c;
  if (c.isSymbol("(", 1)) {
    const sig = s.env.subs.get(first.text);
    if (sig?.kind === "procedure") c.report("E-CHK-CALL-REQUIRED", first.span, { name: first.text });
    else s.x.undeclared(first);
    return c.failSilently();
  }
  c.next();
  const v = s.x.lookupVar(first);
  if (v?.attr === true && c.isSymbol("←")) return attrAssign(s, first, v);
  if (v?.attr === true && c.isSymbol("[")) return s.notSupported(first, "assigning to an array attribute");
  if (c.isSymbol(".") || (c.isSymbol("[") && fieldFollowsIndex(s))) return fieldAssign(s, first, v);
  if (c.isSymbol("[")) return elementAssign(s, first, v);
  if (!c.isSymbol("←")) {
    if (v === undefined) {
      s.x.undeclared(first);
      return c.failSilently();
    }
    return c.fail("←", "Use <- to store a value: Name <- value.");
  }
  c.next();
  const value = s.x.expr();
  if (v === undefined) {
    s.x.undeclared(first);
    return c.failSilently();
  }
  if (v.constant) {
    c.report("E-CHK-CONSTANT-ASSIGN", first.span, { name: first.text });
    return c.failSilently();
  }
  s.checkFits(first.text, v.ty, value);
  c.endStatement();
  // CIE-23: `B <- A` copies the items, so changing A later leaves B alone.
  const whole = copyOf(s, v.ty, value);
  return [{ kind: "assign", target: ref(s, first), value: whole ?? s.valueFor(v.ty, value), span: c.spanFrom(first) }];
}

/** After a name and `[`: does the matching `]` have a `.` after it (`Form[2].Name <- ...`)? */
function fieldFollowsIndex(s: Statements): boolean {
  let depth = 0;
  for (let i = 0; ; i++) {
    const t = s.c.peek(i);
    if (t.kind === "newline" || t.kind === "eof") return false;
    if (t.kind === "symbol" && t.text === "[") depth++;
    if (t.kind === "symbol" && t.text === "]" && --depth === 0) {
      const next = s.c.peek(i + 1);
      return next.kind === "symbol" && next.text === ".";
    }
  }
}

/** `Rec.Field <- value`, `Form[i].Field <- value` (CIE-30). The left side is read like an expression, then used as a target. */
function fieldAssign(s: Statements, first: Token, v: Variable | undefined): Ir[] {
  const c = s.c;
  if (v === undefined) {
    s.x.undeclared(first);
    return c.failSilently();
  }
  const scope = s.env.isLocal(first.text) ? "local" : "global";
  // An attribute of the current class lives in `Self` (CIE-111).
  const root: VarRef =
    v.attr === true
      ? { kind: "var", name: "Self", scope: "local", span: first.span }
      : { kind: "var", name: v.name, scope, span: first.span };
  const base: Typed = { ir: v.literal?.(first.span) ?? root, ty: v.ty, oneChar: false, span: first.span };
  const left = s.x.fields(first, c.isSymbol("[") ? s.x.element(first, base) : base);
  if (left.ir.kind === "call" && !c.isSymbol("←")) {
    // `Obj.Method(args)` on its own line is a method call statement (CIE-114).
    c.endStatement();
    return [{ kind: "callStatement", callee: left.ir.callee, args: left.ir.args, span: c.spanFrom(first) }];
  }
  if (isUnknown(left.ty) && !c.isSymbol("←")) return c.failSilently(); // a method error was already reported
  c.expectSymbol("←", "←", "Use <- to store a value: Name.Field <- value.");
  const value = s.x.expr();
  if (left.ir.kind !== "field") return c.failSilently(); // already reported
  if (v.constant) {
    c.report("E-CHK-CONSTANT-ASSIGN", first.span, { name: first.text });
    return c.failSilently();
  }
  s.checkFits(c.text(left.span), left.ty, value);
  c.endStatement();
  const target: AssignTarget = {
    kind: "field",
    record: left.ir.target,
    root,
    name: left.ir.name,
    text: left.ir.text,
    span: c.spanFrom(first),
  };
  return [
    {
      kind: "assign",
      target,
      value: copyOf(s, left.ty, value) ?? s.valueFor(left.ty, value),
      span: c.spanFrom(first),
    },
  ];
}

/** Arrays and records are copied when assigned whole, so the two variables stay separate (CIE-23, CIE-30). */
function copyOf(s: Statements, ty: Ty, value: Typed): IrExpr | null {
  return ty.kind === "ARRAY" || ty.kind === "RECORD" ? { kind: "copyArray", source: value.ir, span: value.span } : null;
}

/** The IR target for `A[i]` or `A[i, j]`: counting starts at the declared lower bound and the length is fixed. */
function elementTarget(s: Statements, name: Token, ty: Ty, indexes: Typed[], span: Span): AssignTarget {
  const [row, column] = indexes;
  if (row === undefined) return s.c.failSilently();
  return {
    kind: "element",
    array: ref(s, name),
    index: row.ir,
    ...(column === undefined ? {} : { index2: column.ir }),
    base: ty.kind === "ARRAY" ? (ty.lows[0] ?? 1) : 1,
    ...(ty.kind === "ARRAY" && ty.lows[1] !== undefined && ty.lows[1] !== ty.lows[0] ? { base2: ty.lows[1] } : {}),
    growOnWrite: false, // CIE-20
    text: name.text,
    span,
  };
}

/** `A[i] <- value` and `A[i, j] <- value` (CIE-20 to CIE-22). */
function elementAssign(s: Statements, first: Token, v: Variable | undefined): Ir[] {
  const c = s.c;
  const ty = v?.ty ?? UNKNOWN;
  const { indexes } = s.x.subscripts(first, ty);
  c.expectSymbol("←", "←", "Use <- to store a value: Name[1] <- value.");
  const value = s.x.expr();
  if (v === undefined) {
    s.x.undeclared(first);
    return c.failSilently();
  }
  if (v.constant) {
    c.report("E-CHK-CONSTANT-ASSIGN", first.span, { name: first.text });
    return c.failSilently();
  }
  if (ty.kind === "STRING") {
    c.report("E-CHK-STRING-ELEMENT", first.span);
    return c.failSilently();
  }
  const item = ty.kind === "ARRAY" ? ty.of : UNKNOWN;
  s.checkFits(first.text, item, value);
  c.endStatement();
  const target = elementTarget(s, first, ty, indexes, c.spanFrom(first));
  return [
    {
      kind: "assign",
      target,
      value: copyOf(s, item, value) ?? s.valueFor(item, value),
      span: c.spanFrom(first),
    },
  ];
}

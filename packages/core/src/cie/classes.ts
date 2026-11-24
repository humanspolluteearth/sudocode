// Cambridge classes (CIE-110 to CIE-116).
//
// Compiler concept: *desugaring*. The shared IR has no class nodes; each class feature lowers to nodes it already has:
// - an object is a record with a hidden `__class` field holding the class name (so the runtime can tell a Dog from an Animal);
// - a method is a subprogram `Class#method` whose first parameter is `Self`, the object;
// - an attribute used inside a method is a field of `Self`;
// - *dynamic dispatch* (CIE-116: a subclass method replaces the parent's) is a generated subprogram `Class.method`
//   that looks at `Self.__class` and calls the right `Owner#method`. A call `Obj.Method()` always calls the dispatcher
//   of the variable's declared class, so an Animal variable holding a Dog runs Dog's version.
// - `NEW Class(args)` calls a generated function `new Class` that builds the record, runs the constructor, and returns it.
import type { Span } from "../diagnostics.ts";
import type { Expr as IrExpr, Stmt as Ir, VarRef } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import type { Typed } from "./expressions.ts";
import type { Expressions } from "./expressions.ts";
import { joinSpans } from "./cursor.ts";
import type { Attr, ClassInfo, Env, Method, Variable } from "./env.ts";
import type { Statements } from "./statements.ts";
import { UNKNOWN, type Ty } from "./types.ts";

export const SELF = "Self";
export const CLASS_FIELD = "__class";

export const selfRef = (span: Span): VarRef => ({ kind: "var", name: SELF, scope: "local", span });

/** The class, then its parent, then its grandparent... */
export function chain(env: Env, cls: ClassInfo): ClassInfo[] {
  const out: ClassInfo[] = [];
  for (let c: ClassInfo | undefined = cls; c !== undefined && !out.includes(c);) {
    out.push(c);
    c = c.parent === null ? undefined : env.classes.get(c.parent.toLowerCase());
  }
  return out;
}

export function classType(env: Env, cls: ClassInfo): Ty {
  return {
    kind: "CLASS",
    name: cls.name,
    supers: chain(env, cls)
      .slice(1)
      .map((c) => c.name),
  };
}

/** The nearest version of a method, searching the class and then its parents (CIE-116). */
export function findMethod(env: Env, cls: ClassInfo, name: string): Method | undefined {
  for (const c of chain(env, cls)) {
    const m = c.methods.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (m !== undefined) return m;
  }
  return undefined;
}

export function findAttr(env: Env, cls: ClassInfo, name: string): Attr | undefined {
  for (const c of chain(env, cls)) {
    const a = c.attrs.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (a !== undefined) return a;
  }
  return undefined;
}

export const calleeFor = (owner: string, method: string): string => `${owner}#${method.toLowerCase()}`;

/** The attributes a method of `cls` can use by bare name: its own and its parents' PUBLIC ones (CIE-111, CIE-115). */
export function attrVariables(env: Env, cls: ClassInfo): Map<string, Variable> {
  const map = new Map<string, Variable>();
  for (const c of chain(env, cls).reverse()) {
    for (const a of c.attrs) {
      if (a.private && a.owner !== cls.name) continue;
      map.set(a.name.toLowerCase(), {
        name: a.name,
        ty: a.ty,
        constant: false,
        attr: true,
        literal: (span) => ({ kind: "field", target: selfRef(span), name: a.name, text: a.name, span }),
      });
    }
  }
  return map;
}

export function typed(ir: IrExpr, ty: Ty, span: Span): Typed {
  return { ir, ty, oneChar: false, span };
}

/** `Obj.name` and `Obj.name(args)` where Obj is an object (CIE-111, CIE-114, CIE-115). */
export function member(x: Expressions, left: Typed, text: string, f: Token, span: Span): Typed {
  const c = x.c;
  const env = x.env;
  const ty = left.ty;
  if (ty.kind !== "CLASS") return typed(left.ir, UNKNOWN, span);
  const cls = env.classes.get(ty.name.toLowerCase());
  if (cls === undefined) return typed(left.ir, UNKNOWN, span);
  const outside = (owner: string): boolean => env.currentClass?.name !== owner;
  if (!c.isSymbol("(")) {
    const a = findAttr(env, cls, f.text);
    if (a === undefined) {
      c.report("E-CHK-NO-FIELD", f.span, {
        name: text,
        field: f.text,
        fields: chain(env, cls)
          .flatMap((k) => k.attrs.filter((q) => !q.private || !outside(q.owner)).map((q) => q.name))
          .join(", "),
      });
      return typed(left.ir, UNKNOWN, span);
    }
    if (a.private && outside(a.owner)) {
      c.report("E-CHK-PRIVATE-MEMBER", f.span, { name: f.text });
      return typed(left.ir, UNKNOWN, span);
    }
    return typed({ kind: "field", target: left.ir, name: a.name, text, span }, a.ty, span);
  }
  c.next();
  const args = x.args();
  const close = c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
  return methodCall(x, cls, left, f, args, joinSpans(span, close.span));
}

/** Checks and lowers a call of method `f` on `target` (an object expression, or `Self` for a bare call). */
function methodCall(x: Expressions, cls: ClassInfo, target: Typed, f: Token, args: Typed[], full: Span): Typed {
  const c = x.c;
  const env = x.env;
  const outside = (owner: string): boolean => env.currentClass?.name !== owner;
  const m = findMethod(env, cls, f.text);
  if (m === undefined) {
    c.report("E-CHK-NO-METHOD", f.span, {
      name: cls.name,
      method: f.text,
      methods: chain(env, cls)
        .flatMap((k) => k.methods.filter((q) => !q.private).map((q) => q.name))
        .join(", "),
    });
    return typed(target.ir, UNKNOWN, full);
  }
  if (m.private && outside(m.owner)) {
    c.report("E-CHK-PRIVATE-MEMBER", f.span, { name: f.text });
    return typed(target.ir, UNKNOWN, full);
  }
  x.checkArgs(`${cls.name}.${m.name}`, m.params, args, f);
  const callee = `${cls.name}.${m.name.toLowerCase()}`;
  return typed(
    { kind: "call", callee, args: [target.ir, ...x.argIrs(m.params, args)], span: full },
    m.returns ?? UNKNOWN,
    full,
  );
}

/** A bare `Method(args)` inside a class calls the object's own method, through the dispatcher (CIE-114). Null if none. */
export function ownMethodCall(x: Expressions, t: Token, args: Typed[], span: Span): Typed | null {
  const cls = x.env.currentClass;
  if (cls === null || findMethod(x.env, cls, t.text) === undefined) return null;
  return methodCall(x, cls, typed(selfRef(t.span), classType(x.env, cls), t.span), t, args, span);
}

/** `NEW Class(args)` (CIE-113). */
export function newObject(x: Expressions, t: Token): Typed {
  const c = x.c;
  const env = x.env;
  c.next(); // NEW
  const name = c.peek();
  if (name.kind !== "word") return c.fail("a class name", "Write the class after NEW, e.g. NEW Counter().");
  c.next();
  const cls = env.classes.get(name.text.toLowerCase());
  let args: Typed[] = [];
  if (c.isSymbol("(")) {
    c.next();
    args = x.args();
  }
  const close = c.expectSymbol(")", ") or ,", "Close the arguments with ).");
  const span = joinSpans(t.span, close.span);
  if (cls === undefined) {
    c.report("E-CHK-UNKNOWN-CLASS", name.span, { name: name.text });
    return typed({ kind: "fail", code: "E-CHK-UNKNOWN-CLASS", args: {}, span }, UNKNOWN, span);
  }
  const ctor = findMethod(env, cls, "new");
  x.checkArgs(`${cls.name}.NEW`, ctor?.params ?? [], args, name);
  return typed(
    { kind: "call", callee: `new ${cls.name}`, args: x.argIrs(ctor?.params ?? [], args), span },
    classType(env, cls),
    span,
  );
}

/** `SUPER.name(args)`: the parent's version of a method, called directly (CIE-113). Null when a parent has no constructor. */
export function superCall(x: Expressions, t: Token): Typed | null {
  const c = x.c;
  const env = x.env;
  const here = env.currentClass;
  const parent = here?.parent == null ? undefined : env.classes.get(here.parent.toLowerCase());
  c.next(); // SUPER
  if (parent === undefined)
    return c.fail("a parent class", "SUPER only works inside a class that INHERITS another class.");
  c.expectSymbol(".", ".", "Write SUPER.NEW(...) or SUPER.MethodName(...).");
  const f = c.peek();
  if (f.kind !== "word") return c.fail("a method name", "Write the parent's method after SUPER.");
  c.next();
  let args: Typed[] = [];
  let end = f.span;
  if (c.isSymbol("(")) {
    c.next();
    args = x.args();
    end = c.expectSymbol(")", ") or ,", "Close the arguments with ).").span;
  }
  const span = joinSpans(t.span, end);
  const m = findMethod(env, parent, f.text);
  if (m === undefined) {
    if (f.text.toUpperCase() === "NEW") return null;
    c.report("E-CHK-NO-METHOD", f.span, {
      name: parent.name,
      method: f.text,
      methods: chain(env, parent)
        .flatMap((k) => k.methods.map((q) => q.name))
        .join(", "),
    });
    return typed({ kind: "fail", code: "E-CHK-NO-METHOD", args: {}, span }, UNKNOWN, span);
  }
  x.checkArgs(`${parent.name}.${m.name}`, m.params, args, f);
  return typed(
    { kind: "call", callee: calleeFor(m.owner, m.name), args: [selfRef(t.span), ...x.argIrs(m.params, args)], span },
    m.returns ?? UNKNOWN,
    span,
  );
}

/** `Count <- value` where Count is an attribute of the class being translated (CIE-111). */
export function attrAssign(s: Statements, first: Token, v: Variable): Ir[] {
  const c = s.c;
  c.next(); // ←
  const value = s.x.expr();
  s.checkFits(first.text, v.ty, value);
  c.endStatement();
  const span = c.spanFrom(first);
  const whole = v.ty.kind === "ARRAY" || v.ty.kind === "RECORD";
  return [
    {
      kind: "assign",
      target: {
        kind: "field",
        record: selfRef(first.span),
        root: selfRef(first.span),
        name: v.name,
        text: v.name,
        span,
      },
      value: whole ? { kind: "copyArray", source: value.ir, span: value.span } : s.valueFor(v.ty, value),
      span,
    },
  ];
}

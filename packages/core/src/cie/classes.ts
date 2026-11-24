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
import type { Expr as IrExpr, Stmt as Ir, Subprogram, VarRef } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import type { Typed } from "./expressions.ts";
import type { Expressions } from "./expressions.ts";
import { Abandon, joinSpans } from "./cursor.ts";
import type { Attr, ClassInfo, Env, Method, Signature, Variable } from "./env.ts";
import { startingValue } from "./records.ts";
import type { Statements } from "./statements.ts";
import { paramType, parseParams } from "./subprograms.ts";
import { UNKNOWN, type Ty } from "./types.ts";

const SELF = "Self";
const CLASS_FIELD = "__class";

const selfRef = (span: Span): VarRef => ({ kind: "var", name: SELF, scope: "local", span });

/** The class, then its parent, then its grandparent... */
function chain(env: Env, cls: ClassInfo): ClassInfo[] {
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
function findMethod(env: Env, cls: ClassInfo, name: string): Method | undefined {
  for (const c of chain(env, cls)) {
    const m = c.methods.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (m !== undefined) return m;
  }
  return undefined;
}

function findAttr(env: Env, cls: ClassInfo, name: string): Attr | undefined {
  for (const c of chain(env, cls)) {
    const a = c.attrs.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (a !== undefined) return a;
  }
  return undefined;
}

const calleeFor = (owner: string, method: string): string => `${owner}#${method.toLowerCase()}`;

/** The attributes a method of `cls` can use by bare name: its own and its parents' PUBLIC ones (CIE-111, CIE-115). */
function attrVariables(env: Env, cls: ClassInfo): Map<string, Variable> {
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

function typed(ir: IrExpr, ty: Ty, span: Span): Typed {
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

/** Installs the CLASS parser: reads a whole class, filling `env.classes` (first pass) and `out` (method bodies). */
export function installClasses(s: Statements, out: Record<string, Subprogram>, collecting: boolean): void {
  const c = s.c;
  const env = s.env;

  const method = (info: ClassInfo, isPrivate: boolean, t: Token, upper: string): void => {
    const kind = upper === "PROCEDURE" ? "procedure" : "function";
    c.next();
    c.warnCase(t, upper);
    const name = c.peek();
    if (name.kind !== "word") return c.fail("a name", `Write a name after ${upper}.`);
    c.next();
    const ps = parseParams(s, kind);
    let returns: Ty | null = null;
    if (kind === "function") {
      c.expectKeyword("RETURNS", "Write RETURNS and the type the function gives back.");
      returns = paramType(s);
    }
    c.endStatement();
    if (collecting)
      info.methods.push({
        name: name.text,
        kind,
        params: ps,
        returns,
        private: isPrivate,
        owner: info.name,
        span: t.span,
      });
    const sig: Signature = { name: name.text, kind, params: ps, returns, span: t.span };
    const locals = new Map<string, Variable>([
      [SELF.toLowerCase(), { name: SELF, ty: classType(env, info), constant: false }],
      ...ps.map((p): [string, Variable] => [p.name.toLowerCase(), { name: p.name, ty: p.ty, constant: false }]),
    ]);
    env.locals = locals;
    env.current = sig;
    env.currentClass = info;
    env.attrs = attrVariables(env, info);
    const closer = kind === "procedure" ? "ENDPROCEDURE" : "ENDFUNCTION";
    const body = s.block(t, upper, [closer], closer);
    env.locals = null;
    env.current = null;
    env.currentClass = null;
    env.attrs = null;
    c.endStatement();
    out[calleeFor(info.name, name.text)] = {
      name: calleeFor(info.name, name.text),
      kind,
      params: [SELF, ...ps.map((p) => p.name)],
      body: body.stmts,
      span: c.spanFrom(t),
    };
  };

  const attribute = (info: ClassInfo, isPrivate: boolean): void => {
    const name = c.peek();
    if (name.kind !== "word")
      return c.fail("an attribute or method", "Write PRIVATE or PUBLIC, then PROCEDURE, FUNCTION or Name : TYPE.");
    c.next();
    c.expectSymbol(":", ":", "Write the type after a colon, e.g. PRIVATE Count : INTEGER.");
    const ty = s.typeName();
    c.endStatement();
    if (collecting) info.attrs.push({ name: name.text, ty, private: isPrivate, owner: info.name });
  };

  s.classDefinition = (first: Token): void => {
    c.next();
    c.warnCase(first, "CLASS");
    const nameTok = c.peek();
    if (nameTok.kind !== "word") return c.fail("a class name", "Write a name after CLASS.");
    c.next();
    let parent: string | null = null;
    if (c.isKeyword("INHERITS")) {
      c.next();
      const p = c.peek();
      if (p.kind !== "word") return c.fail("a class name", "Write the parent class after INHERITS.");
      c.next();
      const found = env.classes.get(p.text.toLowerCase());
      if (found === undefined) c.report("E-CHK-UNKNOWN-CLASS", p.span, { name: p.text });
      else parent = found.name;
    }
    c.endStatement();
    const key = nameTok.text.toLowerCase();
    if (collecting) env.classes.set(key, { name: nameTok.text, parent, attrs: [], methods: [], span: first.span });
    const info = env.classes.get(key);
    if (info === undefined) return c.failSilently();
    env.types.set(nameTok.text, classType(env, info));
    for (;;) {
      s.skipBlank();
      const t = c.peek();
      if (t.kind === "eof") {
        const at = c.source.length;
        c.report(
          "E-SYN-BLOCK-NOT-CLOSED",
          first.span,
          { block: "CLASS", line: first.span.line, closer: "ENDCLASS" },
          undefined,
          [{ start: at, end: at, replacement: "\nENDCLASS\n" }],
        );
        return;
      }
      if (t.kind === "word" && t.text.toUpperCase() === "ENDCLASS") {
        c.next();
        c.warnCase(t, "ENDCLASS");
        c.endStatement();
        return;
      }
      try {
        let isPrivate = false;
        let upper = t.kind === "word" ? t.text.toUpperCase() : "";
        let head = t;
        if (upper === "PUBLIC" || upper === "PRIVATE") {
          c.next();
          c.warnCase(t, upper);
          isPrivate = upper === "PRIVATE";
          head = c.peek();
          upper = head.kind === "word" ? head.text.toUpperCase() : "";
        }
        if (upper === "PROCEDURE" || upper === "FUNCTION") method(info, isPrivate, head, upper);
        else attribute(info, isPrivate);
      } catch (e) {
        if (!(e instanceof Abandon)) throw e;
        c.skipLine();
        c.endLine();
      }
    }
  };
}

const classIs = (name: string, span: Span): IrExpr => ({
  kind: "binary",
  op: "eq",
  symbol: "=",
  left: { kind: "field", target: selfRef(span), name: CLASS_FIELD, text: SELF, span },
  right: { kind: "literal", value: { kind: "str", value: name }, span },
  span,
});

/** After the program is read: the generated dispatchers (`Class.method`) and constructors (`new Class`). */
export function finishClasses(env: Env, out: Record<string, Subprogram>): void {
  const all = [...env.classes.values()];
  for (const cls of all) {
    const span = cls.span;
    const mine = chain(env, cls);
    const below = all.filter((d) => d !== cls && chain(env, d).includes(cls));
    const names = new Set(mine.flatMap((k) => k.methods.map((m) => m.name.toLowerCase())));
    for (const lower of names) {
      const base = findMethod(env, cls, lower);
      if (base === undefined) continue;
      const names2 = base.params.map((_, i) => `p${String(i)}`);
      const args: IrExpr[] = [
        selfRef(span),
        ...names2.map((n): IrExpr => ({ kind: "var", name: n, scope: "local", span })),
      ];
      const invoke = (m: Method): Ir =>
        base.kind === "function"
          ? { kind: "return", value: { kind: "call", callee: calleeFor(m.owner, lower), args, span }, span }
          : { kind: "callStatement", callee: calleeFor(m.owner, lower), args, span };
      let body: Ir[] = [invoke(base)];
      for (const d of below.reverse()) {
        const impl = findMethod(env, d, lower);
        if (impl === undefined || impl.owner === base.owner) continue;
        body = [{ kind: "if", condition: classIs(d.name, span), then: [invoke(impl)], else: body, span }];
      }
      below.reverse();
      const key = `${cls.name}.${lower}`;
      out[key] = { name: key, kind: base.kind, params: [SELF, ...names2], body, span };
    }
    const ctor = findMethod(env, cls, "new");
    const ctorArgs = (ctor?.params ?? []).map((_, i) => `p${String(i)}`);
    const fields = [
      { name: CLASS_FIELD, init: { kind: "literal", value: { kind: "str", value: cls.name }, span } satisfies IrExpr },
      ...mine
        .slice()
        .reverse()
        .flatMap((k) => k.attrs)
        .map((a) => ({ name: a.name, init: startingValue(a.ty, span) })),
    ];
    const body: Ir[] = [{ kind: "assign", target: selfRef(span), value: { kind: "newRecord", fields, span }, span }];
    if (ctor !== undefined)
      body.push({
        kind: "callStatement",
        callee: calleeFor(ctor.owner, "new"),
        args: [selfRef(span), ...ctorArgs.map((n): IrExpr => ({ kind: "var", name: n, scope: "local", span }))],
        span,
      });
    body.push({ kind: "return", value: selfRef(span), span });
    out[`new ${cls.name}`] = { name: `new ${cls.name}`, kind: "function", params: ctorArgs, body, span };
  }
}

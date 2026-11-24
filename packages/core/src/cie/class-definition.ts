// Cambridge class definitions (CIE-110 to CIE-116): reads a CLASS block and generates the dispatchers and
// constructors. Split out of classes.ts; the lookup helpers it shares with member access live there.
import type { Span } from "../diagnostics.ts";
import type { Expr as IrExpr, Stmt as Ir, Subprogram } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { Abandon } from "./cursor.ts";
import type { ClassInfo, Env, Method, Signature, Variable } from "./env.ts";
import { startingValue } from "./records.ts";
import type { Statements } from "./statements.ts";
import { paramType, parseParams } from "./subprograms.ts";
import type { Ty } from "./types.ts";
import { CLASS_FIELD, SELF, attrVariables, calleeFor, chain, findMethod, selfRef, classType } from "./classes.ts";

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

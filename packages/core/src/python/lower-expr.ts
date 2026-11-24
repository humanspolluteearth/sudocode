// Lowering Python expressions: surface AST -> core IR (python-ir.ts).
//
// Compiler concept: *IR lowering*. Each surface node becomes the IR node that states Python's rule outright
// (`pyArith floordiv`, `pyCompare` with a whole chain, `pyBoolOp` returning an operand). Names get their final
// meaning here, from the scope analysis, so the runtime never has to search for them.
import type { Span } from "../diagnostics.ts";
import type { PyCompClause, PyExpr, PyStmt, PyFPart, PyKeyword, PyTarget, PyWhere } from "../ir/python-ir.ts";
import type { Subprogram } from "../ir/ir.ts";
import type { SExpr, SFPart, SParam, SStmt } from "./ast.ts";
import type { Reporter } from "./locator.ts";
import { FuncScope } from "./scope.ts";

export abstract class ExprLowerer {
  protected scope: FuncScope | null = null;
  /** Comprehension variables in scope, innermost last: surface name -> hidden variable name. */
  protected comps: Map<string, string>[] = [];
  protected hiddenCount = 0;
  protected readonly keys = new Map<string, number>();
  readonly subprograms: Record<string, Subprogram> = {};

  constructor(protected readonly report: Reporter) {}

  protected resolve(name: string): { name: string; where: PyWhere; hops: number } {
    for (let i = this.comps.length - 1; i >= 0; i--) {
      const hidden = this.comps[i]?.get(name);
      if (hidden !== undefined) return { name: hidden, where: this.scope === null ? "global" : "local", hops: 0 };
    }
    if (this.scope === null) return { name, where: "global", hops: 0 };
    return { name, ...this.scope.resolve(name) };
  }

  protected hidden(prefix: string): PyTarget & { kind: "name" } {
    const span = { line: 0, column: 0, start: 0, end: 0 };
    return {
      kind: "name",
      name: `$${prefix}${String(++this.hiddenCount)}`,
      where: this.scope === null ? "global" : "local",
      span,
    };
  }

  protected abstract lowerBlock(body: readonly SStmt[]): PyStmt[];
  protected abstract enterFunction(): unknown;
  protected abstract leaveFunction(saved: unknown): void;

  /** Makes the subprogram for a `def` or `lambda` and returns the IR node that builds the function value. */
  protected makeFunction(name: string, params: SParam[], body: SStmt[] | SExpr, span: Span): PyExpr {
    const defaults = params.filter((p) => p.default !== null).map((p) => this.expr(p.default as SExpr));
    const count = (this.keys.get(name) ?? 0) + 1;
    this.keys.set(name, count);
    const key = count === 1 ? name : `${name}#${String(count)}`;
    const names = params.map((p) => p.name);
    const saved = { scope: this.scope, comps: this.comps, loops: this.enterFunction() };
    this.scope = new FuncScope(saved.scope, names, Array.isArray(body) ? body : []);
    this.comps = [];
    let stmts: PyStmt[];
    let doc: string | null = null;
    if (Array.isArray(body)) {
      const first = body[0];
      if (first?.kind === "expr" && first.value.kind === "str") doc = first.value.value;
      stmts = this.lowerBlock(body);
    } else {
      stmts = [{ kind: "pyReturn", value: this.expr(body), span: body.span }];
    }
    this.scope = saved.scope;
    this.comps = saved.comps;
    this.leaveFunction(saved.loops);
    this.subprograms[key] = { name, kind: "procedure", params: [...names, "$closure"], body: stmts, span };
    return { kind: "pyFunction", sub: key, name, params: names, defaults, doc, span };
  }

  protected target(e: SExpr): PyTarget {
    switch (e.kind) {
      case "name":
        return { kind: "name", ...this.where(e.name), span: e.span };
      case "index":
        return {
          kind: "index",
          target: this.expr(e.target),
          index: this.expr(e.index),
          root: this.rootOf(e.target),
          span: e.span,
        };
      case "tuple":
      case "list":
        return { kind: "tuple", items: e.items.map((i) => this.target(i)), span: e.span };
      default: {
        const what: Partial<Record<SExpr["kind"], string>> = {
          call: "function call",
          int: "literal",
          float: "literal",
          str: "literal",
          const: "literal",
          binop: "expression",
          attr: "attribute",
          compare: "comparison",
          boolop: "expression",
          slice: "slice",
          lambda: "lambda",
          comp: "list comprehension",
        };
        this.report.syntax(e.span, `cannot assign to ${what[e.kind] ?? "expression"}`);
        return { kind: "name", name: "$bad", where: "global", span: e.span };
      }
    }
  }

  private where(name: string): { name: string; where: PyWhere } {
    const r = this.resolve(name);
    return { name: r.name, where: r.where };
  }

  private rootOf(e: SExpr): string | null {
    if (e.kind === "name") return this.resolve(e.name).name;
    if (e.kind === "index" || e.kind === "slice" || e.kind === "attr") return this.rootOf(e.target);
    return null;
  }

  protected fparts(parts: SFPart[]): PyFPart[] {
    return parts.map((p) =>
      p.kind === "text"
        ? p
        : { kind: "field", value: this.expr(p.value), conversion: p.conversion, spec: this.fparts(p.spec) },
    );
  }

  protected expr(e: SExpr): PyExpr {
    const span = e.span;
    switch (e.kind) {
      case "int":
        return { kind: "pyConst", value: { kind: "int", value: e.value }, span };
      case "float":
        return { kind: "pyConst", value: { kind: "float", value: e.value }, span };
      case "str":
        return { kind: "pyConst", value: { kind: "str", value: e.value }, span };
      case "const":
        return { kind: "pyConst", value: e.value === null ? { kind: "none" } : { kind: "bool", value: e.value }, span };
      case "fstr":
        return { kind: "pyFString", parts: this.fparts(e.parts), span };
      case "name":
        return { kind: "pyName", ...this.resolve(e.name), span };
      case "binop":
        return { kind: "pyArith", op: e.op, left: this.expr(e.left), right: this.expr(e.right), span };
      case "neg":
        return { kind: "pyUnary", op: "neg", operand: this.expr(e.operand), span };
      case "pos":
        return { kind: "pyUnary", op: "pos", operand: this.expr(e.operand), span };
      case "not":
        return { kind: "pyNot", operand: this.expr(e.operand), span };
      case "compare":
        return { kind: "pyCompare", ops: e.ops, operands: e.operands.map((o) => this.expr(o)), span };
      case "boolop":
        return { kind: "pyBoolOp", op: e.op, left: this.expr(e.left), right: this.expr(e.right), span };
      case "ifexp":
        return { kind: "pyIfExpr", test: this.expr(e.test), then: this.expr(e.then), else: this.expr(e.else), span };
      case "list":
        return { kind: "pyList", items: e.items.map((i) => this.expr(i)), span };
      case "tuple":
        return { kind: "pyTuple", items: e.items.map((i) => this.expr(i)), span };
      case "set":
        return { kind: "pySet", items: e.items.map((i) => this.expr(i)), span };
      case "dict":
        return {
          kind: "pyDict",
          pairs: e.pairs.map((p) => ({ key: this.expr(p.key), value: this.expr(p.value) })),
          span,
        };
      case "index":
        return { kind: "pyIndex", target: this.expr(e.target), index: this.expr(e.index), span };
      case "slice": {
        const opt = (x: SExpr | null): PyExpr | null => (x === null ? null : this.expr(x));
        return {
          kind: "pySlice",
          target: this.expr(e.target),
          lower: opt(e.lower),
          upper: opt(e.upper),
          step: opt(e.step),
          span,
        };
      }
      case "attr":
        return { kind: "pyAttr", target: this.expr(e.target), name: e.name, span };
      case "call": {
        const args = e.args.filter((a) => a.name === null).map((a) => this.expr(a.value));
        const keywords: PyKeyword[] = e.args
          .filter((a) => a.name !== null)
          .map((a) => ({ name: a.name as string, value: this.expr(a.value) }));
        if (e.callee.kind === "attr")
          return { kind: "pyMethod", target: this.expr(e.callee.target), name: e.callee.name, args, keywords, span };
        return { kind: "pyCall", callee: this.expr(e.callee), args, keywords, span };
      }
      case "comp":
        return this.comprehension(e);
      case "lambda":
        return this.makeFunction("<lambda>", e.params, e.body, span);
    }
  }

  private comprehension(e: Extract<SExpr, { kind: "comp" }>): PyExpr {
    const id = ++this.hiddenCount;
    const renames = new Map<string, string>();
    this.comps.push(renames);
    const clauses: PyCompClause[] = [];
    for (const c of e.clauses) {
      if (c.kind === "if") {
        clauses.push({ kind: "if", expr: this.expr(c.expr) });
        continue;
      }
      const iter = this.expr(c.expr); // the iterable is read before this clause's own variables exist
      const names: string[] = [];
      const collect = (t: SExpr): void => {
        if (t.kind === "name") names.push(t.name);
        else if (t.kind === "tuple" || t.kind === "list") t.items.forEach(collect);
      };
      collect(c.target as SExpr);
      for (const n of names) renames.set(n, `$c${String(id)}_${n}`);
      clauses.push({ kind: "for", target: this.target(c.target as SExpr), expr: iter });
    }
    const element = this.expr(e.element);
    this.comps.pop();
    return { kind: "pyComp", element, clauses, span: e.span };
  }
}

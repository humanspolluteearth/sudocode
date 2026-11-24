// Python statements -> core IR, plus the syntax checks that need context (PY-04): `return` outside a function,
// `break` outside a loop, and so on. Expression lowering lives in lower-expr.ts.
import type { Program } from "../ir/ir.ts";
import type { PyHandler, PyStmt } from "../ir/python-ir.ts";
import type { SStmt } from "./ast.ts";
import { ExprLowerer } from "./lower-expr.ts";

interface FnState {
  loops: number;
  handlers: string[];
  inFunction: boolean;
}

class PythonLowerer extends ExprLowerer {
  private loops = 0;
  private handlers: string[] = [];
  private inFunction = false;

  protected enterFunction(): FnState {
    const saved = { loops: this.loops, handlers: this.handlers, inFunction: this.inFunction };
    this.loops = 0;
    this.handlers = [];
    this.inFunction = true;
    return saved;
  }

  protected leaveFunction(saved: unknown): void {
    const s = saved as FnState;
    this.loops = s.loops;
    this.handlers = s.handlers;
    this.inFunction = s.inFunction;
  }

  lowerProgram(body: SStmt[]): Program {
    this.scope = null;
    return { format: "python", main: this.lowerBlock(body), subprograms: this.subprograms };
  }

  protected lowerBlock(body: readonly SStmt[]): PyStmt[] {
    return body.flatMap((s) => this.stmt(s));
  }

  private loopBody(body: readonly SStmt[]): PyStmt[] {
    this.loops++;
    const out = this.lowerBlock(body);
    this.loops--;
    return out;
  }

  private stmt(s: SStmt): PyStmt[] {
    const span = s.span;
    switch (s.kind) {
      case "pass":
      case "global":
        return [];
      case "expr":
        return [{ kind: "pyExpr", value: this.expr(s.value), span }];
      case "assign":
        return [{ kind: "pyAssign", targets: s.targets.map((t) => this.target(t)), value: this.expr(s.value), span }];
      case "augassign":
        return [{ kind: "pyAugAssign", target: this.target(s.target), op: s.op, value: this.expr(s.value), span }];
      case "if":
        return [
          { kind: "pyIf", test: this.expr(s.test), then: this.lowerBlock(s.then), else: this.lowerBlock(s.else), span },
        ];
      case "while":
        return [
          {
            kind: "pyWhile",
            test: this.expr(s.test),
            body: this.loopBody(s.body),
            orelse: this.lowerBlock(s.orelse),
            span,
          },
        ];
      case "for": {
        const iter = this.expr(s.iter);
        return [
          {
            kind: "pyFor",
            target: this.target(s.target),
            iter,
            body: this.loopBody(s.body),
            orelse: this.lowerBlock(s.orelse),
            span,
          },
        ];
      }
      case "break":
      case "continue":
        if (this.loops === 0) this.report.syntax(span, `'${s.kind}' outside loop`);
        return [{ kind: s.kind === "break" ? "pyBreak" : "pyContinue", span }];
      case "return":
        if (!this.inFunction) this.report.syntax(span, "'return' outside function");
        return [{ kind: "pyReturn", value: s.value === null ? null : this.expr(s.value), span }];
      case "def": {
        const fn = this.makeFunction(s.name, s.params, s.body, span);
        return [{ kind: "pyAssign", targets: [this.target({ kind: "name", name: s.name, span })], value: fn, span }];
      }
      case "del":
        return [{ kind: "pyDel", targets: s.targets.map((t) => this.target(t)), span }];
      case "raise":
        return [
          {
            kind: "pyRaise",
            exc: s.exc === null ? this.reraiseValue(span) : this.expr(s.exc),
            reraise: s.exc === null,
            span,
          },
        ];
      case "assert":
        return [
          {
            kind: "pyAssert",
            test: this.expr(s.test),
            message: s.message === null ? null : this.expr(s.message),
            span,
          },
        ];
      case "try":
        return [this.tryStmt(s)];
    }
  }

  private reraiseValue(span: PyStmt["span"]): ReturnType<ExprLowerer["expr"]> {
    const hidden = this.handlers[this.handlers.length - 1];
    if (hidden === undefined) {
      this.report.syntax(span, "No active exception to reraise");
      return { kind: "pyConst", value: { kind: "none" }, span };
    }
    return { kind: "pyName", name: hidden, where: this.scope === null ? "global" : "local", hops: 0, span };
  }

  private tryStmt(s: Extract<SStmt, { kind: "try" }>): PyStmt {
    const body = this.lowerBlock(s.body);
    const handlers: PyHandler[] = s.handlers.map((h) => {
      const id = `$exc${String(++this.hiddenCount)}`;
      const where: "global" | "local" = this.scope === null ? "global" : "local";
      const hidden = { kind: "name" as const, name: id, where, span: h.span };
      this.handlers.push(id);
      const types = h.types === null ? null : this.expr(h.types);
      const name = h.name === null ? null : this.target({ kind: "name", name: h.name, span: h.span });
      const hbody = this.lowerBlock(h.body);
      this.handlers.pop();
      return { types, name, hidden, body: hbody, span: h.span };
    });
    return {
      kind: "pyTry",
      body,
      handlers,
      orelse: this.lowerBlock(s.orelse),
      final: this.lowerBlock(s.final),
      span: s.span,
    };
  }
}

export function lower(body: SStmt[], report: ConstructorParameters<typeof PythonLowerer>[0]): Program {
  return new PythonLowerer(report).lowerProgram(body);
}

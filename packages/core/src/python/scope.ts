// Scope analysis for one function body (PY-04, PY-18).
//
// Compiler concept: *scope resolution*. Python decides what a name means by reading the WHOLE function first: a
// name that is assigned anywhere in it is local everywhere in it (so reading it before the assignment is an
// UnboundLocalError), unless the function says `global`. Lowering asks this class, once per name, and writes the
// answer (global / local / free) into the IR.
import type { PyWhere } from "../ir/python-ir.ts";
import type { SExpr, SStmt } from "./ast.ts";

export class FuncScope {
  readonly locals = new Set<string>();
  readonly globals = new Set<string>();

  constructor(
    readonly parent: FuncScope | null,
    readonly params: readonly string[],
    body: readonly SStmt[],
    /** A class body is a namespace, not an enclosing scope: methods inside it cannot see its names (PY-19). */
    readonly isClass = false,
  ) {
    for (const p of params) this.locals.add(p);
    this.scan(body);
  }

  private bind(target: SExpr): void {
    if (target.kind === "name") this.locals.add(target.name);
    else if (target.kind === "tuple" || target.kind === "list")
      target.items.forEach((t) => {
        this.bind(t);
      });
  }

  /** Every name this body assigns (not looking inside nested functions, which have their own scope). */
  private scan(body: readonly SStmt[]): void {
    for (const s of body) {
      switch (s.kind) {
        case "assign":
          s.targets.forEach((t) => {
            this.bind(t);
          });
          break;
        case "augassign":
          this.bind(s.target);
          break;
        case "for":
          this.bind(s.target);
          this.scan(s.body);
          this.scan(s.orelse);
          break;
        case "while":
          this.scan(s.body);
          this.scan(s.orelse);
          break;
        case "if":
          this.scan(s.then);
          this.scan(s.else);
          break;
        case "def":
        case "class":
          this.locals.add(s.name);
          break;
        case "global":
          s.names.forEach((n) => this.globals.add(n));
          break;
        case "del":
          s.targets.forEach((t) => {
            this.bind(t);
          });
          break;
        case "with":
          s.items.forEach((i) => {
            if (i.target !== null) this.bind(i.target);
          });
          this.scan(s.body);
          break;
        case "try":
          this.scan(s.body);
          for (const h of s.handlers) {
            if (h.name !== null) this.locals.add(h.name);
            this.scan(h.body);
          }
          this.scan(s.orelse);
          this.scan(s.final);
          break;
        default:
          break;
      }
    }
  }

  /** Where `name` lives when read or written inside this function: global, local, or free (hops levels up). */
  resolve(name: string): { where: PyWhere; hops: number } {
    if (this.globals.has(name)) return { where: "global", hops: 0 };
    if (this.locals.has(name)) return { where: "local", hops: 0 };
    let hops = 1;
    for (let p = this.parent; p !== null; p = p.parent) {
      if (p.isClass) continue;
      if (p.globals.has(name)) break;
      if (p.locals.has(name)) return { where: "free", hops };
      hops++;
    }
    return { where: "global", hops: 0 };
  }
}

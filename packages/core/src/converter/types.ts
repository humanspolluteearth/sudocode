// Static type inference for the converter: which values are INTEGER, REAL, BOOLEAN or STRING.
//
// Compiler concept: *static type inference*. The IR carries no types, so the converter works them out from how values
// are made: a literal has a type, `a + b` has the type of its operands, `RECEIVE n FROM (INTEGER)` makes an INTEGER.
// A variable's type is the *join* (least upper bound) of everything assigned to it, on a small lattice:
//
//        unknown           (top: could be anything, so print with `_show`)
//        real              (an INTEGER fits in a REAL)
//   int  bool  str         (list types are written "[int]", "[[str]]")
//        ""                (bottom: nothing assigned yet)
//
// Types only ever move up the lattice, so repeating the pass over the program until nothing changes (a *fixpoint*)
// always stops. Where a front end declares a type (Cambridge DECLARE, parameters) the declared type wins.
import type { AssignTarget, DeclaredScalar, Expr, Program, Stmt, Subprogram } from "../ir/ir.ts";

/** "", "int", "real", "bool", "str", "unknown", or a list such as "[int]". */
export type Ty = string;
export const UNKNOWN = "unknown";

const DECLARED: Record<DeclaredScalar, Ty> = {
  INTEGER: "int",
  REAL: "real",
  BOOLEAN: "bool",
  STRING: "str",
  CHAR: "str",
};

const isList = (t: Ty): boolean => t.startsWith("[");
const inner = (t: Ty): Ty => t.slice(1, -1);

export function join(a: Ty, b: Ty): Ty {
  if (a === b || b === "") return a;
  if (a === "") return b;
  if (isList(a) && isList(b)) return `[${join(inner(a), inner(b))}]`;
  if ((a === "int" && b === "real") || (a === "real" && b === "int")) return "real";
  return UNKNOWN;
}

const INPUT: Record<string, Ty> = { int: "int", real: "real", bool: "bool", char: "str", str: "str" };
const BUILTIN: Record<string, Ty> = {
  length: "int",
  random: "int",
  asc: "int",
  truncate: "int",
  randomReal: "real",
  strToNum: "real",
  left: "str",
  right: "str",
  mid: "str",
  ucase: "str",
  lcase: "str",
  toUpper: "str",
  toLower: "str",
  numToStr: "str",
  chr: "str",
  isNum: "bool",
};

type Table = Map<string, Ty>;

export class Types {
  private readonly globals: Table = new Map();
  private readonly locals = new Map<string, Table>();
  private readonly returns = new Map<string, Ty>();
  private changes = 0; // counts every time a type moves up the lattice

  constructor(private readonly program: Program) {
    for (const [name, d] of Object.entries(program.declared ?? {})) this.globals.set(name, DECLARED[d]);
    for (const sub of Object.values(program.subprograms)) {
      const table: Table = new Map();
      for (const [name, d] of Object.entries(sub.declared ?? {})) table.set(name, DECLARED[d]);
      this.locals.set(sub.name, table);
      if (sub.returns !== undefined) this.returns.set(sub.name, DECLARED[sub.returns]);
    }
    for (let round = 0; round < 50; round++) {
      const before = this.changes;
      this.walk(program.main, null);
      for (const sub of Object.values(program.subprograms)) this.walk(sub.body, sub);
      if (this.changes === before) break;
    }
  }

  /** The type of an expression inside `sub` (null for the main program); "unknown" when nothing is certain. */
  typeOf(e: Expr, sub: string | null): Ty {
    return this.exprType(e, sub === null ? null : (this.program.subprograms[sub] ?? null)) || UNKNOWN;
  }

  private table(sub: Subprogram | null, scope: "global" | "local"): Table {
    return (scope === "local" && sub !== null ? this.locals.get(sub.name) : undefined) ?? this.globals;
  }

  private declaredIn(sub: Subprogram | null, scope: "global" | "local", name: string): boolean {
    const d = scope === "local" && sub !== null ? sub.declared : this.program.declared;
    return d?.[name] !== undefined;
  }

  private assign(sub: Subprogram | null, scope: "global" | "local", name: string, t: Ty): void {
    if (this.declaredIn(sub, scope, name)) return; // the declared type wins
    const table = this.table(sub, scope);
    const old = table.get(name) ?? "";
    const next = join(old, t);
    if (next !== old) {
      table.set(name, next);
      this.changes++;
    }
  }

  private exprType(e: Expr, sub: Subprogram | null): Ty {
    const t = (x: Expr): Ty => this.exprType(x, sub);
    switch (e.kind) {
      case "literal":
        return { int: "int", real: "real", bool: "bool", char: "str", str: "str" }[e.value.kind];
      case "var":
        return this.table(sub, e.scope).get(e.name) ?? "";
      case "binary": {
        switch (e.op) {
          case "concatText":
            return "str";
          case "divReal":
            return "real";
          case "intDivFloor":
          case "modFloor":
            return "int";
          case "eq":
          case "ne":
          case "lt":
          case "le":
          case "gt":
          case "ge":
            return "bool";
          case "powIntIfNonNegative":
            return UNKNOWN; // INTEGER or REAL depending on the exponent's sign at run time
          case "add":
          case "sub":
          case "mul": {
            const [l, r] = [t(e.left), t(e.right)];
            if (l === "" || r === "") return "";
            const n = join(l, r);
            return n === "int" || n === "real" ? n : UNKNOWN;
          }
          default:
            return UNKNOWN;
        }
      }
      case "logical":
        return "bool";
      case "unary":
        return e.op === "not" ? "bool" : t(e.operand);
      case "newArray": {
        let ty: Ty = e.fill === undefined ? "" : t(e.fill);
        for (let i = 0; i < e.dims.length; i++) ty = `[${ty}]`;
        return ty;
      }
      case "copyArray":
        return t(e.source);
      case "arrayLiteral":
        return `[${e.elements.reduce<Ty>((acc, x) => join(acc, t(x)), "")}]`;
      case "index": {
        const target = t(e.target);
        return target === "" ? "" : isList(target) ? inner(target) : UNKNOWN;
      }
      case "builtin":
        return BUILTIN[e.name] ?? UNKNOWN;
      case "call":
        return this.returns.get(e.callee) ?? (this.program.subprograms[e.callee] === undefined ? UNKNOWN : "");
      default:
        return UNKNOWN;
    }
  }

  private target(t: AssignTarget, value: Ty, sub: Subprogram | null): void {
    if (t.kind === "var") this.assign(sub, t.scope, t.name, value);
    else if (t.kind === "element") {
      const wrapped = t.index2 === undefined ? `[${value}]` : `[[${value}]]`;
      this.assign(sub, t.array.scope, t.array.name, wrapped);
    }
  }

  private walk(body: Stmt[], sub: Subprogram | null): void {
    for (const s of body) {
      const t = (x: Expr): Ty => this.exprType(x, sub);
      switch (s.kind) {
        case "assign":
          this.target(s.target, t(s.value), sub);
          break;
        case "input":
          this.target(s.target, INPUT[s.convert] ?? UNKNOWN, sub);
          break;
        case "if":
          this.walk(s.then, sub);
          this.walk(s.else, sub);
          break;
        case "while":
        case "repeatUntil":
        case "repeatTimes":
          this.walk(s.body, sub);
          break;
        case "forInclusive": {
          const n = [t(s.start), t(s.end), s.step === null ? "int" : t(s.step)].reduce(join, "");
          this.assign(sub, s.variable.scope, s.variable.name, n === "int" || n === "real" || n === "" ? n : UNKNOWN);
          this.walk(s.body, sub);
          break;
        }
        case "forEach": {
          const it = t(s.iterable);
          this.assign(
            sub,
            s.variable.scope,
            s.variable.name,
            it === "str" ? "str" : isList(it) ? inner(it) : it === "" ? "" : UNKNOWN,
          );
          this.walk(s.body, sub);
          break;
        }
        case "tryCatch":
          this.walk(s.body, sub);
          this.walk(s.handler, sub);
          break;
        case "callStatement":
          this.callArgs(s.callee, s.args, sub);
          break;
        case "return":
          if (sub !== null && s.value !== null && sub.returns === undefined) {
            const old = this.returns.get(sub.name) ?? "";
            const next = join(old, t(s.value));
            if (next !== old) {
              this.returns.set(sub.name, next);
              this.changes++;
            }
          }
          break;
        default:
          break;
      }
      this.callsIn(s, sub);
    }
  }

  /** Function calls inside the statement's expressions also tell us what the parameters hold. */
  private callsIn(s: Stmt, sub: Subprogram | null): void {
    const visit = (e: Expr | null | undefined): void => {
      if (e === null || e === undefined) return;
      switch (e.kind) {
        case "call":
          this.callArgs(e.callee, e.args, sub);
          e.args.forEach(visit);
          break;
        case "binary":
        case "logical":
          visit(e.left);
          visit(e.right);
          break;
        case "unary":
          visit(e.operand);
          break;
        case "index":
          visit(e.target);
          visit(e.index);
          break;
        case "builtin":
        case "arrayLiteral":
          (e.kind === "builtin" ? e.args : e.elements).forEach(visit);
          break;
        case "copyArray":
          visit(e.source);
          break;
        default:
          break;
      }
    };
    switch (s.kind) {
      case "assign":
        visit(s.value);
        break;
      case "output":
        visit(s.value);
        break;
      case "if":
      case "while":
      case "repeatUntil":
        visit(s.condition);
        break;
      case "repeatTimes":
        visit(s.count);
        break;
      case "forInclusive":
        visit(s.start);
        visit(s.end);
        visit(s.step);
        break;
      case "forEach":
        visit(s.iterable);
        break;
      case "callStatement":
        s.args.forEach(visit);
        break;
      case "return":
        visit(s.value);
        break;
      default:
        break;
    }
  }

  private callArgs(callee: string, args: Expr[], sub: Subprogram | null): void {
    const target = this.program.subprograms[callee];
    if (target === undefined) return;
    args.forEach((a, i) => {
      const name = target.params[i];
      if (name !== undefined) this.assign(target, "local", name, this.exprType(a, sub));
    });
  }
}

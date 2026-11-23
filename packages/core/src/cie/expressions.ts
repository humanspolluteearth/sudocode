// CIE expressions: parse, type-check and lower in one pass.
//
// Compiler concept: *syntax-directed translation*. Instead of building a surface AST, then checking it, then
// lowering it (as the Edexcel front end does), each grammar rule here returns the finished IR node and its type
// at once. Expressions use *Pratt parsing*: every infix operator has a binding power (how tightly it holds its
// operands), and one loop handles the whole precedence table (CIE-41 uses the same order as Edexcel).
import type { Span } from "../diagnostics.ts";
import type { Expr as Ir, BinaryOp } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { Abandon, CIE_RESERVED, joinSpans, type CieCursor } from "./cursor.ts";
import type { Env } from "./env.ts";
import {
  BOOLEAN,
  CHAR,
  INTEGER,
  REAL,
  STRING,
  UNKNOWN,
  comparable,
  isNumber,
  isText,
  isUnknown,
  typeName,
  withArticle,
  type Ty,
} from "./types.ts";

/** A translated expression: its IR, its type, and whether it is a literal of exactly one character. */
export interface Typed {
  ir: Ir;
  ty: Ty;
  oneChar: boolean;
  span: Span;
  /** The bare variable name, when the expression is only a name (used for BYREF checks). */
  name?: string;
}

const POWER = { OR: 1, AND: 2, NOT: 3, COMPARE: 4, CONCAT: 5, ADD: 6, MULTIPLY: 7, NEGATE: 8, POWER: 9 } as const;
interface Infix {
  op: string;
  power: number;
  ir: BinaryOp | "andThen" | "orElse";
  right?: boolean;
}
const INFIX: Record<string, Infix> = {
  "=": { op: "=", power: POWER.COMPARE, ir: "eq" },
  "<>": { op: "<>", power: POWER.COMPARE, ir: "ne" },
  "<": { op: "<", power: POWER.COMPARE, ir: "lt" },
  "<=": { op: "<=", power: POWER.COMPARE, ir: "le" },
  ">": { op: ">", power: POWER.COMPARE, ir: "gt" },
  ">=": { op: ">=", power: POWER.COMPARE, ir: "ge" },
  "&": { op: "&", power: POWER.CONCAT, ir: "concatText" },
  "+": { op: "+", power: POWER.ADD, ir: "add" },
  "-": { op: "-", power: POWER.ADD, ir: "sub" },
  "*": { op: "*", power: POWER.MULTIPLY, ir: "mul" },
  "/": { op: "/", power: POWER.MULTIPLY, ir: "divReal" },
  "^": { op: "^", power: POWER.POWER, ir: "powIntIfNonNegative", right: true },
  OR: { op: "OR", power: POWER.OR, ir: "orElse" },
  AND: { op: "AND", power: POWER.AND, ir: "andThen" },
  DIV: { op: "DIV", power: POWER.MULTIPLY, ir: "intDivFloor" },
  MOD: { op: "MOD", power: POWER.MULTIPLY, ir: "modFloor" },
};

const infixOf = (t: Token): Infix | undefined =>
  t.kind === "symbol" ? INFIX[t.text] : t.kind === "word" ? INFIX[t.text.toUpperCase()] : undefined;

const typed = (ir: Ir, ty: Ty, span: Span, extra: Partial<Typed> = {}): Typed => ({
  ir,
  ty,
  oneChar: false,
  span,
  ...extra,
});

export class Expressions {
  constructor(
    readonly c: CieCursor,
    readonly env: Env,
  ) {}

  text(span: Span): string {
    return this.c.text(span);
  }

  expr(minPower = 0): Typed {
    let left = this.prefix();
    for (;;) {
      const t = this.c.peek();
      const infix = infixOf(t);
      if (infix === undefined || infix.power <= minPower) return left;
      this.c.next();
      if (t.kind === "word") this.c.warnCase(t, infix.op);
      const right = this.expr(infix.right === true ? infix.power - 1 : infix.power);
      left = this.binary(infix, t, left, right);
    }
  }

  private binary(infix: Infix, t: Token, l: Typed, r: Typed): Typed {
    const span = joinSpans(l.span, r.span);
    const bad = (variant: string): Typed => {
      if (!isUnknown(l.ty) && !isUnknown(r.ty)) {
        const type = !isNumber(l.ty) && variant !== "logic" ? l.ty : r.ty;
        this.c.report("E-CHK-OPERAND-TYPE", t.span, { operator: infix.op, type: typeName(type) }, variant);
      }
      return typed({ kind: "fail", code: "E-RUN-INTERNAL", args: {}, span }, UNKNOWN, span);
    };
    const make = (ty: Ty, ir: Ir["kind"] extends never ? never : Ir): Typed => typed(ir, ty, span);
    const bin = (ty: Ty): Typed =>
      make(
        ty,
        infix.ir === "andThen" || infix.ir === "orElse"
          ? { kind: "logical", op: infix.ir, left: l.ir, right: r.ir, span: t.span }
          : { kind: "binary", op: infix.ir, symbol: infix.op, left: l.ir, right: r.ir, span: t.span },
      );
    if (infix.power === POWER.COMPARE) {
      if (!comparable(l.ty, r.ty)) {
        this.c.report("E-CHK-COMPARE-TYPES", t.span, { left: withArticle(l.ty), right: withArticle(r.ty) });
        return typed({ kind: "fail", code: "E-RUN-INTERNAL", args: {}, span }, UNKNOWN, span);
      }
      return bin(BOOLEAN);
    }
    switch (infix.op) {
      case "AND":
      case "OR":
        if ((l.ty.kind !== "BOOLEAN" && !isUnknown(l.ty)) || (r.ty.kind !== "BOOLEAN" && !isUnknown(r.ty)))
          return bad("logic");
        return bin(BOOLEAN);
      case "&":
        if (!(isText(l.ty) || isUnknown(l.ty)) || !(isText(r.ty) || isUnknown(r.ty))) {
          const odd = isText(l.ty) || isUnknown(l.ty) ? r : l;
          this.c.report("E-CHK-CONCAT-NUMBER", odd.span, { value: this.text(odd.span), type: withArticle(odd.ty) });
          return typed({ kind: "fail", code: "E-RUN-INTERNAL", args: {}, span }, UNKNOWN, span);
        }
        return bin(STRING);
      case "DIV":
      case "MOD":
        if ((l.ty.kind !== "INTEGER" && !isUnknown(l.ty)) || (r.ty.kind !== "INTEGER" && !isUnknown(r.ty))) {
          const odd = l.ty.kind === "INTEGER" ? r : l;
          this.c.report("E-CHK-DIV-MOD-INTEGER", t.span, { operator: infix.op, type: withArticle(odd.ty) });
          return typed({ kind: "fail", code: "E-RUN-INTERNAL", args: {}, span }, UNKNOWN, span);
        }
        return bin(INTEGER);
      default: {
        if (!(isNumber(l.ty) || isUnknown(l.ty)) || !(isNumber(r.ty) || isUnknown(r.ty))) return bad("arithmetic");
        if (infix.op === "/") return bin(REAL);
        const both = l.ty.kind === "INTEGER" && r.ty.kind === "INTEGER";
        return bin(isUnknown(l.ty) || isUnknown(r.ty) ? UNKNOWN : both ? INTEGER : REAL);
      }
    }
  }

  private prefix(): Typed {
    const c = this.c;
    const t = c.peek();
    switch (t.kind) {
      case "newline":
      case "eof":
        c.report("E-SYN-LINE-ENDS-EARLY", t.span);
        throw new Abandon();
      case "error":
        return c.failSilently();
      case "int": {
        c.next();
        const value = Number(t.text);
        const ir: Ir = Number.isSafeInteger(value)
          ? { kind: "literal", value: { kind: "int", value }, span: t.span }
          : { kind: "fail", code: "E-RUN-NUMBER-TOO-LARGE", args: {}, span: t.span };
        return typed(ir, INTEGER, t.span);
      }
      case "real":
        c.next();
        return typed({ kind: "literal", value: { kind: "real", value: Number(t.text) }, span: t.span }, REAL, t.span);
      case "string": {
        c.next();
        const value = t.value ?? "";
        if (t.quote === "single") {
          return typed({ kind: "literal", value: { kind: "char", value }, span: t.span }, CHAR, t.span);
        }
        return typed({ kind: "literal", value: { kind: "str", value }, span: t.span }, STRING, t.span, {
          oneChar: Array.from(value).length === 1,
        });
      }
      case "symbol":
        return this.prefixSymbol(t);
      case "word":
        return this.prefixWord(t);
      default:
        return c.fail("a value", "Write a value or a name here.");
    }
  }

  private prefixSymbol(t: Token): Typed {
    const c = this.c;
    if (t.text === "-") {
      c.next();
      const operand = this.expr(POWER.NEGATE);
      const span = joinSpans(t.span, operand.span);
      if (!isNumber(operand.ty) && !isUnknown(operand.ty)) {
        c.report("E-CHK-OPERAND-TYPE", t.span, { operator: "-", type: typeName(operand.ty) }, "arithmetic");
        return typed(operand.ir, UNKNOWN, span);
      }
      return typed({ kind: "unary", op: "negate", operand: operand.ir, span: t.span }, operand.ty, span);
    }
    if (t.text === "(") {
      c.next();
      const inner = this.expr();
      const close = c.expectSymbol(")", ")", "Close every ( with ).");
      return { ...inner, span: joinSpans(t.span, close.span) };
    }
    return c.fail("a value", "Write a value or a name here.");
  }

  private prefixWord(t: Token): Typed {
    const c = this.c;
    const upper = t.text.toUpperCase();
    if (upper === "TRUE" || upper === "FALSE") {
      c.next();
      c.warnCase(t, upper);
      return typed(
        { kind: "literal", value: { kind: "bool", value: upper === "TRUE" }, span: t.span },
        BOOLEAN,
        t.span,
      );
    }
    if (upper === "NOT") {
      c.next();
      c.warnCase(t, "NOT");
      const operand = this.expr(POWER.NOT);
      if (operand.ty.kind !== "BOOLEAN" && !isUnknown(operand.ty)) {
        c.report("E-CHK-OPERAND-TYPE", t.span, { operator: "NOT", type: typeName(operand.ty) }, "logic");
        return typed(operand.ir, UNKNOWN, joinSpans(t.span, operand.span));
      }
      return typed(
        { kind: "unary", op: "not", operand: operand.ir, span: t.span },
        BOOLEAN,
        joinSpans(t.span, operand.span),
      );
    }
    if (upper === "DIV" || upper === "MOD") {
      if (c.isSymbol("(", 1)) return this.divModCall(t, upper);
    }
    if (CIE_RESERVED.has(upper) && t.text === upper) return c.fail("a value", "Write a value or a name here.");
    c.next();
    if (c.isSymbol("(")) return this.call(t);
    return this.variable(t);
  }

  /** CIE-42: DIV(a, b) and MOD(a, b) work, with a warning that the operator form is official. */
  private divModCall(t: Token, upper: string): Typed {
    const c = this.c;
    c.next();
    c.next();
    const a = this.expr();
    c.expectSymbol(",", ",", "Write both numbers, such as DIV(7, 2).");
    const b = this.expr();
    const close = c.expectSymbol(")", ")", "Close the call with ).");
    const span = joinSpans(t.span, close.span);
    c.report("W-CIE-DIV-FUNCTION", span, { official: `${this.text(a.span)} ${upper} ${this.text(b.span)}` });
    const op: BinaryOp = upper === "DIV" ? "intDivFloor" : "modFloor";
    return typed({ kind: "binary", op, symbol: upper, left: a.ir, right: b.ir, span: t.span }, INTEGER, span);
  }

  private variable(t: Token): Typed {
    const v = this.env.lookup(t.text);
    if (v === undefined) {
      this.undeclared(t);
      return typed({ kind: "var", name: t.text, scope: "global", span: t.span }, UNKNOWN, t.span);
    }
    const scope = this.env.isLocal(t.text) ? "local" : "global";
    return typed({ kind: "var", name: t.text, scope, span: t.span }, v.ty, t.span, { name: t.text });
  }

  undeclared(t: Token): void {
    const lower = t.text.toLowerCase();
    const close = this.env.names().find((n) => n.toLowerCase() === lower);
    if (close !== undefined)
      this.c.report("E-CHK-UNDECLARED", t.span, { name: t.text, suggestion: close }, "did-you-mean");
    else this.c.report("E-CHK-UNDECLARED", t.span, { name: t.text });
  }

  /** A call to a user function in an expression (CIE-70..78). */
  private call(t: Token): Typed {
    const c = this.c;
    c.next();
    const args = this.args();
    const close = c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
    const span = joinSpans(t.span, close.span);
    const sig = this.env.subs.get(t.text);
    if (sig === undefined) {
      this.undeclared(t);
      return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, UNKNOWN, span);
    }
    if (sig.kind === "procedure") {
      c.report("E-CHK-CALL-REQUIRED", t.span, { name: t.text }, "procedure-in-expression");
      return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, UNKNOWN, span);
    }
    this.checkArgs(sig.name, sig.params, args, t);
    return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, sig.returns ?? UNKNOWN, span);
  }

  args(): Typed[] {
    const out: Typed[] = [];
    if (this.c.isSymbol(")")) return out;
    for (;;) {
      out.push(this.expr());
      if (!this.c.isSymbol(",")) return out;
      this.c.next();
    }
  }

  /** CIE-74: the number and types of the arguments must match the parameters. */
  checkArgs(name: string, params: { name: string; ty: Ty }[], args: Typed[], at: Token): void {
    if (args.length !== params.length) {
      const n = (k: number): string => (k === 1 ? "1 argument" : `${String(k)} arguments`);
      const signature = `${name}(${params.map((p) => `${p.name} : ${typeName(p.ty)}`).join(", ")})`;
      this.c.report("E-CHK-ARG-COUNT", at.span, {
        name,
        expected: n(params.length),
        actual: String(args.length),
        line: at.span.line,
        signature,
      });
      return;
    }
    params.forEach((p, k) => {
      const a = args[k];
      if (a === undefined) return;
      if (!fitsArg(a, p.ty)) {
        this.c.report("E-CHK-ARG-TYPE", a.span, {
          function: name,
          expected: typeName(p.ty),
          argument: this.text(a.span),
          actual: typeName(a.ty),
          alternative: "",
        });
      }
    });
  }
}

function fitsArg(a: Typed, into: Ty): boolean {
  if (isUnknown(a.ty) || isUnknown(into)) return true;
  if (into.kind === "REAL" && a.ty.kind === "INTEGER") return true;
  if (into.kind === "CHAR" && a.ty.kind === "STRING") return a.oneChar;
  if (into.kind === "STRING" && a.ty.kind === "CHAR") return true;
  return a.ty.kind === into.kind;
}

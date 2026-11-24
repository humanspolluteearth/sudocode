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
import type { Env, Variable } from "./env.ts";
import { element, fields, subscripts } from "./access.ts";
import { argumentList, argIrs, call, checkArgs } from "./calls.ts";
import { newObject, superCall } from "./classes.ts";
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

export const typed = (ir: Ir, ty: Ty, span: Span, extra: Partial<Typed> = {}): Typed => ({
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
      if (l.ty.kind === "ENUM") return enumCompare(bin, infix, t, l, r, span);
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
          this.c.report("E-CHK-CONCAT-NUMBER", t.span, { value: this.text(odd.span), type: withArticle(odd.ty) });
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
        // CIE-31: `Season + 1` is the next value of the type; `- 1` the one before.
        if (l.ty.kind === "ENUM" && r.ty.kind === "INTEGER" && (infix.op === "+" || infix.op === "-")) {
          const by: Ir = infix.op === "+" ? r.ir : { kind: "unary", op: "negate", operand: r.ir, span: t.span };
          return make(l.ty, { kind: "enumStep", operand: l.ir, by, span: t.span });
        }
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
    if (upper === "NEW" && t.text === upper) return newObject(this, t);
    if (upper === "SUPER" && t.text === upper) {
      const call = superCall(this, t);
      if (call !== null) return call;
    }
    if (CIE_RESERVED.has(upper) && t.text === upper) return c.fail("a value", "Write a value or a name here.");
    c.next();
    if (c.isSymbol("(")) return call(this, t);
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
    const v = this.lookupVar(t);
    if (v === undefined) {
      this.undeclared(t);
      return typed({ kind: "var", name: t.text, scope: "global", span: t.span }, UNKNOWN, t.span);
    }
    if (v.literal !== undefined) {
      const lit = typed(v.literal(t.span), v.ty, t.span); // CIE-31: an enumerated value; CIE-111: an attribute of Self
      return v.attr === true ? this.fields(t, this.c.isSymbol("[") ? this.element(t, lit) : lit) : lit;
    }
    const scope = this.env.isLocal(t.text) ? "local" : "global";
    const whole = typed({ kind: "var", name: v.name, scope, span: t.span }, v.ty, t.span, { name: v.name });
    return this.fields(t, this.c.isSymbol("[") ? this.element(t, whole) : whole);
  }
  fields(t: Token, base: Typed): Typed {
    return fields(this, t, base);
  }

  element(t: Token, whole: Typed): Typed {
    return element(this, t, whole);
  }

  subscripts(t: Token, ty: Ty): { indexes: Typed[]; span: Span } {
    return subscripts(this, t, ty);
  }

  args(): Typed[] {
    return argumentList(this);
  }

  argIrs(params: { ty: Ty; byRef: boolean }[], a: Typed[]): Ir[] {
    return argIrs(this, params, a);
  }

  checkArgs(name: string, params: { name: string; ty: Ty }[], a: Typed[], at: Token): void {
    checkArgs(this, name, params, a, at);
  }

  /** Finds a variable whatever the casing (CIE-03); a different casing from its declaration is a warning. */
  lookupVar(t: Token): Variable | undefined {
    const v = this.env.lookup(t.text);
    if (v !== undefined && v.name !== t.text) {
      this.c.report("W-CIE-NAME-CASE", t.span, { word: t.text, name: v.name }, undefined, [
        { start: t.span.start, end: t.span.end, replacement: v.name },
      ]);
    }
    return v;
  }

  /** CIE-11: reported once, at the first use; the name is then known (type unknown) so later uses stay quiet. */
  undeclared(t: Token): void {
    this.c.report("E-CHK-UNDECLARED", t.span, { name: t.text });
    this.env.declare(t.text, { ty: UNKNOWN, constant: false });
  }
}

/** CIE-31: values of an enumerated type compare by their place in the list, so both sides become INTEGERs first. */
function enumCompare(bin: (ty: Ty) => Typed, infix: Infix, t: Token, l: Typed, r: Typed, span: Span): Typed {
  const place = (e: Typed): Ir => ({ kind: "enumOrdinal", operand: e.ir, span: e.span });
  const op = infix.ir;
  if (op === "andThen" || op === "orElse") return bin(BOOLEAN);
  return typed({ kind: "binary", op, symbol: infix.op, left: place(l), right: place(r), span: t.span }, BOOLEAN, span);
}

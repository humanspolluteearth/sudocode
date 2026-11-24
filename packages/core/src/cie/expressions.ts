// CIE expressions: parse, type-check and lower in one pass.
//
// Compiler concept: *syntax-directed translation*. Instead of building a surface AST, then checking it, then
// lowering it (as the Edexcel front end does), each grammar rule here returns the finished IR node and its type
// at once. Expressions use *Pratt parsing*: every infix operator has a binding power (how tightly it holds its
// operands), and one loop handles the whole precedence table (CIE-41 uses the same order as Edexcel).
import type { Span } from "../diagnostics.ts";
import type { Expr as Ir, BinaryOp } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { BUILTINS, KIND_NAME, fitsKind, type BuiltinSignature } from "./builtins.ts";
import { Abandon, CIE_RESERVED, joinSpans, type CieCursor } from "./cursor.ts";
import type { Env, Variable } from "./env.ts";
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
    const v = this.lookupVar(t);
    if (v === undefined) {
      this.undeclared(t);
      return typed({ kind: "var", name: t.text, scope: "global", span: t.span }, UNKNOWN, t.span);
    }
    if (v.literal !== undefined) return typed(v.literal(t.span), v.ty, t.span); // CIE-31: an enumerated value
    const scope = this.env.isLocal(t.text) ? "local" : "global";
    const whole = typed({ kind: "var", name: v.name, scope, span: t.span }, v.ty, t.span, { name: v.name });
    return this.fields(t, this.c.isSymbol("[") ? this.element(t, whole) : whole);
  }

  /**
   * CIE-30: `.field` after a name or an item, as often as it is written (`Form[2].Name`, `A.Inner.F`). The result's
   * `path` is the text so far, for messages such as "A.F has no value yet".
   */
  fields(t: Token, base: Typed): Typed {
    const c = this.c;
    let left = base;
    let text = this.text(joinSpans(t.span, base.span));
    while (c.isSymbol(".") && c.peek(1).kind === "word") {
      c.next();
      const f = c.next();
      const span = joinSpans(t.span, f.span);
      if (isUnknown(left.ty)) {
        left = typed(left.ir, UNKNOWN, span);
      } else if (left.ty.kind !== "RECORD") {
        c.report("E-CHK-NOT-RECORD", f.span, { name: text, type: withArticle(left.ty) });
        left = typed(left.ir, UNKNOWN, span);
      } else {
        const field = left.ty.fields.find((x) => x.name === f.text);
        if (field === undefined) {
          c.report("E-CHK-NO-FIELD", f.span, {
            name: text,
            field: f.text,
            fields: left.ty.fields.map((x) => x.name).join(", "),
          });
          left = typed(left.ir, UNKNOWN, span);
        } else {
          left = typed({ kind: "field", target: left.ir, name: f.text, text, span }, field.ty, span);
        }
      }
      text = `${text}.${f.text}`;
    }
    return left;
  }

  /**
   * Reads `A[i]`, `A[i, j]` or `S[i]` (CIE-20 to CIE-25). A 2D read is two nested `index` nodes: the first picks the
   * row, the second the item (the runtime has no 2D read of its own). Lower bounds go in `base`, so the IR states
   * where counting starts; a STRING counts from 1 (CIE-25).
   */
  element(t: Token, whole: Typed): Typed {
    const { indexes, span } = this.subscripts(t, whole.ty);
    const full = joinSpans(t.span, span);
    if (isUnknown(whole.ty)) return typed(whole.ir, UNKNOWN, full);
    const ty = whole.ty;
    const [first, second] = indexes;
    if (first === undefined) return typed(whole.ir, UNKNOWN, full);
    const lows = ty.kind === "ARRAY" ? ty.lows : [1];
    const row: Ir = {
      kind: "index",
      target: whole.ir,
      index: first.ir,
      base: lows[0] ?? 1,
      text: t.text,
      span: full,
    };
    const item = ty.kind === "ARRAY" ? ty.of : CHAR;
    if (second === undefined) return typed(row, item, full);
    const rowText = `${t.text}[${this.text(first.span)}]`;
    return typed(
      { kind: "index", target: row, index: second.ir, base: lows[1] ?? 1, text: rowText, span: full },
      item,
      full,
    );
  }

  /**
   * The indexes after a name: `[` expr {`,` expr} `]`. Checks that the name can be indexed, that the right number of
   * indexes is given and that each is an INTEGER. `A[1 TO 3]` is the CIE-24 group assignment error.
   */
  subscripts(t: Token, ty: Ty): { indexes: Typed[]; span: Span } {
    const c = this.c;
    c.next(); // [
    const indexes: Typed[] = [];
    for (;;) {
      const value = this.expr();
      if (c.peek().kind === "word" && c.peek().text.toUpperCase() === "TO") {
        c.report("E-CHK-GROUP-ASSIGN", t.span);
        return c.failSilently();
      }
      if (!isUnknown(value.ty) && value.ty.kind !== "INTEGER") {
        c.report("E-CHK-NEEDS-INTEGER", value.span, { type: withArticle(value.ty), name: t.text }, "index");
      }
      indexes.push(value);
      if (!c.isSymbol(",")) break;
      c.next();
    }
    const close = c.expectSymbol("]", "]", "Close the index with ].");
    if (!isUnknown(ty)) {
      const allowed = ty.kind === "ARRAY" ? ty.dims.length : ty.kind === "STRING" ? 1 : 0;
      if (allowed === 0) {
        c.report("E-CHK-NOT-INDEXABLE", t.span, { name: t.text, type: withArticle(ty) });
        return c.failSilently();
      }
      if (indexes.length !== allowed) {
        const found = `${String(indexes.length)} ${indexes.length === 1 ? "index" : "indexes"}`;
        c.report("E-SYN-EXPECTED", close.span, {
          expected: allowed === 1 ? "one index" : "two indexes",
          found,
          advice: allowed === 1 ? `Write ${t.text}[index].` : `Write ${t.text}[row, column].`,
        });
        return c.failSilently();
      }
    }
    return { indexes, span: close.span };
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

  /** A call to a user function in an expression (CIE-70..78). */
  private call(t: Token): Typed {
    const c = this.c;
    c.next();
    const args = this.args();
    const close = c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
    const span = joinSpans(t.span, close.span);
    const sig = this.env.subs.get(t.text);
    const builtin = BUILTINS[t.text];
    if (sig === undefined && builtin !== undefined) return this.builtin(t, builtin, args, span);
    if (sig === undefined) {
      c.report("E-CHK-UNKNOWN-FUNCTION", t.span, { name: t.text });
      return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, UNKNOWN, span);
    }
    if (sig.kind === "procedure") {
      c.report("E-CHK-CALL-REQUIRED", t.span, { name: t.text }, "procedure-in-expression");
      return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, UNKNOWN, span);
    }
    this.checkArgs(sig.name, sig.params, args, t);
    return typed(
      { kind: "call", callee: t.text, args: this.argIrs(sig.params, args), span },
      sig.returns ?? UNKNOWN,
      span,
    );
  }

  /** A call of a built-in function (CIE-120 to CIE-129): check the argument count and kinds, then type the result. */
  private builtin(t: Token, sig: BuiltinSignature, args: Typed[], span: Span): Typed {
    const ir: Ir = { kind: "builtin", name: sig.ir, args: args.map((a) => a.ir), span: t.span };
    const first = args[0];
    const result = sig.returns === "sameAsFirst" ? (first?.ty.kind === "CHAR" ? CHAR : STRING) : sig.returns;
    if (args.length !== sig.params.length) {
      const n = (k: number): string => (k === 0 ? "no arguments" : k === 1 ? "1 argument" : `${String(k)} arguments`);
      const names = sig.params.map((p) => KIND_NAME[p]).join(", ");
      this.c.report(
        "E-CHK-ARG-COUNT",
        t.span,
        { name: t.text, expected: n(sig.params.length), actual: String(args.length), signature: `${t.text}(${names})` },
        "builtin",
      );
      return typed(ir, UNKNOWN, span);
    }
    let ok = true;
    for (const [i, kind] of sig.params.entries()) {
      const a = args[i];
      if (a === undefined || isUnknown(a.ty) || fitsKind(kind, a.ty, a.oneChar)) continue;
      ok = false;
      const useStringVersion = sig.stringVersion !== undefined && a.ty.kind === "STRING";
      this.c.report(
        "E-CHK-ARG-TYPE",
        a.span,
        {
          function: t.text,
          expected: KIND_NAME[kind],
          argument: this.text(a.span),
          actual: typeName(a.ty),
          alternative: sig.stringVersion ?? "",
        },
        useStringVersion ? "use-to-upper" : undefined,
      );
    }
    return typed(ir, ok ? result : UNKNOWN, span);
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
  /** BYVAL array and record arguments are copied in, so the procedure cannot change the caller's (CIE-73). */
  argIrs(params: { ty: Ty; byRef: boolean }[], args: Typed[]): Ir[] {
    return args.map((a, k) => {
      const p = params[k];
      const shared = p !== undefined && !p.byRef && (p.ty.kind === "ARRAY" || p.ty.kind === "RECORD");
      return shared ? { kind: "copyArray", source: a.ir, span: a.span } : a.ir;
    });
  }

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

/** CIE-31: values of an enumerated type compare by their place in the list, so both sides become INTEGERs first. */
function enumCompare(bin: (ty: Ty) => Typed, infix: Infix, t: Token, l: Typed, r: Typed, span: Span): Typed {
  const place = (e: Typed): Ir => ({ kind: "enumOrdinal", operand: e.ir, span: e.span });
  const op = infix.ir;
  if (op === "andThen" || op === "orElse") return bin(BOOLEAN);
  return typed({ kind: "binary", op, symbol: infix.op, left: place(l), right: place(r), span: t.span }, BOOLEAN, span);
}

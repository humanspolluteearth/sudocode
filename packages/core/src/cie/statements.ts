// CIE statements: parse, check and lower in one pass (see expressions.ts for the idea).
//
// Compiler concepts:
// - *Recursive descent*: one method per statement kind; a block's method calls `body`, which calls `statement`.
// - *Panic-mode recovery*: a mistake reports once, throws `Abandon`, and `body` skips to the next line.
// - *Desugaring*: CASE has no IR node of its own; it becomes an if-chain, and an OUTPUT list becomes one text join.
import type { AssignTarget, VarRef, InputConversion, Stmt as Ir, Expr as IrExpr } from "../ir/ir.ts";
import type { Span } from "../diagnostics.ts";
import type { Token } from "../edexcel/tokens.ts";
import { Abandon, CIE_RESERVED, joinSpans, type CieCursor } from "./cursor.ts";
import type { Env, Variable } from "./env.ts";
import { arrayType } from "./arrays.ts";
import { fileStatement } from "./files.ts";
import { placeOf } from "./byref.ts";
import { startingValue, typeDeclaration } from "./records.ts";
import { Expressions, type Typed } from "./expressions.ts";
import { SCALAR_TYPES, fits, isUnknown, typeName, withArticle, UNKNOWN, type Ty } from "./types.ts";

const CONVERT: Readonly<Record<string, InputConversion>> = {
  INTEGER: "int",
  REAL: "real",
  BOOLEAN: "bool",
  CHAR: "char",
  STRING: "str",
};

/** Closer word -> the block it closes, for "has no matching ..." messages. */
const OWNER: Readonly<Record<string, string>> = {
  ENDIF: "IF",
  ELSE: "IF",
  ENDWHILE: "WHILE",
  NEXT: "FOR",
  UNTIL: "REPEAT",
  ENDCASE: "CASE",
  ENDPROCEDURE: "PROCEDURE",
  ENDFUNCTION: "FUNCTION",
  ENDTRY: "TRY",
  EXCEPT: "TRY",
};

export interface BodyResult {
  stmts: Ir[];
  /** The closer that ended the body (consumed), or null at the end of the program. */
  end: string | null;
}

export class Statements {
  readonly x: Expressions;
  /** Set by the subprogram part; gives access to `procedure` and `function` parsing. */
  subprogram: ((first: Token, upper: string) => void) | null = null;

  constructor(
    readonly c: CieCursor,
    readonly env: Env,
  ) {
    this.x = new Expressions(c, env);
  }

  skipBlank(): void {
    while (this.c.peek().kind === "newline") this.c.next();
  }

  /** Is the next statement a closer from `terms`? Handles the two-word END IF (CIE-51). */
  private closerAhead(terms: readonly string[]): string | null {
    const t = this.c.peek();
    if (t.kind !== "word") return null;
    const upper = t.text.toUpperCase();
    if (upper === "END" && terms.includes("ENDIF") && this.c.isKeyword("IF", 1)) return "END IF";
    return terms.includes(upper) ? upper : null;
  }

  /** Statements until one of `terms` (consumed) or the end of the program. */
  body(terms: readonly string[]): BodyResult {
    const stmts: Ir[] = [];
    for (;;) {
      this.skipBlank();
      const found = this.closerAhead(terms);
      if (found !== null) {
        const first = this.c.next();
        if (found === "END IF") {
          this.c.report("W-CIE-ENDIF", first.span, {}, undefined, [
            { start: first.span.start, end: this.c.peek().span.end, replacement: "ENDIF" },
          ]);
          this.c.next();
          return { stmts, end: "ENDIF" };
        }
        this.c.warnCase(first, found);
        return { stmts, end: found };
      }
      if (this.c.peek().kind === "eof") return { stmts, end: null };
      try {
        stmts.push(...this.statement());
      } catch (e) {
        if (!(e instanceof Abandon)) throw e;
        this.c.skipLine();
        this.c.endLine();
      }
    }
  }

  /** A block that must end with `closer`; reports "never closed" otherwise (CIE-50). */
  block(opener: Token, name: string, terms: readonly string[], closer: string): BodyResult {
    const r = this.body(terms);
    if (r.end === null) {
      const at = this.c.source.length;
      this.c.report("E-SYN-BLOCK-NOT-CLOSED", opener.span, { block: name, line: opener.span.line, closer }, undefined, [
        { start: at, end: at, replacement: `\n${closer}\n` },
      ]);
    }
    return r;
  }

  statement(): Ir[] {
    const c = this.c;
    const first = c.peek();
    if (first.kind === "error") return c.failSilently();
    if (first.kind !== "word")
      return c.fail("a statement", "Statements start with a keyword such as OUTPUT or IF, or a variable name.");
    const upper = first.text.toUpperCase();
    switch (upper) {
      case "TRY":
        return this.tryStatement(first);
      case "DECLARE":
        return this.declare(first);
      case "CONSTANT":
        return this.constant(first);
      case "INPUT":
        return this.input(first);
      case "OUTPUT":
        return this.output(first);
      case "IF":
        return this.ifStatement(first);
      case "CASE":
        return this.caseStatement(first);
      case "FOR":
        return this.forStatement(first);
      case "WHILE":
        return this.whileStatement(first);
      case "REPEAT":
        return this.repeatStatement(first);
      case "CALL":
        return this.call(first);
      case "RETURN":
        return this.returnStatement(first);
      case "PROCEDURE":
      case "FUNCTION":
        if (this.subprogram === null) throw new Error("subprogram parser missing");
        this.subprogram(first, upper);
        return [];
      case "TYPE":
        typeDeclaration(c, this.env, first, () => this.typeName());
        return [];
      case "ARRAY":
      case "CLASS":
      case "FINALLY": // CIE-101: only one EXCEPT clause exists; FINALLY is not supported
        return this.notSupported(first, upper);
      case "OPENFILE":
      case "READFILE":
      case "WRITEFILE":
      case "CLOSEFILE":
      case "SEEK":
      case "GETRECORD":
      case "PUTRECORD":
        return fileStatement(this, first, upper);
      default:
        break;
    }
    if (OWNER[upper] !== undefined || upper === "END") {
      c.next();
      c.report("E-SYN-UNMATCHED-CLOSER", first.span, { closer: upper, block: OWNER[upper] ?? "block" });
      c.skipLine();
      c.endLine();
      return [];
    }
    if (CIE_RESERVED.has(upper) && first.text === upper)
      return c.fail("a statement", "Check the first word on the line.");
    return this.assignOrCall(first);
  }

  private notSupported(first: Token, upper: string): never {
    this.c.report("E-SYN-NOT-SUPPORTED", first.span, {
      feature: upper,
      advice: "This part of Cambridge pseudocode is not available in Sudocode yet.",
    });
    return this.c.failSilently();
  }

  /** A name being declared or assigned: a keyword in any case is an error (CIE-03). */
  private newName(): Token {
    const c = this.c;
    const t = c.peek();
    if (t.kind === "error") return c.failSilently();
    if (t.kind !== "word") return c.fail("a name", "Names start with a letter.");
    c.next();
    if (CIE_RESERVED.has(t.text.toUpperCase())) {
      c.report("E-SYN-KEYWORD-AS-NAME", t.span, {
        word: t.text,
        suggestion: `my${t.text.charAt(0).toUpperCase()}${t.text.slice(1).toLowerCase()}`,
      });
      this.env.declare(t.text, { ty: UNKNOWN, constant: false }); // so later uses add no errors
      throw new Abandon();
    }
    return t;
  }

  private typeName(scalarOnly = false): Ty {
    const c = this.c;
    const t = c.peek();
    if (t.kind === "word") {
      const ty = SCALAR_TYPES[t.text.toUpperCase()];
      if (ty !== undefined) {
        c.next();
        c.warnCase(t, t.text.toUpperCase());
        return ty;
      }
      const declared = this.env.types.get(t.text);
      if (declared !== undefined) {
        c.next();
        return declared;
      }
      if (t.text.toUpperCase() === "ARRAY" && !scalarOnly) {
        c.next();
        c.warnCase(t, "ARRAY");
        return arrayType(c, t, () => this.typeName(true));
      }
    }
    return c.fail("a type", "Use INTEGER, REAL, CHAR, STRING or BOOLEAN.");
  }

  private declare(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "DECLARE");
    const names: Token[] = [];
    for (;;) {
      names.push(this.newName());
      if (!c.isSymbol(",")) break;
      c.next();
    }
    c.expectSymbol(":", ":", "Write the type after a colon, e.g. DECLARE Age : INTEGER.");
    const ty = this.typeName();
    for (const n of names) this.env.declare(n.text, { ty, constant: false });
    c.endStatement();
    // An array or record exists from its DECLARE, with every item unset (CIE-20, CIE-30); other types get their
    // value on assignment.
    const span = c.spanFrom(first);
    return names.flatMap((n): Ir[] => {
      const value = startingValue(ty, span);
      return value === null ? [] : [{ kind: "assign", target: this.ref(n), value, span }];
    });
  }

  private constant(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "CONSTANT");
    const name = this.newName();
    c.expectSymbol("=", "=", "Write the value after =, e.g. CONSTANT Max = 10.");
    const value = this.x.expr();
    const ir = value.ir;
    const plain = ir.kind === "literal" || (ir.kind === "unary" && ir.op === "negate" && ir.operand.kind === "literal");
    if (!plain) c.report("E-CHK-CONSTANT-LITERAL", value.span);
    this.env.declare(name.text, { ty: plain ? value.ty : UNKNOWN, constant: true });
    c.endStatement();
    return [{ kind: "assign", target: this.ref(name), value: ir, span: c.spanFrom(first) }];
  }

  ref(t: Token): VarRef {
    return {
      kind: "var",
      name: this.env.lookup(t.text)?.name ?? t.text,
      scope: this.env.isLocal(t.text) ? "local" : "global",
      span: t.span,
    };
  }

  private input(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "INPUT");
    const name = c.peek();
    if (name.kind !== "word")
      return c.fail("a variable", "Write the variable that receives the input, e.g. INPUT Age.");
    c.next();
    const v = this.x.lookupVar(name);
    const indexes = c.isSymbol("[") ? this.x.subscripts(name, v?.ty ?? UNKNOWN).indexes : null;
    if (v === undefined) {
      this.x.undeclared(name);
      return c.failSilently();
    }
    if (v.constant) {
      c.report("E-CHK-CONSTANT-ASSIGN", name.span, { name: name.text });
      return c.failSilently();
    }
    c.endStatement();
    // CIE-80: the variable can be an array element; the line is converted to the item's type.
    const item = v.ty.kind === "ARRAY" ? v.ty.of : v.ty;
    const convert = CONVERT[typeName(item)] ?? "str";
    const target = indexes === null ? this.ref(name) : this.elementTarget(name, v.ty, indexes, c.spanFrom(first));
    return [{ kind: "input", target, convert, device: null, span: c.spanFrom(first) }];
  }

  private output(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "OUTPUT");
    const values: Typed[] = [this.x.expr()];
    while (c.isSymbol(",")) {
      c.next();
      values.push(this.x.expr());
    }
    c.endStatement();
    // CIE-82: an output list prints its values one after another, so it is one text join.
    const [head, ...rest] = values.map((v) => v.ir);
    if (head === undefined) return c.failSilently();
    const joined = rest.reduce<IrExpr>(
      (left, right) => ({ kind: "binary", op: "concatText", symbol: ",", left, right, span: right.span }),
      head,
    );
    return [{ kind: "output", value: joined, device: null, span: c.spanFrom(first) }];
  }

  private assignOrCall(first: Token): Ir[] {
    const c = this.c;
    if (c.isSymbol("(", 1)) {
      const sig = this.env.subs.get(first.text);
      if (sig?.kind === "procedure") c.report("E-CHK-CALL-REQUIRED", first.span, { name: first.text });
      else this.x.undeclared(first);
      return c.failSilently();
    }
    c.next();
    const v = this.x.lookupVar(first);
    if (c.isSymbol(".") || (c.isSymbol("[") && this.fieldFollowsIndex())) return this.fieldAssign(first, v);
    if (c.isSymbol("[")) return this.elementAssign(first, v);
    if (!c.isSymbol("←")) {
      if (v === undefined) {
        this.x.undeclared(first);
        return c.failSilently();
      }
      return c.fail("←", "Use <- to store a value: Name <- value.");
    }
    c.next();
    const value = this.x.expr();
    if (v === undefined) {
      this.x.undeclared(first);
      return c.failSilently();
    }
    if (v.constant) {
      c.report("E-CHK-CONSTANT-ASSIGN", first.span, { name: first.text });
      return c.failSilently();
    }
    this.checkFits(first.text, v.ty, value);
    c.endStatement();
    // CIE-23: `B <- A` copies the items, so changing A later leaves B alone.
    const whole = this.copyOf(v.ty, value);
    return [
      { kind: "assign", target: this.ref(first), value: whole ?? this.valueFor(v.ty, value), span: c.spanFrom(first) },
    ];
  }

  /** After a name and `[`: does the matching `]` have a `.` after it (`Form[2].Name <- ...`)? */
  private fieldFollowsIndex(): boolean {
    let depth = 0;
    for (let i = 0; ; i++) {
      const t = this.c.peek(i);
      if (t.kind === "newline" || t.kind === "eof") return false;
      if (t.kind === "symbol" && t.text === "[") depth++;
      if (t.kind === "symbol" && t.text === "]" && --depth === 0) {
        const next = this.c.peek(i + 1);
        return next.kind === "symbol" && next.text === ".";
      }
    }
  }

  /** `Rec.Field <- value`, `Form[i].Field <- value` (CIE-30). The left side is read like an expression, then used as a target. */
  private fieldAssign(first: Token, v: Variable | undefined): Ir[] {
    const c = this.c;
    if (v === undefined) {
      this.x.undeclared(first);
      return c.failSilently();
    }
    const scope = this.env.isLocal(first.text) ? "local" : "global";
    const root: VarRef = { kind: "var", name: v.name, scope, span: first.span };
    const base: Typed = { ir: root, ty: v.ty, oneChar: false, span: first.span };
    const left = this.x.fields(first, c.isSymbol("[") ? this.x.element(first, base) : base);
    c.expectSymbol("←", "←", "Use <- to store a value: Name.Field <- value.");
    const value = this.x.expr();
    if (left.ir.kind !== "field") return c.failSilently(); // already reported
    if (v.constant) {
      c.report("E-CHK-CONSTANT-ASSIGN", first.span, { name: first.text });
      return c.failSilently();
    }
    this.checkFits(c.text(left.span), left.ty, value);
    c.endStatement();
    const target: AssignTarget = {
      kind: "field",
      record: left.ir.target,
      root,
      name: left.ir.name,
      text: left.ir.text,
      span: c.spanFrom(first),
    };
    return [
      {
        kind: "assign",
        target,
        value: this.copyOf(left.ty, value) ?? this.valueFor(left.ty, value),
        span: c.spanFrom(first),
      },
    ];
  }

  /** Arrays and records are copied when assigned whole, so the two variables stay separate (CIE-23, CIE-30). */
  private copyOf(ty: Ty, value: Typed): IrExpr | null {
    return ty.kind === "ARRAY" || ty.kind === "RECORD"
      ? { kind: "copyArray", source: value.ir, span: value.span }
      : null;
  }

  /** The IR target for `A[i]` or `A[i, j]`: counting starts at the declared lower bound and the length is fixed. */
  private elementTarget(name: Token, ty: Ty, indexes: Typed[], span: Span): AssignTarget {
    const [row, column] = indexes;
    if (row === undefined) return this.c.failSilently();
    return {
      kind: "element",
      array: this.ref(name),
      index: row.ir,
      ...(column === undefined ? {} : { index2: column.ir }),
      base: ty.kind === "ARRAY" ? (ty.lows[0] ?? 1) : 1,
      growOnWrite: false, // CIE-20
      text: name.text,
      span,
    };
  }

  /** `A[i] <- value` and `A[i, j] <- value` (CIE-20 to CIE-22). */
  private elementAssign(first: Token, v: Variable | undefined): Ir[] {
    const c = this.c;
    const ty = v?.ty ?? UNKNOWN;
    const { indexes } = this.x.subscripts(first, ty);
    c.expectSymbol("←", "←", "Use <- to store a value: Name[1] <- value.");
    const value = this.x.expr();
    if (v === undefined) {
      this.x.undeclared(first);
      return c.failSilently();
    }
    if (v.constant) {
      c.report("E-CHK-CONSTANT-ASSIGN", first.span, { name: first.text });
      return c.failSilently();
    }
    if (ty.kind === "STRING") {
      c.report("E-CHK-STRING-ELEMENT", first.span);
      return c.failSilently();
    }
    const item = ty.kind === "ARRAY" ? ty.of : UNKNOWN;
    this.checkFits(first.text, item, value);
    c.endStatement();
    const target = this.elementTarget(first, ty, indexes, c.spanFrom(first));
    return [
      {
        kind: "assign",
        target,
        value: this.copyOf(item, value) ?? this.valueFor(item, value),
        span: c.spanFrom(first),
      },
    ];
  }

  /** CIE-13, CIE-49: the value must fit the variable's type. */
  checkFits(name: string, into: Ty, value: Typed): void {
    if (fits(value.ty, value.oneChar, into)) return;
    this.c.report("E-CHK-TYPE-CHANGE", value.span, { name, expected: typeName(into), actual: withArticle(value.ty) });
  }

  /** A one-character STRING literal going into a CHAR becomes a CHAR value (CIE-49). */
  valueFor(into: Ty, value: Typed): IrExpr {
    const ir = value.ir;
    if (into.kind === "CHAR" && ir.kind === "literal" && ir.value.kind === "str") {
      return { ...ir, value: { kind: "char", value: ir.value.value } };
    }
    return ir;
  }

  condition(value: Typed): void {
    if (value.ty.kind !== "BOOLEAN" && !isUnknown(value.ty)) {
      this.c.report("E-CHK-CONDITION-TYPE", value.span, { type: withArticle(value.ty), name: this.c.text(value.span) });
    }
  }

  /** TRY ... EXCEPT ... ENDTRY (CIE-100): one handler catches every runtime error. */
  private tryStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "TRY");
    c.endStatement();
    const body = this.block(first, "TRY", ["EXCEPT", "ENDTRY"], "ENDTRY");
    let handler: Ir[] = [];
    if (body.end === "EXCEPT") {
      c.endLine();
      handler = this.block(first, "TRY", ["ENDTRY"], "ENDTRY").stmts;
    }
    c.endStatement();
    return [{ kind: "tryCatch", body: body.stmts, handler, span: c.spanFrom(first) }];
  }

  private ifStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "IF");
    const cond = this.x.expr();
    this.condition(cond);
    this.skipBlankBeforeThen();
    c.expectKeyword("THEN", "Write THEN after the condition.");
    c.endStatement();
    const then = this.block(first, "IF", ["ELSE", "ENDIF"], "ENDIF");
    let otherwise: Ir[] = [];
    if (then.end === "ELSE") {
      c.endLine();
      otherwise = this.block(first, "IF", ["ENDIF"], "ENDIF").stmts;
    }
    c.endStatement();
    return [{ kind: "if", condition: cond.ir, then: then.stmts, else: otherwise, span: c.spanFrom(first) }];
  }

  private skipBlankBeforeThen(): void {
    let k = 0;
    while (this.c.peek(k).kind === "newline") k++;
    if (k > 0 && this.c.isKeyword("THEN", k)) for (let n = 0; n < k; n++) this.c.next();
  }

  private whileStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "WHILE");
    const cond = this.x.expr();
    this.condition(cond);
    const doToken = c.peek();
    if (c.isKeyword("DO")) {
      c.next();
      c.report("W-CIE-WHILE-DO", doToken.span, {}, undefined, [
        { start: doToken.span.start, end: doToken.span.end, replacement: "" },
      ]);
    }
    c.endStatement();
    const body = this.block(first, "WHILE", ["ENDWHILE"], "ENDWHILE");
    c.endStatement();
    return [{ kind: "while", condition: cond.ir, body: body.stmts, span: c.spanFrom(first) }];
  }

  private repeatStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "REPEAT");
    c.endStatement();
    const body = this.block(first, "REPEAT", ["UNTIL"], "UNTIL");
    if (body.end === null) return [];
    const cond = this.x.expr();
    this.condition(cond);
    c.endStatement();
    return [{ kind: "repeatUntil", body: body.stmts, condition: cond.ir, span: c.spanFrom(first) }];
  }

  private forStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "FOR");
    const name = c.peek();
    if (name.kind !== "word") return c.fail("a variable", "Write the counter, e.g. FOR i <- 1 TO 10.");
    c.next();
    const v = this.x.lookupVar(name);
    if (v === undefined) this.x.undeclared(name);
    c.expectSymbol("←", "<-", "Write FOR Counter <- Start TO End.");
    const start = this.x.expr();
    c.expectKeyword("TO", "Write TO between the start and the end.");
    const end = this.x.expr();
    let step: Typed | null = null;
    if (c.takeKeyword("STEP") !== null) step = this.x.expr();
    c.endStatement();
    const body = this.block(first, "FOR", ["NEXT"], "NEXT");
    if (body.end === "NEXT" && c.peek().kind === "word") c.next(); // NEXT i: the counter name is optional
    c.endStatement();
    return [
      {
        kind: "forInclusive",
        variable: {
          kind: "var",
          name: v?.name ?? name.text,
          scope: this.env.isLocal(name.text) ? "local" : "global",
          span: name.span,
        },
        start: start.ir,
        end: end.ir,
        step: step === null ? null : step.ir,
        body: body.stmts,
        span: c.spanFrom(first),
      },
    ];
  }

  private caseStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "CASE");
    c.expectKeyword("OF", "Write CASE OF followed by the value to test.");
    const subject = this.x.expr();
    c.endStatement();
    const arms: { test: IrExpr | null; body: Ir[]; span: Span }[] = [];
    for (;;) {
      this.skipBlank();
      const t = c.peek();
      if (t.kind === "eof") {
        const at = c.source.length;
        c.report(
          "E-SYN-BLOCK-NOT-CLOSED",
          first.span,
          { block: "CASE", line: first.span.line, closer: "ENDCASE" },
          undefined,
          [{ start: at, end: at, replacement: "\nENDCASE\n" }],
        );
        break;
      }
      if (c.isKeyword("ENDCASE")) {
        c.warnCase(c.next(), "ENDCASE");
        c.endStatement();
        break;
      }
      try {
        const arm = this.caseArm(subject);
        arms.push(arm);
      } catch (e) {
        if (!(e instanceof Abandon)) throw e;
        c.skipLine();
        c.endLine();
      }
    }
    // Desugar: the arms become an if-chain; OTHERWISE is the final else.
    let chain: Ir[] = [];
    for (const arm of [...arms].reverse()) {
      chain =
        arm.test === null
          ? arm.body
          : [{ kind: "if", condition: arm.test, then: arm.body, else: chain, span: arm.span }];
    }
    return chain;
  }

  private caseArm(subject: Typed): { test: IrExpr | null; body: Ir[]; span: Span } {
    const c = this.c;
    const first = c.peek();
    if (c.isKeyword("OTHERWISE")) {
      c.warnCase(c.next(), "OTHERWISE");
      if (c.isSymbol(":")) c.next();
      return { test: null, body: this.arm(), span: first.span };
    }
    let test: IrExpr | null = null;
    for (;;) {
      const label = this.x.expr();
      if (!(fits(label.ty, label.oneChar, subject.ty) || fits(subject.ty, true, label.ty))) {
        c.report("E-CHK-COMPARE-TYPES", label.span, { left: withArticle(subject.ty), right: withArticle(label.ty) });
      }
      const eq: IrExpr = { kind: "binary", op: "eq", symbol: "=", left: subject.ir, right: label.ir, span: label.span };
      test = test === null ? eq : { kind: "logical", op: "orElse", left: test, right: eq, span: label.span };
      if (!c.isSymbol(",")) break;
      c.next();
    }
    c.expectSymbol(":", ":", "Write a colon after the value, then the statement to run.");
    return { test, body: this.arm(), span: joinSpans(first.span, c.last.span) };
  }

  /** The statement after `value :` (on the same line) or the lines that follow it up to the next arm. */
  private arm(): Ir[] {
    if (this.c.atLineEnd()) return [];
    return this.statement();
  }

  private call(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "CALL");
    const name = c.peek();
    if (name.kind !== "word") return c.fail("a procedure name", "Write CALL followed by the procedure's name.");
    c.next();
    let args: Typed[] = [];
    if (c.isSymbol("(")) {
      c.next();
      args = this.x.args();
      c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
    }
    c.endStatement();
    const sig = this.env.subs.get(name.text);
    if (sig === undefined) {
      this.x.undeclared(name);
      return [];
    }
    if (sig.kind === "function") {
      c.report("E-CHK-FUNCTION-CALL", name.span, { name: name.text });
      return [];
    }
    this.x.checkArgs(sig.name, sig.params, args, name);
    // CIE-76: a BYREF argument must be a place (variable, array item, record field) to write the result back to.
    const outs: (AssignTarget | null)[] = args.map((a, k) => {
      if (sig.params[k]?.byRef !== true) return null;
      const place = placeOf(a.ir);
      if (place === null && !isUnknown(a.ty)) c.report("E-CHK-BYREF-ARG", a.span);
      return place;
    });
    return [
      {
        kind: "callStatement",
        callee: name.text,
        args: this.x.argIrs(sig.params, args),
        ...(outs.some((o) => o !== null) ? { outs } : {}),
        span: c.spanFrom(first),
      },
    ];
  }

  private returnStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "RETURN");
    if (this.env.current === null) {
      c.report("E-CHK-RETURN-OUTSIDE", first.span);
      return c.failSilently();
    }
    const value = c.atLineEnd() ? null : this.x.expr();
    c.endStatement();
    return [{ kind: "return", value: value === null ? null : value.ir, span: c.spanFrom(first) }];
  }
}

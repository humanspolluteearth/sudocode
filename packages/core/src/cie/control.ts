// CIE control flow: TRY, IF, WHILE, REPEAT, FOR and CASE. Split out of statements.ts; each function takes the
// Statements host, the same shape as files.ts.

import type { Stmt as Ir, Expr as IrExpr } from "../ir/ir.ts";
import type { Span } from "../diagnostics.ts";
import type { Token } from "../edexcel/tokens.ts";
import { Abandon, joinSpans } from "./cursor.ts";
import type { Typed } from "./expressions.ts";
import { fits, withArticle } from "./types.ts";
import type { Statements } from "./statements.ts";

/** TRY ... EXCEPT ... ENDTRY (CIE-100): one handler catches every runtime error. */
export function tryStatement(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "TRY");
  c.endStatement();
  const body = s.block(first, "TRY", ["EXCEPT", "ENDTRY"], "ENDTRY");
  let handler: Ir[] = [];
  if (body.end === "EXCEPT") {
    c.endLine();
    handler = s.block(first, "TRY", ["ENDTRY"], "ENDTRY").stmts;
  }
  c.endStatement();
  return [{ kind: "tryCatch", body: body.stmts, handler, span: c.spanFrom(first) }];
}

export function ifStatement(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "IF");
  const cond = s.x.expr();
  s.condition(cond);
  skipBlankBeforeThen(s);
  c.expectKeyword("THEN", "Write THEN after the condition.");
  c.endStatement();
  const then = s.block(first, "IF", ["ELSE", "ENDIF"], "ENDIF");
  let otherwise: Ir[] = [];
  if (then.end === "ELSE") {
    const elseToken = c.last;
    if (c.isKeyword("IF")) {
      // CIE-51 (Q47): ELSE IF continues the chain, so the inner IF closes with the one shared ENDIF.
      // Lowering: the inner IF becomes the single statement of the outer else branch.
      c.report("W-CIE-ELSE-IF", elseToken.span);
      const inner = ifStatement(s, c.peek());
      return [{ kind: "if", condition: cond.ir, then: then.stmts, else: inner, span: c.spanFrom(first) }];
    }
    c.endLine();
    otherwise = s.block(first, "IF", ["ENDIF"], "ENDIF").stmts;
  }
  c.endStatement();
  return [{ kind: "if", condition: cond.ir, then: then.stmts, else: otherwise, span: c.spanFrom(first) }];
}

function skipBlankBeforeThen(s: Statements): void {
  let k = 0;
  while (s.c.peek(k).kind === "newline") k++;
  if (k > 0 && s.c.isKeyword("THEN", k)) for (let n = 0; n < k; n++) s.c.next();
}

export function whileStatement(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "WHILE");
  const cond = s.x.expr();
  s.condition(cond);
  const doToken = c.peek();
  if (c.isKeyword("DO")) {
    c.next();
    c.report("W-CIE-WHILE-DO", doToken.span, {}, undefined, [
      { start: doToken.span.start, end: doToken.span.end, replacement: "" },
    ]);
  }
  c.endStatement();
  const body = s.block(first, "WHILE", ["ENDWHILE"], "ENDWHILE");
  c.endStatement();
  return [{ kind: "while", condition: cond.ir, body: body.stmts, span: c.spanFrom(first) }];
}

export function repeatStatement(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "REPEAT");
  c.endStatement();
  const body = s.block(first, "REPEAT", ["UNTIL"], "UNTIL");
  if (body.end === null) return [];
  const cond = s.x.expr();
  s.condition(cond);
  c.endStatement();
  return [{ kind: "repeatUntil", body: body.stmts, condition: cond.ir, span: c.spanFrom(first) }];
}

export function forStatement(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "FOR");
  const name = c.peek();
  if (name.kind !== "word") return c.fail("a variable", "Write the counter, e.g. FOR i <- 1 TO 10.");
  c.next();
  const v = s.x.lookupVar(name);
  if (v === undefined) s.x.undeclared(name);
  c.expectSymbol("←", "<-", "Write FOR Counter <- Start TO End.");
  const start = s.x.expr();
  c.expectKeyword("TO", "Write TO between the start and the end.");
  const end = s.x.expr();
  let step: Typed | null = null;
  if (c.takeKeyword("STEP") !== null) step = s.x.expr();
  c.endStatement();
  const body = s.block(first, "FOR", ["NEXT"], "NEXT");
  if (body.end === "NEXT" && c.peek().kind === "word") c.next(); // NEXT i: the counter name is optional
  c.endStatement();
  return [
    {
      kind: "forInclusive",
      variable: {
        kind: "var",
        name: v?.name ?? name.text,
        scope: s.env.isLocal(name.text) ? "local" : "global",
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

export function caseStatement(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "CASE");
  c.expectKeyword("OF", "Write CASE OF followed by the value to test.");
  const subject = s.x.expr();
  c.endStatement();
  const arms: { test: IrExpr | null; body: Ir[]; span: Span }[] = [];
  for (;;) {
    s.skipBlank();
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
      const arm = caseArm(s, subject);
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
      arm.test === null ? arm.body : [{ kind: "if", condition: arm.test, then: arm.body, else: chain, span: arm.span }];
  }
  return chain;
}

function caseArm(s: Statements, subject: Typed): { test: IrExpr | null; body: Ir[]; span: Span } {
  const c = s.c;
  const first = c.peek();
  if (c.isKeyword("OTHERWISE")) {
    c.warnCase(c.next(), "OTHERWISE");
    if (c.isSymbol(":")) c.next();
    return { test: null, body: arm(s), span: first.span };
  }
  let test: IrExpr | null = null;
  for (;;) {
    const label = s.x.expr();
    if (!(fits(label.ty, label.oneChar, subject.ty) || fits(subject.ty, true, label.ty))) {
      c.report("E-CHK-COMPARE-TYPES", label.span, { left: withArticle(subject.ty), right: withArticle(label.ty) });
    }
    let eq: IrExpr = { kind: "binary", op: "eq", symbol: "=", left: subject.ir, right: label.ir, span: label.span };
    if (c.isKeyword("TO")) {
      // CIE-52: `a TO b :` matches a <= subject <= b (both ends included).
      c.next();
      const high = s.x.expr();
      if (!(fits(high.ty, high.oneChar, subject.ty) || fits(subject.ty, true, high.ty))) {
        c.report("E-CHK-COMPARE-TYPES", high.span, { left: withArticle(subject.ty), right: withArticle(high.ty) });
      }
      const lo: IrExpr = {
        kind: "binary",
        op: "ge",
        symbol: ">=",
        left: subject.ir,
        right: label.ir,
        span: label.span,
      };
      const hi: IrExpr = {
        kind: "binary",
        op: "le",
        symbol: "<=",
        left: subject.ir,
        right: high.ir,
        span: high.span,
      };
      eq = { kind: "logical", op: "andThen", left: lo, right: hi, span: label.span };
    }
    test = test === null ? eq : { kind: "logical", op: "orElse", left: test, right: eq, span: label.span };
    if (!c.isSymbol(",")) break;
    c.next();
  }
  c.expectSymbol(":", ":", "Write a colon after the value, then the statement to run.");
  return { test, body: arm(s), span: joinSpans(first.span, c.last.span) };
}

/** The statement after `value :` (on the same line) or the lines that follow it up to the next arm. */
function arm(s: Statements): Ir[] {
  if (s.c.atLineEnd()) return [];
  return s.statement();
}

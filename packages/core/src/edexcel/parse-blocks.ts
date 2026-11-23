// Block statements: IF, WHILE, REPEAT, FOR and FOR EACH. Split out of parser.ts (no behaviour change); the
// compiler concept is the same recursive descent: each block parses its body by calling back into the parser.
import type { Stmt } from "./ast.ts";
import { makeBlock, takeCloser, type Block } from "./closers.ts";
import { Cursor } from "./cursor.ts";
import { parseExpression } from "./parse-expression.ts";
import type { ParserContext } from "./parser-context.ts";
import type { Token } from "./tokens.ts";

/** `chainHead` is set for the IF of an ELSE IF chain: its parts report "never closed" as the head IF. */
export function ifStatement(p: ParserContext, first: Token, chainHead: Block | null): Stmt {
  p.c.next();
  p.c.warnCase(first, "IF");
  const condition = p.header(() => {
    const e = parseExpression(p.c);
    p.c.expectKeyword("THEN", "Write IF <condition> THEN.");
    return e;
  }, p.placeholder(first));
  const span = { ...first.span, end: p.c.last.span.start };
  const own = makeBlock("IF", first, ["ELSE", "END IF"]);
  const head = chainHead ?? own;
  const then = p.body(own, head);
  let otherwise: Stmt[] = [];
  if (then.end !== "eof" && then.end !== "outer" && then.end.closer === "ELSE") {
    const elseWord = p.c.next();
    p.c.warnCase(elseWord, "ELSE");
    const after = p.c.peek();
    if (Cursor.isWord(after, "IF") && after.span.line === elseWord.span.line) {
      // EDX-42: an ELSE IF chain, closed by one END IF, with a warning that the official form nests.
      p.c.report("W-EDX-ELSE-IF", elseWord.span);
      otherwise = [ifStatement(p, after, head)];
    } else {
      p.c.endStatement();
      const elsePart = makeBlock("IF", first, ["END IF"]);
      const rest = p.body(elsePart, { ...head, closers: ["END IF"], main: "END IF" });
      otherwise = rest.stmts;
      p.close(rest.end);
    }
  } else {
    p.close(then.end);
  }
  return { kind: "if", condition, then: then.stmts, else: otherwise, span };
}

export function whileStatement(p: ParserContext): Stmt {
  const first = p.c.next();
  p.c.warnCase(first, "WHILE");
  const condition = p.header(() => {
    const e = parseExpression(p.c);
    p.c.expectKeyword("DO", "Write WHILE <condition> DO.");
    return e;
  }, p.placeholder(first));
  const span = { ...first.span, end: p.c.last.span.start };
  const result = p.body(makeBlock("WHILE", first, ["END WHILE"]));
  p.close(result.end);
  return { kind: "while", condition, body: result.stmts, span };
}

export function repeat(p: ParserContext): Stmt {
  const first = p.c.next();
  p.c.warnCase(first, "REPEAT");
  if (p.c.atLineEnd()) {
    p.c.endLine();
    const span = first.span;
    const result = p.body(makeBlock("REPEAT", first, ["UNTIL"]));
    let condition = p.placeholder(first);
    if (result.end !== "eof" && result.end !== "outer") {
      const until = p.c.peek();
      takeCloser(p.c, result.end);
      condition = p.header(() => parseExpression(p.c), p.placeholder(until));
    }
    return { kind: "repeatUntil", body: result.stmts, condition, span };
  }
  const count = p.header(() => {
    const e = parseExpression(p.c);
    p.c.expectKeyword("TIMES", "Write REPEAT <number> TIMES.");
    return e;
  }, p.placeholder(first));
  const span = { ...first.span, end: p.c.last.span.start };
  const result = p.body(makeBlock("REPEAT", first, ["END REPEAT"]));
  p.close(result.end);
  return { kind: "repeatTimes", count, body: result.stmts, span };
}

export function forStatement(p: ParserContext): Stmt {
  const first = p.c.next();
  p.c.warnCase(first, "FOR");
  if (p.c.isKeyword("EACH")) {
    p.c.warnCase(p.c.next(), "EACH");
    return forEachRest(p, first);
  }
  const advice = "Write FOR <name> FROM <start> TO <end> DO.";
  const parts = p.header(() => {
    const n = p.name(advice);
    p.c.expectKeyword("FROM", advice);
    const start = parseExpression(p.c);
    p.c.expectKeyword("TO", advice);
    const end = parseExpression(p.c);
    const step = p.c.takeKeyword("STEP") === null ? null : parseExpression(p.c);
    p.c.expectKeyword("DO", advice);
    return { n, start, end, step };
  }, null);
  const span = { ...first.span, end: p.c.last.span.start };
  const result = p.body(makeBlock("FOR", first, ["END FOR"]));
  p.close(result.end);
  const pt = parts ?? { n: first, start: p.placeholder(first), end: p.placeholder(first), step: null };
  return {
    kind: "for",
    name: pt.n.text,
    nameSpan: pt.n.span,
    start: pt.start,
    end: pt.end,
    step: pt.step,
    body: result.stmts,
    span,
  };
}

export function forEach(p: ParserContext): Stmt {
  const first = p.c.next();
  // EDX-58: FOREACH works, with its own warning (which also fixes the case, D7).
  const edits = [{ start: first.span.start, end: first.span.end, replacement: "FOR EACH" }];
  p.c.report("W-EDX-FOREACH", first.span, { word: first.text, official: "FOR EACH" }, undefined, edits);
  return forEachRest(p, first);
}

export function forEachRest(p: ParserContext, first: Token): Stmt {
  const advice = "Write FOR EACH <name> FROM <array> DO.";
  const parts = p.header(() => {
    const n = p.name(advice);
    p.c.expectKeyword("FROM", advice);
    const iterable = parseExpression(p.c);
    p.c.expectKeyword("DO", advice);
    return { n, iterable };
  }, null);
  const span = { ...first.span, end: p.c.last.span.start };
  const result = p.body(makeBlock("FOR EACH", first, ["END FOREACH"]));
  p.close(result.end);
  const pt = parts ?? { n: first, iterable: p.placeholder(first) };
  return { kind: "forEach", name: pt.n.text, nameSpan: pt.n.span, iterable: pt.iterable, body: result.stmts, span };
}

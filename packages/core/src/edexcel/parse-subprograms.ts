// Subprograms, RETURN, procedure calls and CONST. Split out of parser.ts (no behaviour change).
import { TYPES, type Expr, type Stmt } from "./ast.ts";
import { makeBlock } from "./closers.ts";
import { Abandon, Cursor } from "./cursor.ts";
import { parseExpression } from "./parse-expression.ts";
import type { ParserContext } from "./parser-context.ts";
import type { Token } from "./tokens.ts";

/**
 * PROCEDURE name(params) / BEGIN PROCEDURE / ... / END PROCEDURE, and the same for FUNCTION (EDX-60, EDX-61).
 * Compiler concept: a *subprogram definition* is a declaration; the checker gives its body its own scope.
 */
export function subprogram(p: ParserContext): Stmt {
  const first = p.c.next();
  const sub = first.text.toUpperCase() === "PROCEDURE" ? "procedure" : "function";
  const word = sub.toUpperCase();
  p.c.warnCase(first, word);
  if (p.openCount > 0) {
    p.c.report("E-SYN-NOT-SUPPORTED", first.span, {
      feature: `A ${sub} written inside another block`,
      advice: `Write the ${sub} on its own, outside every IF, loop and other subprogram.`,
    });
    throw new Abandon();
  }
  const advice = `Write ${word} <name>(<parameters>).`;
  const head = p.header(() => {
    const n = p.name(advice);
    const params: { name: string; span: Token["span"] }[] = [];
    if (!p.c.isSymbol("(")) {
      // EDX-66: the brackets are required, even with no parameters.
      p.c.report("E-CHK-MISSING-PARENS", n.span, { name: n.text }, undefined, [
        { start: n.span.end, end: n.span.end, replacement: "()" },
      ]);
    } else {
      p.c.next();
      if (!p.c.isSymbol(")")) {
        for (;;) {
          const param = p.name(advice);
          params.push({ name: param.text, span: param.span });
          if (!p.c.isSymbol(",")) break;
          p.c.next();
        }
      }
      p.c.expectSymbol(")", ") or ,", "Separate the parameters with commas and close them with ).");
    }
    return { n, params };
  }, null);
  // BEGIN PROCEDURE / BEGIN FUNCTION is the next line.
  p.skipBlankLines();
  const begin = p.c.peek();
  if (Cursor.isWord(begin, "BEGIN")) {
    p.c.next();
    p.c.warnCase(begin, "BEGIN");
    const kind = p.c.peek();
    if (Cursor.isWord(kind, word)) {
      p.c.next();
      p.c.warnCase(kind, word);
    } else {
      p.c.fail(word, `Write BEGIN ${word}.`);
    }
    p.c.endStatement();
  } else {
    p.c.report("E-SYN-EXPECTED", begin.span, {
      expected: `BEGIN ${word}`,
      found: begin.kind === "eof" ? "the end of the program" : begin.text,
      advice: `Write BEGIN ${word} on the line after the ${sub}'s name.`,
    });
  }
  const span = { ...first.span, end: p.c.last.span.end };
  const result = p.body(makeBlock(word, first, [`END ${word}` as "END PROCEDURE" | "END FUNCTION"]));
  p.close(result.end);
  const h = head ?? { n: first, params: [] };
  return { kind: "subprogram", sub, name: h.n.text, nameSpan: h.n.span, params: h.params, body: result.stmts, span };
}

export function returnStatement(p: ParserContext): Stmt {
  const first = p.c.next();
  p.c.warnCase(first, "RETURN");
  const value = p.c.atLineEnd() ? null : parseExpression(p.c);
  const span = p.c.spanFrom(first);
  p.c.endStatement();
  return { kind: "return", value, span };
}

/** `name(args)` on its own line: a call to a procedure (EDX-64). */
export function callStatement(p: ParserContext): Stmt {
  const n = p.c.next();
  p.c.next(); // (
  const args: Expr[] = [];
  if (!p.c.isSymbol(")")) {
    for (;;) {
      args.push(parseExpression(p.c));
      if (!p.c.isSymbol(",")) break;
      p.c.next();
    }
  }
  p.c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
  const span = p.c.spanFrom(n);
  p.c.endStatement();
  return { kind: "callStatement", name: n.text, nameSpan: n.span, args, span };
}

export function constant(p: ParserContext): Stmt {
  const first = p.c.next();
  p.c.warnCase(first, "CONST");
  const advice = "Write CONST <type> <name>, e.g. CONST INTEGER Max.";
  const typeToken = p.c.peek();
  const type = TYPES.find((name) => Cursor.isWord(typeToken, name));
  if (type === undefined) return p.c.fail("a type (INTEGER, REAL, BOOLEAN, CHARACTER or STRING)", advice);
  p.c.next();
  p.c.warnCase(typeToken, type);
  const n = p.name(advice);
  const span = p.c.spanFrom(first);
  p.c.endStatement();
  return { kind: "const", type, name: n.text, nameSpan: n.span, span };
}

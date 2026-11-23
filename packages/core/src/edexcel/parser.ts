// The Edexcel parser: tokens -> surface AST.
//
// Compiler concept: *recursive descent*. There is one function per kind of statement (parseIf, parseWhile, ...),
// and a block calls back into the statement parser for its body, so the call structure mirrors the nesting of the
// program. Expressions are handed to the Pratt parser (parse-expression.ts). Mistakes are reported and skipped
// (panic mode, cursor.ts), and blocks know their closers, so a wrong or missing END is reported once and the
// structure around it still makes sense (decision D8).
import type { Diagnostic } from "../diagnostics.ts";
import { TYPES, type Expr, type Program, type Stmt, type Target } from "./ast.ts";
import { closerAhead, makeBlock, takeCloser, unmatched, type Block, type FoundCloser } from "./closers.ts";
import { Abandon, Cursor, RESERVED } from "./cursor.ts";
import { otherStatement } from "./other-statements.ts";
import { parseReceive } from "./receive.ts";
import { lex } from "./lexer.ts";
import { parseExpression } from "./parse-expression.ts";
import type { Token } from "./tokens.ts";

export interface ParseResult {
  program: Program;
  /** Lexer and parser diagnostics, in the order found. */
  diagnostics: Diagnostic[];
}

export function parse(source: string): ParseResult {
  const { tokens, diagnostics } = lex(source);
  const parser = new Parser(new Cursor(tokens, source));
  const body = parser.program();
  return { program: { body }, diagnostics: [...diagnostics, ...parser.c.diagnostics] };
}

/** Words that start a statement, so `SEND [1, 2][0] TO ...` is a SEND, not a bare `name[i] = ...`. */
const STATEMENT_WORDS = new Set([
  "SET",
  "SEND",
  "RECEIVE",
  "IF",
  "WHILE",
  "REPEAT",
  "FOR",
  "FOREACH",
  "CONST",
  "PROCEDURE",
  "FUNCTION",
  "RETURN",
  "BEGIN",
]);

class Parser {
  readonly c: Cursor;
  private readonly open: Block[] = [];
  /** Closers already reported as wrong, so a closer that ends several blocks is reported once. */
  private readonly reported = new Set<Token>();

  constructor(c: Cursor) {
    this.c = c;
  }

  program(): Stmt[] {
    const body: Stmt[] = [];
    for (;;) {
      this.skipBlankLines();
      if (this.c.peek().kind === "eof") return body;
      const found = closerAhead(this.c);
      if (found !== null) {
        unmatched(this.c, found);
        continue;
      }
      this.statement(body);
    }
  }

  private skipBlankLines(): void {
    while (this.c.peek().kind === "newline") this.c.next();
  }

  // ---------- blocks and closers

  /**
   * Parses statements until one of `block.closers` (returned, not consumed), the end of the program, or a closer
   * that belongs to an enclosing block ("outer": that block will take it).
   */
  private body(block: Block, reportUnclosed: Block = block): { stmts: Stmt[]; end: FoundCloser | "eof" | "outer" } {
    const stmts: Stmt[] = [];
    this.open.push(block);
    try {
      for (;;) {
        this.skipBlankLines();
        if (this.c.peek().kind === "eof") {
          const r = reportUnclosed;
          this.c.report(
            "E-SYN-BLOCK-NOT-CLOSED",
            r.opener.span,
            { block: r.name, line: r.line, closer: r.main },
            undefined,
            [{ start: this.c.source.length, end: this.c.source.length, replacement: `\n${r.main}\n` }],
          );
          return { stmts, end: "eof" };
        }
        const found = closerAhead(this.c);
        if (found === null) {
          this.statement(stmts);
          continue;
        }
        if (block.closers.includes(found.closer)) return { stmts, end: found };
        const outer = this.open.slice(0, -1).some((b) => b.closers.includes(found.closer));
        if (outer) {
          // e.g. END WHILE while an IF inside the WHILE is still open: one error, and it closes both (D8).
          if (!this.reported.has(found.token)) {
            this.reported.add(found.token);
            this.wrongCloser(found, reportUnclosed);
          }
          return { stmts, end: "outer" };
        }
        // It matches no open block: most likely a misspelt closer for this block, so it closes this one (D8).
        this.wrongCloser(found, reportUnclosed, "replace");
        return { stmts, end: { closer: block.main, token: found.token, replaced: true } };
      }
    } finally {
      this.open.pop();
    }
  }

  private wrongCloser(found: FoundCloser, block: Block, variant?: string): void {
    const args = { closer: found.closer, block: block.name, line: block.line, expected: block.main };
    this.c.report("E-SYN-WRONG-CLOSER", found.token.span, args, variant);
  }

  /** Consumes the closer that ended a body (when it is this block's own), then the rest of its line. */
  private close(end: FoundCloser | "eof" | "outer"): void {
    if (end === "eof" || end === "outer") return;
    if (end.replaced === true) {
      this.c.skipLine();
      this.c.endLine();
      return;
    }
    takeCloser(this.c, end);
    this.c.endStatement();
  }

  // ---------- statements

  /** Parses one statement into `out`; on a mistake, reports it once and skips the line. */
  private statement(out: Stmt[]): void {
    const t = this.c.peek();
    try {
      const s = this.dispatch(t);
      if (s !== null) out.push(s);
    } catch (error) {
      if (!(error instanceof Abandon)) throw error;
      this.c.skipLine();
      this.c.endLine();
    }
  }

  private dispatch(t: Token): Stmt | null {
    if (t.kind === "error") return this.c.failSilently();
    if (t.kind !== "word") {
      this.c.report("E-SYN-UNKNOWN-STATEMENT", t.span, { word: t.text }, "not-a-word");
      throw new Abandon();
    }
    const upper = t.text.toUpperCase();
    if (this.c.isSymbol("=", 1) || (this.c.isSymbol("[", 1) && !STATEMENT_WORDS.has(upper))) return this.bareAssign();
    switch (upper) {
      case "SET":
        return this.set();
      case "SEND":
        return this.send();
      case "RECEIVE":
        return parseReceive(this.c, (advice) => this.name(advice));
      case "IF":
        return this.ifStatement(t, null);
      case "WHILE":
        return this.whileStatement();
      case "REPEAT":
        return this.repeat();
      case "FOR":
        return this.forStatement();
      case "FOREACH":
        return this.forEach();
      case "CONST":
        return this.constant();
      case "PROCEDURE":
      case "FUNCTION":
        return this.subprogram();
      case "RETURN":
        return this.returnStatement();
      default:
        if (this.c.isSymbol("(", 1) && !RESERVED.has(t.text)) return this.callStatement();
        otherStatement(this.c, t, upper);
        return null;
    }
  }

  private name(advice: string): Token {
    const t = this.c.peek();
    if (t.kind === "error") return this.c.failSilently();
    if (t.kind !== "word") return this.c.fail("a name", advice);
    const upper = t.text.toUpperCase();
    if (RESERVED.has(t.text) || upper === "TRUE" || upper === "FALSE") {
      this.c.report("E-SYN-KEYWORD-AS-NAME", t.span, {
        word: t.text,
        suggestion: `my${t.text.charAt(0)}${t.text.slice(1).toLowerCase()}`,
      });
      throw new Abandon();
    }
    return this.c.next();
  }

  private target(advice: string): Target {
    const n = this.name(advice);
    if (!this.c.isSymbol("[")) return { kind: "name", name: n.text, span: n.span };
    this.c.next();
    const index = parseExpression(this.c);
    let index2: Expr | null = null;
    if (this.c.isSymbol(",")) {
      // EDX-24: Grid[row, col]
      this.c.next();
      index2 = parseExpression(this.c);
    }
    const close = this.c.expectSymbol("]", "]", "Close the index with ].");
    const span = { ...n.span, end: close.span.end };
    if (index2 === null && this.c.isSymbol("[")) {
      // Grid[row][col] on the left: the official form is Grid[row, col], so warn, and take it as that (EDX-24).
      this.c.next();
      index2 = parseExpression(this.c);
      const close2 = this.c.expectSymbol("]", "]", "Close the index with ].");
      const official = `${n.text}[${this.c.text(index.span)}, ${this.c.text(index2.span)}]`;
      this.c.report("W-EDX-GRID-BRACKETS", n.span, { official });
      span.end = close2.span.end;
    }
    return { kind: "element", name: n.text, nameSpan: n.span, index, index2, span };
  }

  private set(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "SET");
    const advice = "Write SET <name> TO <value>.";
    const target = this.target(advice);
    this.c.expectKeyword("TO", advice);
    const value = parseExpression(this.c);
    const span = this.c.spanFrom(first);
    this.c.endStatement();
    return { kind: "set", target, value, span };
  }

  private bareAssign(): Stmt {
    const first = this.c.peek();
    const target = this.target("Write SET <name> TO <value>.");
    this.c.expectSymbol("=", "=", "Write SET <name> TO <value>.");
    const value = parseExpression(this.c);
    const span = this.c.spanFrom(first);
    this.c.endStatement();
    return { kind: "bareAssign", target, value, span };
  }

  private send(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "SEND");
    const advice = "Write SEND <value> TO DISPLAY.";
    const values = [parseExpression(this.c)];
    let comma = null;
    while (this.c.isSymbol(",")) {
      const t = this.c.next();
      comma ??= t.span; // EDX-71 points at the first comma
      values.push(parseExpression(this.c));
    }
    this.c.expectKeyword("TO", advice);
    const device = this.c.peek();
    if (device.kind !== "word") return this.c.fail("a device such as DISPLAY", advice);
    this.c.next();
    const upper = device.text.toUpperCase();
    const standard = upper === "DISPLAY" || upper === "KEYBOARD"; // in any case, with the warning (Q7, EDX-10)
    if (standard) this.c.warnCase(device, upper);
    const span = this.c.spanFrom(first);
    this.c.endStatement();
    return { kind: "send", values, comma, device: standard ? upper : device.text, deviceSpan: device.span, span };
  }

  /** The rest of a block's first line; on a mistake the block still counts as open (D8). */
  private header<T>(parse: () => T, fallback: T): T {
    try {
      const result = parse();
      this.c.endStatement();
      return result;
    } catch (error) {
      if (!(error instanceof Abandon)) throw error;
      this.c.skipLine();
      this.c.endLine();
      return fallback;
    }
  }

  private placeholder(t: Token): Expr {
    return { kind: "bool", value: true, span: t.span };
  }

  /** `chainHead` is set for the IF of an ELSE IF chain: its parts report "never closed" as the head IF. */
  private ifStatement(first: Token, chainHead: Block | null): Stmt {
    this.c.next();
    this.c.warnCase(first, "IF");
    const condition = this.header(() => {
      const e = parseExpression(this.c);
      this.c.expectKeyword("THEN", "Write IF <condition> THEN.");
      return e;
    }, this.placeholder(first));
    const span = { ...first.span, end: this.c.last.span.start };
    const own = makeBlock("IF", first, ["ELSE", "END IF"]);
    const head = chainHead ?? own;
    const then = this.body(own, head);
    let otherwise: Stmt[] = [];
    if (then.end !== "eof" && then.end !== "outer" && then.end.closer === "ELSE") {
      const elseWord = this.c.next();
      this.c.warnCase(elseWord, "ELSE");
      const after = this.c.peek();
      if (Cursor.isWord(after, "IF") && after.span.line === elseWord.span.line) {
        // EDX-42: an ELSE IF chain, closed by one END IF, with a warning that the official form nests.
        this.c.report("W-EDX-ELSE-IF", elseWord.span);
        otherwise = [this.ifStatement(after, head)];
      } else {
        this.c.endStatement();
        const elsePart = makeBlock("IF", first, ["END IF"]);
        const rest = this.body(elsePart, { ...head, closers: ["END IF"], main: "END IF" });
        otherwise = rest.stmts;
        this.close(rest.end);
      }
    } else {
      this.close(then.end);
    }
    return { kind: "if", condition, then: then.stmts, else: otherwise, span };
  }

  private whileStatement(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "WHILE");
    const condition = this.header(() => {
      const e = parseExpression(this.c);
      this.c.expectKeyword("DO", "Write WHILE <condition> DO.");
      return e;
    }, this.placeholder(first));
    const span = { ...first.span, end: this.c.last.span.start };
    const result = this.body(makeBlock("WHILE", first, ["END WHILE"]));
    this.close(result.end);
    return { kind: "while", condition, body: result.stmts, span };
  }

  private repeat(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "REPEAT");
    if (this.c.atLineEnd()) {
      this.c.endLine();
      const span = first.span;
      const result = this.body(makeBlock("REPEAT", first, ["UNTIL"]));
      let condition = this.placeholder(first);
      if (result.end !== "eof" && result.end !== "outer") {
        const until = this.c.peek();
        takeCloser(this.c, result.end);
        condition = this.header(() => parseExpression(this.c), this.placeholder(until));
      }
      return { kind: "repeatUntil", body: result.stmts, condition, span };
    }
    const count = this.header(() => {
      const e = parseExpression(this.c);
      this.c.expectKeyword("TIMES", "Write REPEAT <number> TIMES.");
      return e;
    }, this.placeholder(first));
    const span = { ...first.span, end: this.c.last.span.start };
    const result = this.body(makeBlock("REPEAT", first, ["END REPEAT"]));
    this.close(result.end);
    return { kind: "repeatTimes", count, body: result.stmts, span };
  }

  private forStatement(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "FOR");
    if (this.c.isKeyword("EACH")) {
      this.c.warnCase(this.c.next(), "EACH");
      return this.forEachRest(first);
    }
    const advice = "Write FOR <name> FROM <start> TO <end> DO.";
    const parts = this.header(() => {
      const n = this.name(advice);
      this.c.expectKeyword("FROM", advice);
      const start = parseExpression(this.c);
      this.c.expectKeyword("TO", advice);
      const end = parseExpression(this.c);
      const step = this.c.takeKeyword("STEP") === null ? null : parseExpression(this.c);
      this.c.expectKeyword("DO", advice);
      return { n, start, end, step };
    }, null);
    const span = { ...first.span, end: this.c.last.span.start };
    const result = this.body(makeBlock("FOR", first, ["END FOR"]));
    this.close(result.end);
    const p = parts ?? { n: first, start: this.placeholder(first), end: this.placeholder(first), step: null };
    return {
      kind: "for",
      name: p.n.text,
      nameSpan: p.n.span,
      start: p.start,
      end: p.end,
      step: p.step,
      body: result.stmts,
      span,
    };
  }

  private forEach(): Stmt {
    const first = this.c.next();
    // EDX-58: FOREACH works, with its own warning (which also fixes the case, D7).
    const edits = [{ start: first.span.start, end: first.span.end, replacement: "FOR EACH" }];
    this.c.report("W-EDX-FOREACH", first.span, { word: first.text, official: "FOR EACH" }, undefined, edits);
    return this.forEachRest(first);
  }

  private forEachRest(first: Token): Stmt {
    const advice = "Write FOR EACH <name> FROM <array> DO.";
    const parts = this.header(() => {
      const n = this.name(advice);
      this.c.expectKeyword("FROM", advice);
      const iterable = parseExpression(this.c);
      this.c.expectKeyword("DO", advice);
      return { n, iterable };
    }, null);
    const span = { ...first.span, end: this.c.last.span.start };
    const result = this.body(makeBlock("FOR EACH", first, ["END FOREACH"]));
    this.close(result.end);
    const p = parts ?? { n: first, iterable: this.placeholder(first) };
    return { kind: "forEach", name: p.n.text, nameSpan: p.n.span, iterable: p.iterable, body: result.stmts, span };
  }

  /**
   * PROCEDURE name(params) / BEGIN PROCEDURE / ... / END PROCEDURE, and the same for FUNCTION (EDX-60, EDX-61).
   * Compiler concept: a *subprogram definition* is a declaration; the checker gives its body its own scope.
   */
  private subprogram(): Stmt {
    const first = this.c.next();
    const sub = first.text.toUpperCase() === "PROCEDURE" ? "procedure" : "function";
    const word = sub.toUpperCase();
    this.c.warnCase(first, word);
    if (this.open.length > 0) {
      this.c.report("E-SYN-NOT-SUPPORTED", first.span, {
        feature: `A ${sub} written inside another block`,
        advice: `Write the ${sub} on its own, outside every IF, loop and other subprogram.`,
      });
      throw new Abandon();
    }
    const advice = `Write ${word} <name>(<parameters>).`;
    const head = this.header(() => {
      const n = this.name(advice);
      const params: { name: string; span: Token["span"] }[] = [];
      if (!this.c.isSymbol("(")) {
        // EDX-66: the brackets are required, even with no parameters.
        this.c.report("E-CHK-MISSING-PARENS", n.span, { name: n.text }, undefined, [
          { start: n.span.end, end: n.span.end, replacement: "()" },
        ]);
      } else {
        this.c.next();
        if (!this.c.isSymbol(")")) {
          for (;;) {
            const p = this.name(advice);
            params.push({ name: p.text, span: p.span });
            if (!this.c.isSymbol(",")) break;
            this.c.next();
          }
        }
        this.c.expectSymbol(")", ") or ,", "Separate the parameters with commas and close them with ).");
      }
      return { n, params };
    }, null);
    // BEGIN PROCEDURE / BEGIN FUNCTION is the next line.
    this.skipBlankLines();
    const begin = this.c.peek();
    if (Cursor.isWord(begin, "BEGIN")) {
      this.c.next();
      this.c.warnCase(begin, "BEGIN");
      const kind = this.c.peek();
      if (Cursor.isWord(kind, word)) {
        this.c.next();
        this.c.warnCase(kind, word);
      } else {
        this.c.fail(word, `Write BEGIN ${word}.`);
      }
      this.c.endStatement();
    } else {
      this.c.report("E-SYN-EXPECTED", begin.span, {
        expected: `BEGIN ${word}`,
        found: begin.kind === "eof" ? "the end of the program" : begin.text,
        advice: `Write BEGIN ${word} on the line after the ${sub}'s name.`,
      });
    }
    const span = { ...first.span, end: this.c.last.span.end };
    const result = this.body(makeBlock(word, first, [`END ${word}` as "END PROCEDURE" | "END FUNCTION"]));
    this.close(result.end);
    const h = head ?? { n: first, params: [] };
    return { kind: "subprogram", sub, name: h.n.text, nameSpan: h.n.span, params: h.params, body: result.stmts, span };
  }

  private returnStatement(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "RETURN");
    const value = this.c.atLineEnd() ? null : parseExpression(this.c);
    const span = this.c.spanFrom(first);
    this.c.endStatement();
    return { kind: "return", value, span };
  }

  /** `name(args)` on its own line: a call to a procedure (EDX-64). */
  private callStatement(): Stmt {
    const n = this.c.next();
    this.c.next(); // (
    const args: Expr[] = [];
    if (!this.c.isSymbol(")")) {
      for (;;) {
        args.push(parseExpression(this.c));
        if (!this.c.isSymbol(",")) break;
        this.c.next();
      }
    }
    this.c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
    const span = this.c.spanFrom(n);
    this.c.endStatement();
    return { kind: "callStatement", name: n.text, nameSpan: n.span, args, span };
  }

  private constant(): Stmt {
    const first = this.c.next();
    this.c.warnCase(first, "CONST");
    const advice = "Write CONST <type> <name>, e.g. CONST INTEGER Max.";
    const typeToken = this.c.peek();
    const type = TYPES.find((name) => Cursor.isWord(typeToken, name));
    if (type === undefined) return this.c.fail("a type (INTEGER, REAL, BOOLEAN, CHARACTER or STRING)", advice);
    this.c.next();
    this.c.warnCase(typeToken, type);
    const n = this.name(advice);
    const span = this.c.spanFrom(first);
    this.c.endStatement();
    return { kind: "const", type, name: n.text, nameSpan: n.span, span };
  }
}

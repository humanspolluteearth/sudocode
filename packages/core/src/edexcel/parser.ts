// The Edexcel parser: tokens -> surface AST.
//
// Compiler concept: *recursive descent*. There is one function per kind of statement (parseIf, parseWhile, ...),
// and a block calls back into the statement parser for its body, so the call structure mirrors the nesting of the
// program. Expressions are handed to the Pratt parser (parse-expression.ts). Mistakes are reported and skipped
// (panic mode, cursor.ts), and blocks know their closers, so a wrong or missing END is reported once and the
// structure around it still makes sense (decision D8).
import type { Diagnostic } from "../diagnostics.ts";
import type { Expr, Program, Stmt, Target } from "./ast.ts";
import { closerAhead, takeCloser, unmatched, type Block, type FoundCloser } from "./closers.ts";
import { Abandon, Cursor, RESERVED } from "./cursor.ts";
import { forEach, forStatement, ifStatement, repeat, whileStatement } from "./parse-blocks.ts";
import { callStatement, constant, returnStatement, subprogram } from "./parse-subprograms.ts";
import type { ParserContext } from "./parser-context.ts";
import { otherStatement } from "./other-statements.ts";
import { parseRead, parseWrite } from "./file-statements.ts";
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
  "READ",
  "WRITE",
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

class Parser implements ParserContext {
  readonly c: Cursor;
  private readonly open: Block[] = [];

  get openCount(): number {
    return this.open.length;
  }

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

  skipBlankLines(): void {
    while (this.c.peek().kind === "newline") this.c.next();
  }

  // ---------- blocks and closers

  /**
   * Parses statements until one of `block.closers` (returned, not consumed), the end of the program, or a closer
   * that belongs to an enclosing block ("outer": that block will take it).
   */
  body(block: Block, reportUnclosed: Block = block): { stmts: Stmt[]; end: FoundCloser | "eof" | "outer" } {
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
  close(end: FoundCloser | "eof" | "outer"): void {
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
      case "READ":
        return parseRead(this.c, (advice) => this.name(advice));
      case "WRITE":
        return parseWrite(this.c);
      case "IF":
        return ifStatement(this, t, null);
      case "WHILE":
        return whileStatement(this);
      case "REPEAT":
        return repeat(this);
      case "FOR":
        return forStatement(this);
      case "FOREACH":
        return forEach(this);
      case "CONST":
        return constant(this);
      case "PROCEDURE":
      case "FUNCTION":
        return subprogram(this);
      case "RETURN":
        return returnStatement(this);
      default:
        if (this.c.isSymbol("(", 1) && !RESERVED.has(t.text)) return callStatement(this);
        otherStatement(this.c, t, upper);
        return null;
    }
  }

  name(advice: string): Token {
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
  header<T>(parse: () => T, fallback: T): T {
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

  placeholder(t: Token): Expr {
    return { kind: "bool", value: true, span: t.span };
  }
}

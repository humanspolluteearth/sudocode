// A cursor over the token list, shared by the expression and statement parsers.
//
// Compiler concept: *panic-mode error recovery*. When a statement can't be parsed, the parser reports one error,
// throws `Abandon`, and the statement parser catches it, skips to the end of the line (Edexcel statements are one
// line each, EDX-09) and carries on with the next statement. So one run reports several mistakes, and each once.
import type { Diagnostic, Span, TextEdit } from "../diagnostics.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { Token } from "./tokens.ts";

/** Thrown to give up on the current statement; its error (if any) has already been reported. */
export class Abandon extends Error {
  constructor() {
    super("abandon statement");
    this.name = "Abandon";
  }
}

/** Upper-case words that are never names (a lower-case one may still be a name: decision D2). */
export const RESERVED = new Set([
  ...["SET", "TO", "SEND", "IF", "THEN", "ELSE", "END", "ENDIF", "WHILE", "DO", "REPEAT", "UNTIL", "TIMES"],
  ...["FOR", "FROM", "STEP", "EACH", "FOREACH", "CONST", "AND", "OR", "NOT", "MOD", "DIV", "TRUE", "FALSE"],
  ...["INTEGER", "REAL", "BOOLEAN", "CHARACTER", "STRING", "ARRAY", "DISPLAY", "KEYBOARD"],
  ...["PROCEDURE", "FUNCTION", "BEGIN", "RETURN", "RECEIVE", "READ", "WRITE", "LENGTH", "RANDOM"],
]);

export const joinSpans = (a: Span, b: Span): Span => ({ line: a.line, column: a.column, start: a.start, end: b.end });

export class Cursor {
  readonly tokens: readonly Token[];
  readonly source: string;
  readonly diagnostics: Diagnostic[] = [];
  private position = 0;
  /** The last token consumed (statement spans end there). */
  last: Token;

  constructor(tokens: readonly Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
    const first = tokens[0];
    if (first === undefined) throw new Error("The lexer always ends with an eof token");
    this.last = first;
  }

  peek(ahead = 0): Token {
    const t = this.tokens[Math.min(this.position + ahead, this.tokens.length - 1)];
    if (t === undefined) throw new Error("No tokens");
    return t;
  }

  next(): Token {
    const t = this.peek();
    if (t.kind !== "eof") this.position++;
    this.last = t;
    return t;
  }

  atLineEnd(ahead = 0): boolean {
    const k = this.peek(ahead).kind;
    return k === "newline" || k === "eof";
  }

  /** Is `t` the word `keyword` in any case? */
  static isWord(t: Token, keyword: string): boolean {
    return t.kind === "word" && t.text.toUpperCase() === keyword;
  }

  isKeyword(keyword: string, ahead = 0): boolean {
    return Cursor.isWord(this.peek(ahead), keyword);
  }

  isSymbol(symbol: string, ahead = 0): boolean {
    const t = this.peek(ahead);
    return t.kind === "symbol" && t.text === symbol;
  }

  report(code: string, span: Span, args: MessageArgs = {}, variant?: string, edits?: TextEdit[]): void {
    this.diagnostics.push(
      makeDiagnostic({
        code,
        language: "edexcel",
        span,
        args,
        ...(variant === undefined ? {} : { variant }),
        ...(edits === undefined ? {} : { edits }),
      }),
    );
  }

  /** EDX-05: a keyword written in another case works, with a warning and a fix that writes it in capitals. */
  warnCase(t: Token, official: string): void {
    if (t.text === official) return;
    const edits = [{ start: t.span.start, end: t.span.end, replacement: official }];
    this.report("W-LOWERCASE-KEYWORD", t.span, { word: t.text, official }, undefined, edits);
  }

  /** Consumes `keyword` if it comes next (warning if it isn't in capitals). */
  takeKeyword(keyword: string): Token | null {
    if (!this.isKeyword(keyword)) return null;
    const t = this.next();
    this.warnCase(t, keyword);
    return t;
  }

  expectKeyword(keyword: string, advice: string): Token {
    return this.takeKeyword(keyword) ?? this.fail(keyword, advice);
  }

  expectSymbol(symbol: string, expected: string, advice: string): Token {
    return this.isSymbol(symbol) ? this.next() : this.fail(expected, advice);
  }

  /** How a token is named in "Expected X but found Y". */
  static describe(t: Token): string {
    if (t.kind === "newline") return "the end of the line";
    if (t.kind === "eof") return "the end of the program";
    return t.text;
  }

  /** Reports "Expected `expected` but found ..." at the next token and abandons the statement. */
  fail(expected: string, advice: string): never {
    const t = this.peek();
    if (t.kind !== "error") {
      this.report("E-SYN-EXPECTED", t.span, { expected, found: Cursor.describe(t), advice });
    }
    throw new Abandon();
  }

  /** Abandons the statement without a new error (the lexer already reported this token). */
  failSilently(): never {
    throw new Abandon();
  }

  /** Skips the rest of the line, leaving the newline to `endLine`. */
  skipLine(): void {
    while (!this.atLineEnd()) this.next();
  }

  /** Consumes the newline that ends the line, if any. */
  endLine(): void {
    if (this.peek().kind === "newline") this.next();
  }

  /** The statement must end here (EDX-09: one statement per line). */
  endStatement(): void {
    const t = this.peek();
    if (t.kind === "newline" || t.kind === "eof") {
      this.endLine();
      return;
    }
    if (t.kind !== "error") {
      this.report("E-SYN-EXPECTED", t.span, {
        expected: "the end of the line",
        found: Cursor.describe(t),
        advice: "Put each statement on its own line.",
      });
    }
    this.skipLine();
    this.endLine();
  }

  /** From `first` to the last token consumed. */
  spanFrom(first: Token): Span {
    return joinSpans(first.span, this.last.span);
  }

  text(span: Span): string {
    return this.source.slice(span.start, span.end);
  }
}

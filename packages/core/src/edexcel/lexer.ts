// The Edexcel lexer: source text -> tokens.
//
// Compiler concept: *lexing* (or scanning) reads characters left to right and groups them into tokens, throwing
// away spaces and comments. It is hand-written (DECISIONS): one loop that looks at the next character and decides
// which kind of token starts there. Every token gets a span: line and column count characters as the student sees
// them (code points, so an emoji is one column, SH-01) and `start`/`end` are offsets for the editor.
// The lexer never stops at a mistake: it reports it, emits an `error` token and carries on, so one run can show
// several problems.
import type { Diagnostic, Span, TextEdit } from "../diagnostics.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { Token, TokenKind } from "./tokens.ts";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

/** Straight and curly single quotes count as the same quote (EDX-06); double quotes warn (EDX-07). */
const SINGLE_QUOTES = new Set(["'", "‘", "’"]);
const DOUBLE_QUOTES = new Set(['"', "“", "”"]);
const SYMBOLS = new Set(["+", "-", "*", "/", "^", "&", "=", "<", ">", "(", ")", "[", "]", ",", ":"]);

const isLetter = (c: string): boolean => /^[A-Za-z]$/.test(c);
const isDigit = (c: string): boolean => /^[0-9]$/.test(c);
const isWordChar = (c: string): boolean => /^[A-Za-z0-9_]$/.test(c);

interface Mark {
  line: number;
  column: number;
  offset: number;
}

export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0; // a UTF-8 byte order mark is not part of the program (SH-01)
  let line = 1;
  let column = 1;
  /** Just after the last token on this line: where "the end of the line" is reported. */
  let lineEnd: Mark = { line, column, offset: i };

  const here = (): Mark => ({ line, column, offset: i });
  const spanFrom = (m: Mark): Span => ({ line: m.line, column: m.column, start: m.offset, end: i });
  const peek = (k = 0): string => source[i + k] ?? "";
  const atLineBreak = (): boolean => peek() === "\n" || (peek() === "\r" && peek(1) === "\n");

  /** Moves past one character (a surrogate pair is one character and one column). */
  const advance = (): void => {
    const c = source.charCodeAt(i);
    const pair = c >= 0xd800 && c <= 0xdbff && (source.charCodeAt(i + 1) & 0xfc00) === 0xdc00;
    i += pair ? 2 : 1;
    column += 1;
  };

  const push = (kind: TokenKind, start: Mark, extra: Partial<Token> = {}): Token => {
    const token: Token = { kind, text: source.slice(start.offset, i), span: spanFrom(start), ...extra };
    tokens.push(token);
    lineEnd = here();
    return token;
  };

  const report = (code: string, span: Span, args: MessageArgs = {}, edits?: TextEdit[]): void => {
    diagnostics.push(makeDiagnostic({ code, language: "edexcel", span, args, ...(edits ? { edits } : {}) }));
  };

  const endLine = (): void => {
    const at = lineEnd;
    tokens.push({
      kind: "newline",
      text: "\n",
      span: { line: at.line, column: at.column, start: at.offset, end: at.offset },
    });
  };

  const number = (start: Mark): void => {
    while (isDigit(peek())) advance();
    let kind: TokenKind = "int";
    let bad = false;
    if (peek() === ".") {
      advance();
      if (!isDigit(peek())) bad = true; // "3." has no digits after the point (EDX-08)
      while (isDigit(peek())) advance();
      kind = "real";
      if (peek() === "." && isDigit(peek(1))) {
        bad = true; // "1.2.3": more than one decimal point
        while (peek() === "." || isDigit(peek())) advance();
      }
    }
    if (isWordChar(peek())) {
      // "2nd": a name can't start with a digit (EDX-02)
      while (isWordChar(peek())) advance();
      const token = push("error", start);
      report("E-SYN-BAD-NAME", token.span, { text: token.text });
      return;
    }
    if (bad) {
      const token = push("error", start);
      report("E-SYN-BAD-NUMBER", token.span, { text: token.text });
      return;
    }
    push(kind, start);
  };

  const string = (start: Mark, open: string): void => {
    const single = SINGLE_QUOTES.has(open);
    const closers = single ? SINGLE_QUOTES : DOUBLE_QUOTES;
    advance();
    let value = "";
    while (i < source.length && !atLineBreak()) {
      if (closers.has(peek())) {
        advance();
        const token = push("string", start, { value, quote: single ? "single" : "double" });
        if (!single) {
          const edits = [
            { start: token.span.start, end: token.span.start + 1, replacement: "'" },
            { start: token.span.end - 1, end: token.span.end, replacement: "'" },
          ];
          report("W-EDX-DOUBLE-QUOTES", token.span, { official: `'${value}'` }, edits);
        }
        return;
      }
      const from = i;
      advance();
      value += source.slice(from, i);
    }
    const token = push("error", start);
    report("E-SYN-UNCLOSED-STRING", token.span);
  };

  while (i < source.length) {
    const c = peek();
    if (atLineBreak()) {
      endLine();
      i += c === "\r" ? 2 : 1;
      line += 1;
      column = 1;
      lineEnd = here();
      continue;
    }
    if (/\s/.test(c)) {
      advance();
      continue;
    }
    if (c === "#") {
      while (i < source.length && !atLineBreak()) advance(); // a comment runs to the end of the line (EDX-01)
      continue;
    }
    const start = here();
    if (isLetter(c)) {
      while (isWordChar(peek())) advance();
      push("word", start);
    } else if (c === "_") {
      while (isWordChar(peek())) advance();
      const token = push("error", start);
      report("E-SYN-BAD-NAME", token.span, { text: token.text });
    } else if (isDigit(c)) {
      number(start);
    } else if (SINGLE_QUOTES.has(c) || DOUBLE_QUOTES.has(c)) {
      string(start, c);
    } else if (c === "!" && peek(1) === "=") {
      i += 2;
      column += 2;
      const token = push("symbol", start, { text: "<>" });
      report("E-SYN-NOT-EQUAL", token.span, {}, [{ start: token.span.start, end: token.span.end, replacement: "<>" }]);
    } else if (c === "=" && peek(1) === "=") {
      i += 2;
      column += 2;
      const token = push("symbol", start, { text: "=" });
      report("E-SYN-DOUBLE-EQUALS", token.span, {}, [
        { start: token.span.start, end: token.span.end, replacement: "=" },
      ]);
    } else if ((c === "<" && (peek(1) === ">" || peek(1) === "=")) || (c === ">" && peek(1) === "=")) {
      i += 2;
      column += 2;
      push("symbol", start);
    } else if (SYMBOLS.has(c)) {
      advance();
      push("symbol", start);
    } else {
      advance();
      const token = push("error", start);
      report("E-SYN-UNEXPECTED-CHAR", token.span, { char: token.text });
    }
  }
  if (tokens.at(-1)?.kind !== "newline" && tokens.length > 0) endLine();
  tokens.push({ kind: "eof", text: "", span: { line, column, start: i, end: i } });
  return { tokens, diagnostics };
}

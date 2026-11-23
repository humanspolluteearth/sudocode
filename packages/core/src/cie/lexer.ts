// The Cambridge 9618 lexer: source text -> tokens (same Token type as Edexcel; a separate hand-written scanner).
//
// Compiler concept: *lexing*. CIE adds three wrinkles. `<-` and `←` are one token (CIE-06); a single-quoted
// token of one character is a CHAR and anything else is a STRING with a warning (CIE-07); and a line that ends
// with a comma or inside brackets continues on the next line (CIE-08), so those newlines are not emitted.
import type { Diagnostic, Span } from "../diagnostics.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { Token, TokenKind } from "../edexcel/tokens.ts";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const SYMBOLS = new Set(["+", "-", "*", "/", "^", "&", "=", "<", ">", "(", ")", "[", "]", ",", ":", "."]);
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
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let column = 1;
  let depth = 0;
  let lineEnd: Mark = { line, column, offset: i };

  const here = (): Mark => ({ line, column, offset: i });
  const spanFrom = (m: Mark): Span => ({ line: m.line, column: m.column, start: m.offset, end: i });
  const peek = (k = 0): string => source[i + k] ?? "";
  const atLineBreak = (): boolean => peek() === "\n" || (peek() === "\r" && peek(1) === "\n");
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
  const report = (code: string, span: Span, args: MessageArgs = {}): void => {
    diagnostics.push(makeDiagnostic({ code, language: "cie", span, args }));
  };

  const endLine = (): void => {
    const last = tokens.at(-1);
    // CIE-08: inside brackets or after a trailing comma the statement carries on.
    if (depth > 0 || (last?.kind === "symbol" && last.text === ",")) return;
    const at = lineEnd;
    tokens.push({
      kind: "newline",
      text: "\n",
      span: { line: at.line, column: at.column, start: at.offset, end: at.offset },
    });
  };

  const number = (start: Mark, leadingDot: boolean): void => {
    while (isDigit(peek())) advance();
    let kind: TokenKind = "int";
    let warn = leadingDot;
    if (peek() === ".") {
      if (isDigit(peek(1)) || !leadingDot) {
        advance();
        kind = "real";
        if (!isDigit(peek())) warn = true; // "5." (CIE-05)
        while (isDigit(peek())) advance();
      }
    }
    if (leadingDot) kind = "real";
    if (isWordChar(peek())) {
      while (isWordChar(peek())) advance();
      const token = push("error", start);
      report("E-SYN-BAD-NAME", token.span, { text: token.text });
      return;
    }
    const token = push(kind, start);
    if (warn)
      report("W-CIE-REAL-FORM", token.span, {
        official: String(Number(token.text)).includes(".")
          ? String(Number(token.text))
          : `${String(Number(token.text))}.0`,
      });
  };

  const string = (start: Mark, quote: string): void => {
    advance();
    let value = "";
    while (i < source.length && !atLineBreak()) {
      if (peek() === quote) {
        advance();
        const single = quote === "'";
        const chars = Array.from(value);
        if (single && chars.length === 1) {
          push("string", start, { value, quote: "single" });
        } else {
          const token = push("string", start, { value, quote: "double" });
          if (single) report("W-CIE-SINGLE-QUOTES", token.span, { official: `"${value}"` });
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
    if (c === "/" && peek(1) === "/") {
      while (i < source.length && !atLineBreak()) advance();
      continue;
    }
    const start = here();
    if (isLetter(c) || c === "_") {
      while (isWordChar(peek())) advance();
      push(c === "_" ? "error" : "word", start);
      if (c === "_") report("E-SYN-BAD-NAME", tokens.at(-1)?.span ?? spanFrom(start), { text: "_" });
    } else if (isDigit(c)) {
      number(start, false);
    } else if (c === "." && isDigit(peek(1))) {
      advance();
      number(start, true);
    } else if (c === '"' || c === "'") {
      string(start, c);
    } else if (c === "←" || (c === "<" && peek(1) === "-")) {
      if (c === "<") advance();
      advance();
      push("symbol", start, { text: "←" });
    } else if ((c === "<" && (peek(1) === ">" || peek(1) === "=")) || (c === ">" && peek(1) === "=")) {
      advance();
      advance();
      push("symbol", start);
    } else if (SYMBOLS.has(c)) {
      advance();
      if (c === "(" || c === "[") depth++;
      if ((c === ")" || c === "]") && depth > 0) depth--;
      push("symbol", start);
    } else {
      advance();
      const token = push("error", start);
      report("E-SYN-UNEXPECTED-CHAR", token.span, { char: token.text });
    }
  }
  depth = 0;
  if (tokens.at(-1)?.kind !== "newline" && tokens.length > 0) endLine();
  tokens.push({ kind: "eof", text: "", span: { line, column, start: i, end: i } });
  return { tokens, diagnostics };
}

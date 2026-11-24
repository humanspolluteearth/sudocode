// The Python lexer (PY-04): source text -> tokens, including the INDENT / DEDENT tokens that stand for Python's
// layout.
//
// Compiler concept: *INDENT/DEDENT lexing*. Python marks blocks with indentation, not brackets. The lexer keeps a
// stack of indentation widths; a deeper line pushes one and emits INDENT, a shallower line pops until it matches
// and emits one DEDENT per pop. The parser then sees blocks as `INDENT statements DEDENT`, like `{ ... }` in other
// languages. Inside (), [] or {} newlines and indentation are ignored, and a line ending in `\` continues.
import type { Span } from "../diagnostics.ts";
import type { Locator, Reporter } from "./locator.ts";

export type TokenType =
  "name" | "int" | "float" | "str" | "fstr" | "bytes" | "op" | "newline" | "indent" | "dedent" | "eof";

export interface Token {
  type: TokenType;
  /** The source text (for `str`/`fstr` the whole literal including quotes). */
  text: string;
  /** `str`: the decoded text; `fstr`: the raw body between the quotes (the parser splits out the `{}` fields). */
  value: string;
  /** `fstr`: offset of the body in the source, so expressions inside get true positions. */
  bodyStart: number;
  raw: boolean;
  span: Span;
}

const OPERATORS = [
  "**=",
  "//=",
  ">>=",
  "<<=",
  "...",
  ":=",
  "->",
  "==",
  "!=",
  "<=",
  ">=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**",
  "//",
  "<<",
  ">>",
  "&=",
  "|=",
  "^=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "=",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ":",
  ".",
  ";",
  "@",
  "&",
  "|",
  "^",
  "~",
];

const isIdentStart = (c: string): boolean => /[\p{L}_]/u.test(c);
const isIdentPart = (c: string): boolean => /[\p{L}\p{N}_]/u.test(c);
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";

const SIMPLE_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  "'": "'",
  '"': '"',
  a: "\x07",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

/** Decodes backslash escapes in a non-raw string body. An unknown escape keeps its backslash, as in Python. */
export function decodeEscapes(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = body[i + 1];
    if (n === undefined) {
      out += c;
      continue;
    }
    if (n === "\n") {
      i++;
      continue;
    }
    const hex = n === "x" ? 2 : n === "u" ? 4 : n === "U" ? 8 : 0;
    if (
      hex > 0 &&
      /^[0-9a-fA-F]+$/.test(body.slice(i + 2, i + 2 + hex)) &&
      body.slice(i + 2, i + 2 + hex).length === hex
    ) {
      out += String.fromCodePoint(parseInt(body.slice(i + 2, i + 2 + hex), 16));
      i += 1 + hex;
      continue;
    }
    const simple = SIMPLE_ESCAPES[n];
    if (simple !== undefined) {
      out += simple;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

export function lex(loc: Locator, report: Reporter, from = 0, to = loc.source.length, nested = false): Token[] {
  const src = loc.source;
  const tokens: Token[] = [];
  const indents = [0];
  let depth = 0;
  let i = from;
  let atLineStart = !nested;

  const push = (type: TokenType, start: number, end: number, value = "", extra: Partial<Token> = {}): void => {
    tokens.push({
      type,
      text: src.slice(start, end),
      value,
      bodyStart: 0,
      raw: false,
      span: loc.span(start, end),
      ...extra,
    });
  };

  while (i < to) {
    if (atLineStart && depth === 0) {
      // Measure the indentation of this line; blank and comment-only lines do not count.
      let width = 0;
      let j = i;
      for (; j < to; j++) {
        if (src[j] === " ") width++;
        else if (src[j] === "\t") width += 8 - (width % 8);
        else if (src[j] === "\f") width = 0;
        else break;
      }
      const c = src[j];
      if (j >= to) {
        i = j;
        break;
      }
      if (c === "\n" || c === "\r" || c === "#") {
        while (j < to && src[j] !== "\n") j++;
        i = j + 1;
        continue;
      }
      const top = indents[indents.length - 1] as number;
      if (width > top) {
        indents.push(width);
        push("indent", i, j);
      } else if (width < top) {
        while (width < (indents[indents.length - 1] as number)) {
          indents.pop();
          push("dedent", j, j);
        }
        if (width !== indents[indents.length - 1]) {
          report.syntax(loc.span(j, j + 1), "unindent does not match any outer indentation level", true);
          indents.push(width);
        }
      }
      i = j;
      atLineStart = false;
    }
    const c = src[i] as string;
    if (c === " " || c === "\t" || c === "\f" || c === "\r") {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < to && src[i] !== "\n") i++;
      continue;
    }
    if (c === "\n") {
      if (depth === 0 && tokens.length > 0 && tokens[tokens.length - 1]?.type !== "newline") push("newline", i, i + 1);
      if (depth === 0) atLineStart = !nested;
      i++;
      continue;
    }
    if (c === "\\" && (src[i + 1] === "\n" || (src[i + 1] === "\r" && src[i + 2] === "\n"))) {
      i += src[i + 1] === "\r" ? 3 : 2;
      continue;
    }
    // String literals, with an optional prefix (r, b, f and combinations).
    const prefix = /^[rRbBfFuU]{1,2}(?=["'])/.exec(src.slice(i, i + 3))?.[0] ?? "";
    const q = src[i + prefix.length];
    if (q === '"' || q === "'") {
      const triple = src.slice(i + prefix.length, i + prefix.length + 3) === q.repeat(3);
      const open = i + prefix.length + (triple ? 3 : 1);
      let j = open;
      const raw = /r/i.test(prefix);
      let closed = false;
      while (j < to) {
        const d = src[j] as string;
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (triple ? src.slice(j, j + 3) === q.repeat(3) : d === q) {
          closed = true;
          break;
        }
        if (d === "\n" && !triple) break;
        j++;
      }
      if (!closed) {
        report.syntax(
          loc.span(i, i + prefix.length + 1),
          triple ? "unterminated triple-quoted string literal" : "unterminated string literal",
        );
        i = Math.min(j, to);
        continue;
      }
      const body = src.slice(open, j);
      const end = j + (triple ? 3 : 1);
      const kind: TokenType = /b/i.test(prefix) ? "bytes" : /f/i.test(prefix) ? "fstr" : "str";
      push(kind, i, end, kind === "fstr" ? body : raw ? body : decodeEscapes(body), { bodyStart: open, raw });
      i = end;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < to && isIdentPart(src[j] as string)) j++;
      push("name", i, j, src.slice(i, j));
      i = j;
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      const m =
        /^(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)/.exec(
          src.slice(i, to),
        );
      const text = m?.[0] ?? c;
      const isFloat = !/^0[xXoObB]/.test(text) && /[.eE]/.test(text);
      if (/^[\p{L}_]/u.test(src[i + text.length] ?? "")) {
        report.syntax(loc.span(i, i + text.length + 1), "invalid decimal literal");
      }
      push(isFloat ? "float" : "int", i, i + text.length, text.replaceAll("_", ""));
      i += text.length;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i) && i + o.length <= to);
    if (op !== undefined) {
      if ("([{".includes(op)) depth++;
      else if (")]}".includes(op)) depth = Math.max(0, depth - 1);
      push("op", i, i + op.length, op);
      i += op.length;
      continue;
    }
    report.syntax(
      loc.span(i, i + 1),
      c === "$" || c === "?" || c === "`" ? "invalid syntax" : `invalid character '${c}'`,
    );
    i++;
  }
  if (!nested) {
    if (tokens.length > 0 && tokens[tokens.length - 1]?.type !== "newline") push("newline", to, to);
    while (indents.length > 1) {
      indents.pop();
      push("dedent", to, to);
    }
  }
  push("eof", to, to);
  return tokens;
}

// A cursor over the token list, with the small helpers both parser files share.
import type { Span } from "../diagnostics.ts";
import type { Locator, Reporter } from "./locator.ts";
import type { Token } from "./lexer.ts";

/** Thrown after a problem is reported, to unwind to the statement loop (panic-mode recovery, see parser.ts). */
export class ParseFail extends Error {}

export class Cursor {
  pos = 0;

  constructor(
    readonly tokens: Token[],
    readonly loc: Locator,
    readonly report: Reporter,
  ) {}

  get tok(): Token {
    return this.tokens[Math.min(this.pos, this.tokens.length - 1)] as Token;
  }

  /** The current token's type (a method, so TypeScript does not assume it is unchanged after `next()`). */
  kind(): Token["type"] {
    return this.tok.type;
  }

  peek(n = 1): Token {
    return this.tokens[Math.min(this.pos + n, this.tokens.length - 1)] as Token;
  }

  next(): Token {
    const t = this.tok;
    if (t.type !== "eof") this.pos++;
    return t;
  }

  isOp(text: string, t: Token = this.tok): boolean {
    return t.type === "op" && t.value === text;
  }

  isWord(text: string, t: Token = this.tok): boolean {
    return t.type === "name" && t.value === text;
  }

  acceptOp(text: string): Token | null {
    return this.isOp(text) ? this.next() : null;
  }

  acceptWord(text: string): Token | null {
    return this.isWord(text) ? this.next() : null;
  }

  fail(span: Span, detail = "invalid syntax"): never {
    this.report.syntax(span, detail);
    throw new ParseFail();
  }

  unsupported(span: Span, feature: string, advice: string): never {
    this.report.notSupported(span, feature, advice);
    throw new ParseFail();
  }

  expectOp(text: string, detail = `expected '${text}'`): Token {
    if (this.isOp(text)) return this.next();
    // A syntax error points just after the last good token when something is missing (as CPython does).
    return this.fail(this.tok.span, detail);
  }

  /** The span of everything from `first` to the last token consumed. */
  since(first: Span): Span {
    const last = this.tokens[Math.max(this.pos - 1, 0)] as Token;
    return { line: first.line, column: first.column, start: first.start, end: Math.max(last.span.end, first.end) };
  }
}

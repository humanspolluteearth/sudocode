// Tokens of Edexcel pseudocode.
//
// Compiler concept: a *token* is the smallest meaningful piece of source (a word, a number, a symbol), with the
// span it came from. Keywords are NOT separate token kinds here: SET, set and Set all arrive as a `word`, and the
// parser decides from context whether a word is a keyword (EDX-05 accepts any case with a warning) or a name
// (so `end` and `step` can still be variable names, as in the exam's own `end = middle - 1`, EDX-101).
import type { Span } from "../diagnostics.ts";

export type TokenKind =
  /** A name or a keyword: letters, digits and _, starting with a letter (EDX-02). */
  | "word"
  | "int"
  | "real"
  /** Text in quotes; `value` is the text without the quotes (EDX-06, EDX-07). */
  | "string"
  /** A symbol: + - * / ^ & = <> < <= > >= ( ) [ ] , : */
  | "symbol"
  /** End of a line: every statement ends with one (EDX-09). */
  | "newline"
  | "eof"
  /** Something the lexer has already reported (unclosed string, bad number...). The parser skips the statement. */
  | "error";

export interface Token {
  kind: TokenKind;
  /** The source text (for `symbol`, the normalised symbol: `!=` arrives as `<>` after its error). */
  text: string;
  /** For `string`: the text inside the quotes. */
  value?: string;
  /** For `string`: which quotes were used. */
  quote?: "single" | "double";
  span: Span;
}

// What the statement parsers in parse-blocks.ts and parse-subprograms.ts need from the Parser class in parser.ts.
import type { Expr, Stmt } from "./ast.ts";
import type { Block, FoundCloser } from "./closers.ts";
import type { Cursor } from "./cursor.ts";
import type { Token } from "./tokens.ts";

export type BodyEnd = FoundCloser | "eof" | "outer";

export interface ParserContext {
  readonly c: Cursor;
  /** How many blocks are open around the statement being parsed. */
  readonly openCount: number;
  skipBlankLines(): void;
  body(block: Block, reportUnclosed?: Block): { stmts: Stmt[]; end: BodyEnd };
  close(end: BodyEnd): void;
  name(advice: string): Token;
  header<T>(parse: () => T, fallback: T): T;
  placeholder(t: Token): Expr;
}

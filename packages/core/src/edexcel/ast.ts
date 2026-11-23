// The Edexcel surface AST: the program as the student wrote it, before checking and lowering.
//
// Compiler concept: an *abstract syntax tree* keeps the structure of the program (this IF contains these
// statements, this + has these two sides) and drops punctuation such as THEN and END IF. It is close to the
// student's text, so the checker can explain mistakes in the student's terms; lowering then turns it into the
// shared core IR. Every node keeps its span: `span` covers the whole construct; where an error should point
// somewhere more precise (an operator, a name) the node has a second span for it.
import type { Span } from "../diagnostics.ts";

export type TypeName = "INTEGER" | "REAL" | "BOOLEAN" | "CHARACTER" | "STRING";
export const TYPES: readonly TypeName[] = ["INTEGER", "REAL", "BOOLEAN", "CHARACTER", "STRING"];

export type BinaryOperator =
  "+" | "-" | "*" | "/" | "^" | "DIV" | "MOD" | "&" | "=" | "<>" | "<" | "<=" | ">" | ">=" | "AND" | "OR";

export type Expr =
  /** `text` is the literal as written: an INTEGER may be beyond the SH-07 range. */
  | { kind: "int"; text: string; span: Span }
  | { kind: "real"; text: string; span: Span }
  | { kind: "string"; value: string; span: Span }
  | { kind: "bool"; value: boolean; span: Span }
  | { kind: "name"; name: string; span: Span }
  | { kind: "paren"; inner: Expr; span: Span }
  /** `opSpan` is the operator, where type and runtime errors point. */
  | { kind: "binary"; op: BinaryOperator; left: Expr; right: Expr; opSpan: Span; span: Span }
  | { kind: "unary"; op: "-" | "NOT"; operand: Expr; opSpan: Span; span: Span }
  | { kind: "index"; target: Expr; index: Expr; span: Span }
  | { kind: "array"; elements: Expr[]; span: Span }
  /** `NAME(args)`: a built-in such as LENGTH, or a function (M5). */
  | { kind: "call"; name: string; nameSpan: Span; args: Expr[]; span: Span };

/** What an assignment writes to. */
export type Target =
  | { kind: "name"; name: string; span: Span }
  | { kind: "element"; name: string; nameSpan: Span; index: Expr; span: Span };

export type Stmt =
  | { kind: "set"; target: Target; value: Expr; span: Span }
  /** `x = 5` without SET (EDX-33): parsed so the checker can explain it. */
  | { kind: "bareAssign"; target: Target; value: Expr; span: Span }
  /** `SEND a, b TO ...` keeps every value and the first comma (EDX-71). `device` is DISPLAY or another device. */
  | { kind: "send"; values: Expr[]; comma: Span | null; device: string; deviceSpan: Span; span: Span }
  /**
   * `RECEIVE name FROM (type) device` (EDX-72). `type` is null when the brackets were left out (EDX-73, a checker
   * error at `deviceSpan`). `device` is KEYBOARD or another device such as CARD_READER (EDX-74).
   */
  | {
      kind: "receive";
      name: string;
      nameSpan: Span;
      type: TypeName | null;
      typeSpan: Span | null;
      device: string;
      deviceSpan: Span;
      span: Span;
    }
  | { kind: "const"; type: TypeName; name: string; nameSpan: Span; span: Span }
  | { kind: "if"; condition: Expr; then: Stmt[]; else: Stmt[]; span: Span }
  | { kind: "while"; condition: Expr; body: Stmt[]; span: Span }
  | { kind: "repeatUntil"; body: Stmt[]; condition: Expr; span: Span }
  | { kind: "repeatTimes"; count: Expr; body: Stmt[]; span: Span }
  | { kind: "for"; name: string; nameSpan: Span; start: Expr; end: Expr; step: Expr | null; body: Stmt[]; span: Span }
  | { kind: "forEach"; name: string; nameSpan: Span; iterable: Expr; body: Stmt[]; span: Span };

export interface Program {
  body: Stmt[];
}

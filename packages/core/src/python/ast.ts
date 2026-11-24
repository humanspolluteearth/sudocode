// The Python surface AST: what the student wrote, before names are resolved. The parser builds it, lowering turns it
// into the shared core IR (ir/python-ir.ts). Every node keeps its span.
import type { Span } from "../diagnostics.ts";
import type { PyArithOp, PyCompareOp } from "../ir/python-ir.ts";

export type SFPart =
  { kind: "text"; text: string } | { kind: "field"; value: SExpr; conversion: "s" | "r" | "a" | null; spec: SFPart[] };

export interface SArg {
  name: string | null;
  value: SExpr;
}

export interface SParam {
  name: string;
  default: SExpr | null;
  span: Span;
}

export interface SCompClause {
  kind: "for" | "if";
  target?: SExpr;
  expr: SExpr;
}

export type SExpr =
  | { kind: "int"; value: bigint; span: Span }
  | { kind: "float"; value: number; span: Span }
  | { kind: "str"; value: string; span: Span }
  | { kind: "fstr"; parts: SFPart[]; span: Span }
  | { kind: "const"; value: boolean | null; span: Span }
  | { kind: "name"; name: string; span: Span }
  | { kind: "binop"; op: PyArithOp; left: SExpr; right: SExpr; span: Span }
  | { kind: "neg" | "pos" | "not"; operand: SExpr; span: Span }
  | { kind: "compare"; ops: PyCompareOp[]; operands: SExpr[]; span: Span }
  | { kind: "boolop"; op: "and" | "or"; left: SExpr; right: SExpr; span: Span }
  | { kind: "ifexp"; test: SExpr; then: SExpr; else: SExpr; span: Span }
  | { kind: "list" | "tuple" | "set"; items: SExpr[]; span: Span }
  | { kind: "dict"; pairs: { key: SExpr; value: SExpr }[]; span: Span }
  | { kind: "index"; target: SExpr; index: SExpr; span: Span }
  | { kind: "slice"; target: SExpr; lower: SExpr | null; upper: SExpr | null; step: SExpr | null; span: Span }
  | { kind: "attr"; target: SExpr; name: string; span: Span }
  | { kind: "call"; callee: SExpr; args: SArg[]; span: Span }
  | { kind: "comp"; element: SExpr; clauses: SCompClause[]; span: Span }
  | { kind: "lambda"; params: SParam[]; body: SExpr; span: Span };

export interface SHandler {
  types: SExpr | null;
  name: string | null;
  body: SStmt[];
  span: Span;
}

export type SStmt =
  | { kind: "expr"; value: SExpr; span: Span }
  | { kind: "assign"; targets: SExpr[]; value: SExpr; span: Span }
  | { kind: "augassign"; target: SExpr; op: PyArithOp; value: SExpr; span: Span }
  | { kind: "if"; test: SExpr; then: SStmt[]; else: SStmt[]; span: Span }
  | { kind: "while"; test: SExpr; body: SStmt[]; orelse: SStmt[]; span: Span }
  | { kind: "for"; target: SExpr; iter: SExpr; body: SStmt[]; orelse: SStmt[]; span: Span }
  | { kind: "def"; name: string; params: SParam[]; body: SStmt[]; span: Span }
  | { kind: "class"; name: string; bases: SExpr[]; body: SStmt[]; span: Span }
  | { kind: "return"; value: SExpr | null; span: Span }
  | { kind: "break" | "continue" | "pass"; span: Span }
  | { kind: "global"; names: string[]; span: Span }
  | { kind: "del"; targets: SExpr[]; span: Span }
  | { kind: "raise"; exc: SExpr | null; span: Span }
  | { kind: "try"; body: SStmt[]; handlers: SHandler[]; orelse: SStmt[]; final: SStmt[]; span: Span }
  | { kind: "assert"; test: SExpr; message: SExpr | null; span: Span };

export const joinSpan = (a: Span, b: Span): Span => ({
  line: a.line,
  column: a.column,
  start: a.start,
  end: Math.max(a.end, b.end),
});

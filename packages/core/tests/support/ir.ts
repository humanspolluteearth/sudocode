// Small builders for hand-written core IR in runtime tests (no front end needed).
import type { Span } from "../../src/diagnostics.ts";
import type { BinaryOp, Expr, Program, Stmt, Subprogram, VarRef } from "../../src/ir/ir.ts";

/** A span on `line` (column 1). Runtime tests only check which line an event or error points at. */
export const at = (line: number, column = 1): Span => ({ line, column, start: 0, end: 0 });

export const num = (value: number, line = 1): Expr => ({
  kind: "literal",
  value: { kind: "int", value },
  span: at(line),
});
export const dec = (value: number, line = 1): Expr => ({
  kind: "literal",
  value: { kind: "real", value },
  span: at(line),
});
export const text = (value: string, line = 1): Expr => ({
  kind: "literal",
  value: { kind: "str", value },
  span: at(line),
});
export const yes = (line = 1): Expr => ({ kind: "literal", value: { kind: "bool", value: true }, span: at(line) });

export const global = (name: string, line = 1): VarRef => ({ kind: "var", name, scope: "global", span: at(line) });
export const local = (name: string, line = 1): VarRef => ({ kind: "var", name, scope: "local", span: at(line) });

const SYMBOLS: Record<BinaryOp, string> = {
  add: "+",
  sub: "-",
  mul: "*",
  divReal: "/",
  intDivFloor: "DIV",
  modFloor: "MOD",
  powIntIfNonNegative: "^",
  concatText: "&",
  eq: "=",
  ne: "<>",
  lt: "<",
  le: "<=",
  gt: ">",
  ge: ">=",
};
export const op = (o: BinaryOp, left: Expr, right: Expr, line = 1): Expr => ({
  kind: "binary",
  op: o,
  symbol: SYMBOLS[o],
  left,
  right,
  span: at(line),
});
export const call = (callee: string, args: Expr[], line = 1): Expr => ({ kind: "call", callee, args, span: at(line) });

export const set = (target: VarRef, value: Expr, line = 1): Stmt => ({ kind: "assign", target, value, span: at(line) });
export const print = (value: Expr, line = 1): Stmt => ({ kind: "output", value, device: null, span: at(line) });
export const ifThen = (condition: Expr, then: Stmt[], otherwise: Stmt[] = [], line = 1): Stmt => ({
  kind: "if",
  condition,
  then,
  else: otherwise,
  span: at(line),
});
export const loopWhile = (condition: Expr, body: Stmt[], line = 1): Stmt => ({
  kind: "while",
  condition,
  body,
  span: at(line),
});
export const ret = (value: Expr | null, line = 1): Stmt => ({ kind: "return", value, span: at(line) });

export const fn = (name: string, params: string[], body: Stmt[]): Subprogram => ({
  name,
  kind: "function",
  params,
  body,
  span: at(1),
});

export const program = (main: Stmt[], subs: Subprogram[] = []): Program => ({
  format: "pseudocode",
  main,
  subprograms: Object.fromEntries(subs.map((s) => [s.name, s])),
});

/**
 * FUNCTION Down(n): IF n = 0 THEN RETURN 0 ELSE RETURN 1 + Down(n - 1). `Down(k)` makes a chain of k + 1 nested
 * calls (Down(k) ... Down(0)) and returns k.
 */
export const down: Subprogram = fn(
  "Down",
  ["n"],
  [
    ifThen(op("eq", local("n", 2), num(0, 2), 2), [ret(num(0, 3), 3)], [], 2),
    ret(op("add", num(1, 4), call("Down", [op("sub", local("n", 4), num(1, 4), 4)], 4), 4), 4),
  ],
);

/** SEND Down(k) TO DISPLAY: k + 1 nested calls. */
export const deepChain = (k: number): Program => program([print(call("Down", [num(k, 9)], 9), 9)], [down]);

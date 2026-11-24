// The Python half of the core IR. Python lowers into the SAME `Program` as Edexcel and Cambridge (ir.ts); these
// extra node kinds carry Python's own rules explicitly (floor division, truthiness, chained comparison, ...), the
// way `intDivFloor` does for pseudocode. The runtime keeps one driver, one trace table and one debugger.
//
// Compiler concept: *scope resolution at lowering time*. Python decides whether a name is global, local or taken
// from an enclosing function by reading the whole function first (PY-04). The front end does that once and writes
// the answer into each `pyName` / `PyTarget`, so the runtime never searches by guesswork.
import type { Span } from "../diagnostics.ts";

/** Where a name's value lives: the module's globals, this call's locals, or an enclosing function's locals. */
export type PyWhere = "global" | "local" | "free";

export type PyLiteral =
  | { kind: "int"; value: bigint }
  | { kind: "float"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "none" };

export type PyArithOp = "add" | "sub" | "mul" | "truediv" | "floordiv" | "mod" | "pow" | "bitor" | "bitand" | "bitxor";
export type PyCompareOp = "eq" | "ne" | "lt" | "le" | "gt" | "ge" | "in" | "notIn" | "is" | "isNot";
export type PyUnaryOp = "neg" | "pos";

/** One piece of an f-string: literal text, or `{value!conversion:spec}`. */
export type PyFPart =
  | { kind: "text"; text: string }
  | { kind: "field"; value: PyExpr; conversion: "s" | "r" | "a" | null; spec: PyFPart[] };

export interface PyKeyword {
  name: string;
  value: PyExpr;
}

export interface PyCompClause {
  kind: "for" | "if";
  /** for `for`: the (hidden) variable(s) to assign. */
  target?: PyTarget;
  /** for `for`: what to loop over; for `if`: the test. */
  expr: PyExpr;
}

export type PyExpr =
  | { kind: "pyConst"; value: PyLiteral; span: Span }
  | { kind: "pyName"; name: string; where: PyWhere; hops: number; span: Span }
  | { kind: "pyArith"; op: PyArithOp; left: PyExpr; right: PyExpr; span: Span }
  | { kind: "pyUnary"; op: PyUnaryOp; operand: PyExpr; span: Span }
  /** `a < b < c`: each operand is evaluated once and the chain stops at the first false link. */
  | { kind: "pyCompare"; ops: PyCompareOp[]; operands: PyExpr[]; span: Span }
  /** `and` / `or` give back one of their operands, not a bool (PY-11). */
  | { kind: "pyBoolOp"; op: "and" | "or"; left: PyExpr; right: PyExpr; span: Span }
  | { kind: "pyNot"; operand: PyExpr; span: Span }
  /** Python truthiness (0, "", [], None are false), used for every `if` / `while` test (PY-10). */
  | { kind: "pyTruth"; operand: PyExpr; span: Span }
  | { kind: "pyIfExpr"; test: PyExpr; then: PyExpr; else: PyExpr; span: Span }
  | { kind: "pyList"; items: PyExpr[]; span: Span }
  | { kind: "pyTuple"; items: PyExpr[]; span: Span }
  | { kind: "pySet"; items: PyExpr[]; span: Span }
  | { kind: "pyDict"; pairs: { key: PyExpr; value: PyExpr }[]; span: Span }
  | { kind: "pyIndex"; target: PyExpr; index: PyExpr; span: Span }
  | { kind: "pySlice"; target: PyExpr; lower: PyExpr | null; upper: PyExpr | null; step: PyExpr | null; span: Span }
  | { kind: "pyAttr"; target: PyExpr; name: string; span: Span }
  | { kind: "pyCall"; callee: PyExpr; args: PyExpr[]; keywords: PyKeyword[]; span: Span }
  | { kind: "pyMethod"; target: PyExpr; name: string; args: PyExpr[]; keywords: PyKeyword[]; span: Span }
  /** `import m` (member null) or `from m import member`: looks the module up in the runtime's module table (PY-22). */
  | { kind: "pyModule"; module: string; member: string | null; span: Span }
  | { kind: "pyFString"; parts: PyFPart[]; span: Span }
  /** Zero-argument `super()` inside a method: the class being defined and the method's first parameter (PY-19). */
  | { kind: "pySuper"; klass: PyExpr; self: PyExpr; span: Span }
  /** A list comprehension, or a generator expression that is consumed at once (PY-32). */
  | { kind: "pyComp"; element: PyExpr; clauses: PyCompClause[]; span: Span }
  /** `def` / `lambda`: makes a function value that remembers the frame it was made in (a closure). */
  | {
      kind: "pyFunction";
      /** The key of the subprogram in `Program.subprograms`. */
      sub: string;
      name: string;
      params: string[];
      /** Default values for the LAST `defaults.length` parameters, evaluated when the function is made. */
      defaults: PyExpr[];
      doc: string | null;
      /** `Class.method` for a method defined directly in a class body, else just the name. */
      qual: string;
      span: Span;
    };

export type PyTarget =
  | { kind: "name"; name: string; where: PyWhere; span: Span }
  /** `target[index] = value`; `root` is the variable it changes, for the trace table. */
  | { kind: "index"; target: PyExpr; index: PyExpr; root: string | null; span: Span }
  /** `target.name = value`; `root` is the variable it changes, for the trace table. */
  | { kind: "attr"; target: PyExpr; name: string; root: string | null; span: Span }
  | { kind: "tuple"; items: PyTarget[]; span: Span };

export interface PyHandler {
  /** The exception class(es) caught; null for a bare `except:`. */
  types: PyExpr | null;
  /** `as name`. */
  name: PyTarget | null;
  /** A hidden variable holding the caught error so a bare `raise` can re-raise it. */
  hidden: PyTarget;
  body: PyStmt[];
  span: Span;
}

export type PyAugOp = PyArithOp;

export type PyStmt =
  | { kind: "pyExpr"; value: PyExpr; span: Span }
  | { kind: "pyAssign"; targets: PyTarget[]; value: PyExpr; span: Span }
  | { kind: "pyAugAssign"; target: PyTarget; op: PyAugOp; value: PyExpr; span: Span }
  | { kind: "pyIf"; test: PyExpr; then: PyStmt[]; else: PyStmt[]; span: Span }
  | { kind: "pyWhile"; test: PyExpr; body: PyStmt[]; orelse: PyStmt[]; span: Span }
  | { kind: "pyFor"; target: PyTarget; iter: PyExpr; body: PyStmt[]; orelse: PyStmt[]; span: Span }
  | { kind: "pyBreak"; span: Span }
  | { kind: "pyContinue"; span: Span }
  | { kind: "pyReturn"; value: PyExpr | null; span: Span }
  | { kind: "pyDel"; targets: PyTarget[]; span: Span }
  /** `raise expr`; `reraise` marks a bare `raise`, whose `exc` is the hidden handler variable. */
  | { kind: "pyRaise"; exc: PyExpr | null; reraise: boolean; span: Span }
  | { kind: "pyTry"; body: PyStmt[]; handlers: PyHandler[]; orelse: PyStmt[]; final: PyStmt[]; span: Span }
  /** `class Name(bases): body`. The body runs once in its own namespace, which becomes the class's attributes. */
  | { kind: "pyClass"; name: string; target: PyTarget; bases: PyExpr[]; body: PyStmt[]; span: Span }
  | { kind: "pyAssert"; test: PyExpr; message: PyExpr | null; span: Span };

export type PyNode = PyExpr | PyStmt;

/** Python nodes all have a `kind` starting with "py"; the shared runtime hands them to the Python evaluator. */
export const isPyExpr = (e: { kind: string }): e is PyExpr => e.kind.startsWith("py");
export const isPyStmt = (s: { kind: string }): s is PyStmt => s.kind.startsWith("py");

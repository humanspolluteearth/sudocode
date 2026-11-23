// The core IR (intermediate representation) that every front end lowers into.
//
// Compiler concept: an IR sits between the front end (what the student wrote: tokens, then a syntax tree) and the
// back end (here, an interpreter). Edexcel, Cambridge and Python each have their own front end, but they all lower
// to these nodes, so there is one runtime, one debugger and one converter. Where the languages differ, the node
// says which rule applies (`intDivFloor`, `forInclusive`, `growOnWrite`), never a vague `div` or `for`
// (CLAUDE.md). Nodes are plain data with a `kind` tag (a discriminated union) and keep the span of the student's
// code they came from, so runtime errors point at the right place.
import type { Span } from "../diagnostics.ts";

/** How values are printed: pseudocode rules (SH-03, SH-04) or Python's (from M8). */
export type OutputFormat = "pseudocode";

/** A constant written in the program. */
export type Literal =
  | { kind: "int"; value: number }
  | { kind: "real"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "char"; value: string }
  | { kind: "str"; value: string };

export type BinaryOp =
  /** INTEGER with INTEGER stays INTEGER, checked against the safe range (SH-07); anything with a REAL is REAL (EDX-13). */
  | "add"
  | "sub"
  | "mul"
  /** `/`: always REAL (EDX-14). */
  | "divReal"
  /** Integer division and remainder with floor rules, as Python's `//` and `%` (SH-10). */
  | "intDivFloor"
  | "modFloor"
  /** `^`: INTEGER when the base is an INTEGER and the exponent a non-negative INTEGER, otherwise REAL (EDX-30). */
  | "powIntIfNonNegative"
  /** `&`: joins text, turning a non-text value into its printed form (EDX-16). */
  | "concatText"
  /** Comparisons: numbers by value, text by character code, case-sensitive (EDX-32). */
  | "eq"
  | "ne"
  | "lt"
  | "le"
  | "gt"
  | "ge";

/** AND / OR evaluate their right side only when it can change the answer (short-circuit, as in Python). */
export type LogicalOp = "andThen" | "orElse";

export type UnaryOp = "negate" | "not";

export type BuiltinName =
  | "length"
  | "random"
  // Cambridge 9618 built-ins (CIE-120 to CIE-129). Each is its own name so the IR states which rule applies.
  | "left"
  | "right"
  | "mid"
  | "ucase"
  | "lcase"
  | "toUpper"
  | "toLower"
  | "numToStr"
  | "strToNum"
  | "isNum"
  | "asc"
  | "chr"
  | "truncate"
  | "randomReal"
  | "day"
  | "month"
  | "year"
  | "dayIndex"
  | "setDate"
  | "today";

/** Where a variable lives. Lowering decides; the runtime never guesses. */
export type Scope = "global" | "local";

/**
 * How a typed input line becomes a value (SH-06): `int` is an optional sign and digits, `real` a number, `bool`
 * TRUE or FALSE in any case (spaces around these three ignored), `char` exactly one character, `str` the line as
 * typed (SH-05). A line that doesn't convert is the E-RUN-INPUT-TYPE runtime error at the statement.
 */
export type InputConversion = "int" | "real" | "bool" | "char" | "str";

export interface VarRef {
  kind: "var";
  name: string;
  scope: Scope;
  span: Span;
}

export type Expr =
  | { kind: "literal"; value: Literal; span: Span }
  | VarRef
  /** `span` is the operator; `symbol` is how the student wrote it (for messages such as "DIV by zero"). */
  | { kind: "binary"; op: BinaryOp; symbol: string; left: Expr; right: Expr; span: Span }
  | { kind: "logical"; op: LogicalOp; left: Expr; right: Expr; span: Span }
  | { kind: "unary"; op: UnaryOp; operand: Expr; span: Span }
  /**
   * `target[index]`. `base` is the first index (0 in Edexcel, EDX-22). `text` is the target as written, for
   * messages ("Index 3 is outside Scores"); `span` starts at the target, where index errors point.
   */
  /**
   * A fixed-size array whose items have no value yet (CIE-20, CIE-21). `dims` holds the length of each dimension,
   * so `[3, 3]` is three rows of three. Reading an unset item is the "no value yet" runtime error.
   */
  | { kind: "newArray"; dims: number[]; span: Span }
  /** A deep copy of an array, so changing one afterwards leaves the other alone (CIE-23). */
  | { kind: "copyArray"; source: Expr; span: Span }
  | { kind: "index"; target: Expr; index: Expr; base: number; text: string; span: Span }
  | { kind: "arrayLiteral"; elements: Expr[]; span: Span }
  | { kind: "builtin"; name: BuiltinName; args: Expr[]; span: Span }
  /** A call of a subprogram defined in the program. */
  | { kind: "call"; callee: string; args: Expr[]; span: Span }
  /** Evaluating this is a runtime error (e.g. an INTEGER literal beyond the SH-07 range). */
  | { kind: "fail"; code: string; args: Readonly<Record<string, string | number>>; span: Span };

export type AssignTarget =
  | VarRef
  /**
   * `array[index]`. `growOnWrite`: writing past the end grows the array, filling gaps with "no value" (EDX-27);
   * otherwise it is an index error.
   */
  | {
      kind: "element";
      array: VarRef;
      index: Expr;
      /** The second index of `grid[row, col]` (EDX-24): `index` picks the row, `index2` the item in it. */
      index2?: Expr;
      base: number;
      growOnWrite: boolean;
      text: string;
      span: Span;
    };

export type Stmt =
  | { kind: "assign"; target: AssignTarget; value: Expr; span: Span }
  /** Prints one line (SH-02). `device` is null for the screen; another device prints `[MOTOR] value` (EDX-74). */
  | { kind: "output"; value: Expr; device: string | null; span: Span }
  /**
   * Waits for one line of input and stores it, converted, in `target` (EDX-72, SH-05). `device` is null for the
   * keyboard; another device's name is shown with the input request (EDX-74).
   */
  | { kind: "input"; target: AssignTarget; convert: InputConversion; device: string | null; span: Span }
  /** Reads the next line of a virtual file into `target`, converted like an input line (EDX-82, SH-11). */
  | { kind: "fileRead"; file: string; target: VarRef; convert: InputConversion; span: Span }
  /** Writes one line to a virtual file; the first write of a run replaces the old contents (EDX-83). */
  | { kind: "fileWrite"; file: string; value: Expr; span: Span }
  | { kind: "if"; condition: Expr; then: Stmt[]; else: Stmt[]; span: Span }
  /** Tests before each pass (EDX-50). */
  | { kind: "while"; condition: Expr; body: Stmt[]; span: Span }
  /** Runs at least once, then stops when the condition is TRUE (EDX-51). */
  | { kind: "repeatUntil"; body: Stmt[]; condition: Expr; span: Span }
  /** The count is evaluated once; 0 or less runs zero times (EDX-52). */
  | { kind: "repeatTimes"; count: Expr; body: Stmt[]; span: Span }
  /**
   * Counts from `start` to `end` INCLUSIVE in steps of `step` (1 when null): start, end and step are evaluated once
   * (EDX-55); STEP 0 is an error at `step` (EDX-54); an unreachable range runs zero times. Each pass assigns the
   * next value from the loop's own counter, so afterwards the variable holds the last value the body ran with
   * (EDX-56), as in Python.
   */
  | { kind: "forInclusive"; variable: VarRef; start: Expr; end: Expr; step: Expr | null; body: Stmt[]; span: Span }
  /** Visits each element of an array, or each character of a string, in order (EDX-57). */
  | { kind: "forEach"; variable: VarRef; iterable: Expr; body: Stmt[]; span: Span }
  | { kind: "callStatement"; callee: string; args: Expr[]; span: Span }
  | { kind: "return"; value: Expr | null; span: Span };

export interface Subprogram {
  name: string;
  kind: "procedure" | "function";
  params: string[];
  body: Stmt[];
  span: Span;
}

export interface Program {
  format: OutputFormat;
  main: Stmt[];
  subprograms: Readonly<Record<string, Subprogram>>;
}

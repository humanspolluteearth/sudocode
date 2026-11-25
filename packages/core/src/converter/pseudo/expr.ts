// Printing IR expressions as Edexcel or Cambridge pseudocode (CNV-10..24).
//
// Compiler concept: *precedence-aware printing* (as in ../expr.ts) plus a *dialect table*: one printer, and the few
// places where the two languages differ (quotes, array bases, `&`, built-ins) look at `cx.target`.
import type { AssignTarget, BinaryOp, Expr, Literal } from "../../ir/ir.ts";
import type { PseudoFeature } from "../refuse.ts";
import type { Types } from "../types.ts";
import type { Names, PseudoTarget } from "./names.ts";

/** Thrown to turn the whole conversion into a refusal for a student (caught in index.ts). */
export class Refuse extends Error {
  constructor(
    readonly feature: PseudoFeature,
    readonly line: number,
    readonly column: number,
    readonly detail?: string,
  ) {
    super(feature);
  }
}

export interface Cx {
  target: PseudoTarget;
  types: Types;
  names: Names;
  sub: string | null;
  /** Length of each array variable, by scope then name (Edexcel to Cambridge). */
  sizes: Map<string, number>;
  /** Lines to print before the statement being printed (the BOOLEAN-to-text lift, CNV-13). */
  pre: string[];
  /** Variables made up by the converter in this scope, to be declared at its top. */
  extra: [string, string][];
  /** True where the lift may add lines before the statement. */
  canLift: boolean;
}

export interface Printed {
  text: string;
  prec: number;
}
const OR = 1;
const AND = 2;
const NOT = 3;
const CMP = 4;
const ADD = 5;
const MUL = 6;
const NEG = 7;
const POW = 8;
const ATOM = 9;
const atom = (text: string): Printed => ({ text, prec: ATOM });
const wrap = (p: Printed, min: number): string => (p.prec < min ? `(${p.text})` : p.text);

const SYMBOL: Record<Exclude<BinaryOp, "concatText" | "powIntIfNonNegative">, [string, number]> = {
  add: ["+", ADD],
  sub: ["-", ADD],
  mul: ["*", MUL],
  divReal: ["/", MUL],
  intDivFloor: ["DIV", MUL],
  modFloor: ["MOD", MUL],
  eq: ["=", CMP],
  ne: ["<>", CMP],
  lt: ["<", CMP],
  le: ["<=", CMP],
  gt: [">", CMP],
  ge: [">=", CMP],
};

const CIE_NAME: Record<string, string> = {
  left: "LEFT",
  right: "RIGHT",
  mid: "MID",
  ucase: "UCASE",
  lcase: "LCASE",
  toUpper: "TO_UPPER",
  toLower: "TO_LOWER",
  numToStr: "NUM_TO_STR",
  strToNum: "STR_TO_NUM",
  isNum: "IS_NUM",
  asc: "ASC",
  chr: "CHR",
  truncate: "INT",
  randomReal: "RAND",
  random: "RANDOM",
};

export function quote(text: string, target: PseudoTarget): string {
  const preferred = target === "cie" ? '"' : "'";
  const other = preferred === '"' ? "'" : '"';
  const q = text.includes(preferred) && !text.includes(other) ? other : preferred;
  return `${q}${text}${q}`;
}

/** A REAL as plain digits: pseudocode has no `1e-7`, so JavaScript's exponent form is spelled out. */
function plainDecimal(value: number): string {
  const text = String(Math.abs(value));
  const sign = value < 0 ? "-" : "";
  const [mantissa = "", exp = "0"] = text.split("e");
  const [whole = "", frac = ""] = mantissa.split(".");
  const digits = whole + frac;
  const point = whole.length + Number(exp);
  let out: string;
  if (point <= 0) out = `0.${"0".repeat(-point)}${digits}`;
  else if (point >= digits.length) out = `${digits}${"0".repeat(point - digits.length)}.0`;
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `${sign}${out.includes(".") ? out : `${out}.0`}`;
}

function literal(lit: Literal, cx: Cx): Printed {
  switch (lit.kind) {
    case "int":
      return { text: String(lit.value), prec: lit.value < 0 ? NEG : ATOM };
    case "real":
      return { text: plainDecimal(lit.value), prec: lit.value < 0 ? NEG : ATOM };
    case "bool":
      return atom(lit.value ? "TRUE" : "FALSE");
    case "char":
    case "str":
      return atom(quote(lit.value, cx.target));
    default: {
      const never: never = lit;
      throw new Error(JSON.stringify(never));
    }
  }
}

const here = (e: { span: { line: number; column: number } }): [number, number] => [e.span.line, e.span.column];

function isTextExpr(e: Expr): boolean {
  return (
    (e.kind === "literal" && (e.value.kind === "str" || e.value.kind === "char")) ||
    (e.kind === "binary" && e.op === "concatText")
  );
}

/** One piece of an `&` join. Cambridge needs real text; Edexcel's `&` converts by itself (EDX-16). */
function piece(e: Expr, cx: Cx): Printed {
  if (e.kind === "binary" && e.op === "concatText") return concat(e, cx);
  if (cx.target === "edexcel") {
    if (e.kind === "builtin" && e.name === "numToStr") {
      const [a] = e.args;
      if (a !== undefined && cx.types.typeOf(a, cx.sub) === "int") return expr(a, cx);
    }
    return expr(e, cx);
  }
  if (isTextExpr(e)) return expr(e, cx);
  if (e.kind === "literal" && e.value.kind === "bool") return atom(`"${e.value.value ? "TRUE" : "FALSE"}"`);
  const ty = cx.types.typeOf(e, cx.sub);
  const [line, column] = here(e);
  if (ty === "str") return expr(e, cx);
  if (ty === "int") return atom(`NUM_TO_STR(${expr(e, cx).text})`);
  if (ty === "real") throw new Refuse("real-in-text", line, column);
  if (ty === "bool") {
    if (!cx.canLift) throw new Refuse("real-in-text", line, column);
    const name = cx.names.fresh("text");
    cx.extra.push([name, "STRING"]);
    cx.pre.push(`IF ${expr(e, cx).text} THEN`, `  ${name} <- "TRUE"`, "ELSE", `  ${name} <- "FALSE"`, "ENDIF");
    return atom(name);
  }
  throw new Refuse("unknown-type", line, column, "this value");
}

function concat(e: Extract<Expr, { kind: "binary" }>, cx: Cx): Printed {
  // Edexcel's `&` needs at least one text side (EDX-16), so a join of two non-text values starts with ''.
  const text = (x: Expr): boolean => isTextExpr(x) || cx.types.typeOf(x, cx.sub) === "str";
  if (cx.target === "edexcel" && !text(e.left) && !text(e.right)) {
    return { text: `'' & ${wrap(piece(e.left, cx), ADD + 1)} & ${wrap(piece(e.right, cx), ADD + 1)}`, prec: ADD };
  }
  return { text: `${wrap(piece(e.left, cx), ADD)} & ${wrap(piece(e.right, cx), ADD + 1)}`, prec: ADD };
}

/** `index - base` for Cambridge to Edexcel (arrays there start at 0), folded for a number written in the program. */
function shift(index: Expr, base: number, cx: Cx): string {
  if (cx.target === "cie" || base === 0) return expr(index, cx).text;
  if (index.kind === "literal" && index.value.kind === "int") return String(index.value.value - base);
  return base > 0
    ? `${wrap(expr(index, cx), ADD)} - ${String(base)}`
    : `${wrap(expr(index, cx), ADD)} + ${String(-base)}`;
}

/** `index + 1`, for MID: Cambridge counts text from 1. */
function mid1(index: Expr, cx: Cx): string {
  if (index.kind === "literal" && index.value.kind === "int") return String(index.value.value + 1);
  return `${wrap(expr(index, cx), ADD)} + 1`;
}

export function target(t: AssignTarget, cx: Cx): string {
  if (t.kind === "var") return cx.names.of(t.name);
  if (t.kind === "field") throw new Refuse("types", t.span.line, t.span.column);
  if (t.index2 !== undefined) throw new Refuse("multi-array", t.span.line, t.span.column);
  return `${cx.names.of(t.array.name)}[${shift(t.index, t.base, cx)}]`;
}

function builtin(e: Extract<Expr, { kind: "builtin" }>, cx: Cx): Printed {
  const [a, b] = e.args;
  const [line, column] = here(e);
  if (e.name === "length" && a !== undefined) {
    if (cx.target === "cie" && a.kind === "var") {
      const size = cx.sizes.get(`${cx.sub ?? ""}:${a.name}`);
      if (size !== undefined) return atom(String(size));
    }
    if (cx.target === "edexcel" || cx.types.typeOf(a, cx.sub) === "str") return atom(`LENGTH(${expr(a, cx).text})`);
    throw new Refuse("unknown-type", line, column, "this array");
  }
  if (e.name === "random" && cx.target === "cie" && a !== undefined && b === undefined) {
    return atom(`INT(RAND(${expr(a, cx).text} + 1))`);
  }
  throw new Refuse("builtins", line, column, CIE_NAME[e.name] ?? e.name.toUpperCase());
}

export function expr(e: Expr, cx: Cx): Printed {
  switch (e.kind) {
    case "literal":
      return literal(e.value, cx);
    case "var":
      return atom(cx.names.of(e.name));
    case "binary": {
      if (e.op === "concatText") return concat(e, cx);
      if (e.op === "powIntIfNonNegative") {
        return { text: `${wrap(expr(e.left, cx), POW + 1)} ^ ${wrap(expr(e.right, cx), NEG)}`, prec: POW };
      }
      const [symbol, prec] = SYMBOL[e.op];
      const left = wrap(expr(e.left, cx), prec === CMP ? CMP + 1 : prec);
      return { text: `${left} ${symbol} ${wrap(expr(e.right, cx), prec + 1)}`, prec };
    }
    case "logical": {
      const [word, prec] = e.op === "andThen" ? ["AND", AND] : ["OR", OR];
      return { text: `${wrap(expr(e.left, cx), prec)} ${word} ${wrap(expr(e.right, cx), prec + 1)}`, prec };
    }
    case "unary":
      return e.op === "not"
        ? { text: `NOT ${wrap(expr(e.operand, cx), ATOM)}`, prec: NOT }
        : { text: `-${wrap(expr(e.operand, cx), NEG)}`, prec: NEG };
    case "index":
      if (cx.target === "cie" && cx.types.typeOf(e.target, cx.sub) === "str") {
        // Edexcel counts text from 0, Cambridge's MID from 1.
        return atom(`MID(${expr(e.target, cx).text}, ${mid1(e.index, cx)}, 1)`);
      }
      return atom(`${wrap(expr(e.target, cx), ATOM)}[${shift(e.index, e.base, cx)}]`);
    case "builtin":
      return builtin(e, cx);
    case "call":
      return atom(`${cx.names.of(e.callee)}(${e.args.map((x) => expr(x, cx).text).join(", ")})`);
    case "newArray":
    case "arrayLiteral":
    case "copyArray":
      throw new Refuse("unknown-type", e.span.line, e.span.column, "this array");
    default:
      throw new Refuse("problems", e.span.line, e.span.column);
  }
}

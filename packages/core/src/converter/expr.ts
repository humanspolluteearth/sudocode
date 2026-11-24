// Printing IR expressions as Python text.
//
// Compiler concept: *precedence-aware printing*. A tree has no brackets; text does. Each printed expression carries
// its precedence, and a child is wrapped in brackets only when it binds more loosely than the place it is printed in,
// so `(a + b) * c` keeps its brackets and `a + b * c` gets none. The output stays readable for a student.
import type { AssignTarget, BinaryOp, BuiltinName, Expr, Literal } from "../ir/ir.ts";
import { use, type Cx } from "./helpers.ts";
import { pyName } from "./names.ts";

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

export class Unprintable extends Error {}

export function realLiteral(value: number): string {
  const text = String(value);
  return Number.isInteger(value) && !text.includes("e") ? `${text}.0` : text;
}

export const quote = (value: string): string => JSON.stringify(value);

function literal(lit: Literal): Printed {
  switch (lit.kind) {
    case "int":
      return { text: String(lit.value), prec: lit.value < 0 ? NEG : ATOM };
    case "real":
      return { text: realLiteral(lit.value), prec: lit.value < 0 ? NEG : ATOM };
    case "bool":
      return atom(lit.value ? "True" : "False");
    case "char":
    case "str":
      return atom(quote(lit.value));
    default: {
      const never: never = lit;
      throw new Unprintable(JSON.stringify(never));
    }
  }
}

const SYMBOL: Record<Exclude<BinaryOp, "concatText" | "powIntIfNonNegative">, [string, number]> = {
  add: ["+", ADD],
  sub: ["-", ADD],
  mul: ["*", MUL],
  divReal: ["/", MUL],
  intDivFloor: ["//", MUL],
  modFloor: ["%", MUL],
  eq: ["==", CMP],
  ne: ["!=", CMP],
  lt: ["<", CMP],
  le: ["<=", CMP],
  gt: [">", CMP],
  ge: [">=", CMP],
};

const TEXT_BUILTINS = new Set<BuiltinName>([
  "left",
  "right",
  "mid",
  "ucase",
  "lcase",
  "toUpper",
  "toLower",
  "numToStr",
  "chr",
]);

const isText = (e: Expr): boolean =>
  (e.kind === "literal" && (e.value.kind === "str" || e.value.kind === "char")) ||
  (e.kind === "binary" && e.op === "concatText") ||
  (e.kind === "builtin" && TEXT_BUILTINS.has(e.name));

/** One piece of an `&` join, as Python text that is already a string. */
function textPiece(e: Expr, cx: Cx): Printed {
  if (e.kind === "binary" && e.op === "concatText") return concat(e, cx);
  if (isText(e)) return expr(e, cx);
  if (e.kind === "literal" && e.value.kind === "bool") return atom(quote(e.value.value ? "TRUE" : "FALSE"));
  const ty = cx.types.typeOf(e, cx.sub);
  if (ty === "str") return expr(e, cx); // already text
  if (ty === "int") return atom(`str(${expr(e, cx).text})`); // Python prints an int the way the pseudocode does
  return shown(e, cx); // REAL, BOOLEAN or not known: let the helper decide when the program runs
}

/** `_show(x)`: the text a value prints as (TRUE / FALSE, no trailing ".0"). */
export function shown(e: Expr, cx: Cx): Printed {
  use(cx, "show");
  return atom(`_show(${expr(e, cx).text})`);
}

function concat(e: Extract<Expr, { kind: "binary" }>, cx: Cx): Printed {
  return { text: `${wrap(textPiece(e.left, cx), ADD)} + ${wrap(textPiece(e.right, cx), ADD + 1)}`, prec: ADD };
}

/** The text of a value for `OUTPUT`: plain when it is text or an INTEGER, otherwise via `_show`. */
export function printable(e: Expr, cx: Cx): string {
  if (isText(e)) return textPiece(e, cx).text;
  const ty = cx.types.typeOf(e, cx.sub);
  if (ty === "int" || ty === "str") return expr(e, cx).text;
  return textPiece(e, cx).text;
}

/** `index - base`, folded when the index is a number written in the program. */
function offset(index: Expr, base: number, cx: Cx): string {
  if (base === 0) return expr(index, cx).text;
  if (index.kind === "literal" && index.value.kind === "int") return String(index.value.value - base);
  return `${wrap(expr(index, cx), ADD)} - ${String(base)}`;
}

export function target(t: AssignTarget, cx: Cx): string {
  switch (t.kind) {
    case "var":
      return pyName(t.name);
    case "element": {
      const second = t.index2 === undefined ? "" : `[${offset(t.index2, t.base2 ?? t.base, cx)}]`;
      return `${pyName(t.array.name)}[${offset(t.index, t.base, cx)}]${second}`;
    }
    case "field":
      throw new Unprintable("field");
    default: {
      const never: never = t;
      throw new Unprintable(JSON.stringify(never));
    }
  }
}

function builtin(e: Extract<Expr, { kind: "builtin" }>, cx: Cx): Printed {
  const [a, b, c] = e.args;
  const arg = (x: Expr | undefined, min = 1): string => {
    if (x === undefined) throw new Unprintable(e.name);
    return wrap(expr(x, cx), min);
  };
  switch (e.name) {
    case "length":
      return atom(`len(${arg(a)})`);
    case "random":
      cx.imports.add("random");
      return atom(`random.randint(${arg(a)}, ${arg(b)})`);
    case "randomReal":
      cx.imports.add("random");
      return { text: `random.random() * ${arg(a, MUL + 1)}`, prec: MUL };
    case "left":
      return atom(`${arg(a, ATOM)}[:${arg(b)}]`);
    case "right":
      use(cx, "right");
      return atom(`_right(${arg(a)}, ${arg(b)})`);
    case "mid":
      use(cx, "mid");
      return atom(`_mid(${arg(a)}, ${arg(b)}, ${arg(c)})`);
    case "ucase":
    case "toUpper":
      return atom(`${arg(a, ATOM)}.upper()`);
    case "lcase":
    case "toLower":
      return atom(`${arg(a, ATOM)}.lower()`);
    case "numToStr":
      return a !== undefined && cx.types.typeOf(a, cx.sub) === "int"
        ? atom(`str(${expr(a, cx).text})`)
        : shown(a ?? e, cx);
    case "strToNum":
      return atom(`float(${arg(a)})`);
    case "isNum":
      use(cx, "isNum");
      return atom(`_is_num(${arg(a)})`);
    case "asc":
      return atom(`ord(${arg(a)})`);
    case "chr":
      return atom(`chr(${arg(a)})`);
    case "truncate":
      return atom(`int(${arg(a)})`);
    case "eof":
    case "day":
    case "month":
    case "year":
    case "dayIndex":
    case "setDate":
    case "today":
      throw new Unprintable(e.name); // refused before printing (refuse.ts)
    default: {
      const never: never = e.name;
      throw new Unprintable(String(never));
    }
  }
}

export function expr(e: Expr, cx: Cx): Printed {
  switch (e.kind) {
    case "literal":
      return literal(e.value);
    case "var":
      return atom(pyName(e.name));
    case "binary": {
      if (e.op === "concatText") return concat(e, cx);
      if (e.op === "powIntIfNonNegative") {
        return { text: `${wrap(expr(e.left, cx), POW + 1)} ** ${wrap(expr(e.right, cx), NEG)}`, prec: POW };
      }
      const [symbol, prec] = SYMBOL[e.op];
      const left = wrap(expr(e.left, cx), prec === CMP ? CMP + 1 : prec);
      return { text: `${left} ${symbol} ${wrap(expr(e.right, cx), prec + 1)}`, prec };
    }
    case "logical": {
      const [word, prec] = e.op === "andThen" ? ["and", AND] : ["or", OR];
      return { text: `${wrap(expr(e.left, cx), prec)} ${word} ${wrap(expr(e.right, cx), prec + 1)}`, prec };
    }
    case "unary":
      return e.op === "not"
        ? { text: `not ${wrap(expr(e.operand, cx), NOT)}`, prec: NOT }
        : { text: `-${wrap(expr(e.operand, cx), NEG)}`, prec: NEG };
    case "newArray": {
      // Items have no value yet, which Python calls None.
      const dims = [...e.dims];
      const first = dims.pop();
      if (first === undefined) throw new Unprintable("empty array");
      let text =
        e.fill === undefined
          ? `[None] * ${String(first)}`
          : `[${expr(e.fill, cx).text} for _ in range(${String(first)})]`;
      let prec = e.fill === undefined ? MUL : ATOM;
      for (const n of dims.reverse()) {
        text = `[${text} for _ in range(${String(n)})]`;
        prec = ATOM;
      }
      return { text, prec };
    }
    case "copyArray":
      use(cx, "copy");
      return atom(`_copy(${expr(e.source, cx).text})`);
    case "index": {
      return atom(`${wrap(expr(e.target, cx), ATOM)}[${offset(e.index, e.base, cx)}]`);
    }
    case "arrayLiteral":
      return atom(`[${e.elements.map((x) => expr(x, cx).text).join(", ")}]`);
    case "builtin":
      return builtin(e, cx);
    case "call":
      return atom(`${pyName(e.callee)}(${e.args.map((x) => expr(x, cx).text).join(", ")})`);
    default:
      throw new Unprintable(e.kind); // records, enumerations, Python nodes and `fail` were refused earlier
  }
}

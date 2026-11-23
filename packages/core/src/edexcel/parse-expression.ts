// Edexcel expressions, parsed with a Pratt parser.
//
// Compiler concept: *Pratt parsing* (top-down operator precedence). Each infix operator has a *binding power*:
// how tightly it holds the operands next to it. To parse `2 + 3 * 4`, the parser reads 2, sees + (power 6),
// and parses its right side with "only operators stronger than 6": that takes 3 * 4 (power 7) whole, so the
// result is 2 + (3 * 4). One small loop handles the whole precedence table, and the table below is exactly
// edexcel.md section 2.4 (EDX-34). Same-level operators work left to right; `^` works right to left, so its right
// side is parsed with a power one lower, letting another ^ in.
import type { BinaryOperator, Expr } from "./ast.ts";
import { Abandon, Cursor, joinSpans, RESERVED } from "./cursor.ts";
import type { Token } from "./tokens.ts";

/** Binding powers, weakest first (edexcel.md 2.4 read from the bottom). */
const POWER = { OR: 1, AND: 2, NOT: 3, COMPARE: 4, CONCAT: 5, ADD: 6, MULTIPLY: 7, NEGATE: 8, POWER: 9 } as const;

interface Infix {
  op: BinaryOperator;
  power: number;
  rightToLeft: boolean;
}

const SYMBOL_INFIX: Partial<Record<string, Infix>> = {
  "=": { op: "=", power: POWER.COMPARE, rightToLeft: false },
  "<>": { op: "<>", power: POWER.COMPARE, rightToLeft: false },
  "<": { op: "<", power: POWER.COMPARE, rightToLeft: false },
  "<=": { op: "<=", power: POWER.COMPARE, rightToLeft: false },
  ">": { op: ">", power: POWER.COMPARE, rightToLeft: false },
  ">=": { op: ">=", power: POWER.COMPARE, rightToLeft: false },
  "&": { op: "&", power: POWER.CONCAT, rightToLeft: false },
  "+": { op: "+", power: POWER.ADD, rightToLeft: false },
  "-": { op: "-", power: POWER.ADD, rightToLeft: false },
  "*": { op: "*", power: POWER.MULTIPLY, rightToLeft: false },
  "/": { op: "/", power: POWER.MULTIPLY, rightToLeft: false },
  "^": { op: "^", power: POWER.POWER, rightToLeft: true },
};

const WORD_INFIX: Partial<Record<string, Infix>> = {
  OR: { op: "OR", power: POWER.OR, rightToLeft: false },
  AND: { op: "AND", power: POWER.AND, rightToLeft: false },
  DIV: { op: "DIV", power: POWER.MULTIPLY, rightToLeft: false },
  MOD: { op: "MOD", power: POWER.MULTIPLY, rightToLeft: false },
};

function infixOf(t: Token): Infix | undefined {
  if (t.kind === "symbol") return SYMBOL_INFIX[t.text];
  if (t.kind === "word") return WORD_INFIX[t.text.toUpperCase()];
  return undefined;
}

/** Can this token begin an expression? (Used to tell `NOT x` from a name `not`, and for hints.) */
export function startsExpression(t: Token): boolean {
  switch (t.kind) {
    case "int":
    case "real":
    case "string":
      return true;
    case "symbol":
      return t.text === "(" || t.text === "[" || t.text === "-";
    case "word": {
      const upper = t.text.toUpperCase();
      return !RESERVED.has(t.text) || ["NOT", "TRUE", "FALSE", "LENGTH", "RANDOM"].includes(upper);
    }
    default:
      return false;
  }
}

const VALUE_ADVICE = "Write a value or a name here.";

/** An expression; stops before the first token that can't continue it (a keyword such as TO or THEN). */
export function parseExpression(c: Cursor, minPower = 0): Expr {
  let left = parsePrefix(c);
  for (;;) {
    const t = c.peek();
    const infix = infixOf(t);
    if (infix === undefined || infix.power <= minPower) return left;
    c.next();
    if (t.kind === "word") c.warnCase(t, infix.op);
    const right = parseExpression(c, infix.rightToLeft ? infix.power - 1 : infix.power);
    left = { kind: "binary", op: infix.op, left, right, opSpan: t.span, span: joinSpans(left.span, right.span) };
  }
}

function parsePrefix(c: Cursor): Expr {
  const t = c.peek();
  switch (t.kind) {
    case "newline":
    case "eof":
      c.report("E-SYN-LINE-ENDS-EARLY", t.span);
      throw new Abandon();
    case "error":
      return c.failSilently();
    case "int":
    case "real":
      c.next();
      return postfix(c, { kind: t.kind, text: t.text, span: t.span });
    case "string":
      c.next();
      return postfix(c, { kind: "string", value: t.value ?? "", span: t.span });
    case "symbol":
      return prefixSymbol(c, t);
    case "word":
      return prefixWord(c, t);
    default: {
      const unreachable: never = t.kind;
      throw new Error(`Unknown token ${String(unreachable)}`);
    }
  }
}

function prefixSymbol(c: Cursor, t: Token): Expr {
  if (t.text === "-") {
    c.next();
    const operand = parseExpression(c, POWER.NEGATE); // ^ (power 9) still binds tighter: -2 ^ 2 is -(2 ^ 2)
    return { kind: "unary", op: "-", operand, opSpan: t.span, span: joinSpans(t.span, operand.span) };
  }
  if (t.text === "(") {
    c.next();
    const inner = parseExpression(c);
    const close = c.expectSymbol(")", ")", "Close every ( with ).");
    return postfix(c, { kind: "paren", inner, span: joinSpans(t.span, close.span) });
  }
  if (t.text === "[") {
    c.next();
    const elements: Expr[] = [];
    if (!c.isSymbol("]")) {
      for (;;) {
        elements.push(parseExpression(c));
        if (!c.isSymbol(",")) break;
        c.next();
      }
    }
    const close = c.expectSymbol("]", "] or ,", "Separate the elements with commas and close the list with ].");
    return postfix(c, { kind: "array", elements, span: joinSpans(t.span, close.span) });
  }
  return c.fail("a value", VALUE_ADVICE);
}

function prefixWord(c: Cursor, t: Token): Expr {
  const upper = t.text.toUpperCase();
  if (upper === "TRUE" || upper === "FALSE") {
    c.next(); // EDX-08: Boolean literals in any case, with no warning
    return postfix(c, { kind: "bool", value: upper === "TRUE", span: t.span });
  }
  if (upper === "NOT" && startsExpression(c.peek(1))) {
    c.next();
    c.warnCase(t, "NOT");
    const operand = parseExpression(c, POWER.NOT); // below the comparisons: NOT 1 = 2 is NOT (1 = 2)
    return { kind: "unary", op: "NOT", operand, opSpan: t.span, span: joinSpans(t.span, operand.span) };
  }
  const builtin = upper === "LENGTH" || upper === "RANDOM";
  if (RESERVED.has(t.text) && !builtin) return c.fail("a value", VALUE_ADVICE);
  c.next();
  if (c.isSymbol("(")) {
    c.next();
    if (builtin) c.warnCase(t, upper); // decision D12: length(...) is LENGTH with the lowercase warning
    const args: Expr[] = [];
    if (!c.isSymbol(")")) {
      for (;;) {
        args.push(parseExpression(c));
        if (!c.isSymbol(",")) break;
        c.next();
      }
    }
    const close = c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
    const name = builtin ? upper : t.text;
    return postfix(c, { kind: "call", name, nameSpan: t.span, args, span: joinSpans(t.span, close.span) });
  }
  return postfix(c, { kind: "name", name: t.text, span: t.span });
}

/** `x[i]`, `x[i][j]`: indexing binds tighter than any operator. */
function postfix(c: Cursor, target: Expr): Expr {
  let e = target;
  while (c.isSymbol("[")) {
    c.next();
    const index = parseExpression(c);
    if (c.isSymbol(",")) {
      // EDX-24 (2D arrays, Grid[row, col]) arrives with M5.
      c.report("E-SYN-NOT-SUPPORTED", c.peek().span, {
        feature: "A 2D array index such as Grid[row, col]",
        advice: "2D arrays arrive in a later version of Sudocode.",
      });
      throw new Abandon();
    }
    const close = c.expectSymbol("]", "]", "Close the index with ].");
    e = { kind: "index", target: e, index, span: joinSpans(e.span, close.span) };
  }
  return e;
}

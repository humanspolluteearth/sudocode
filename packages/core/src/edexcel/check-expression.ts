// Type checking of Edexcel expressions (checker.ts does the statements).
// Each function returns the expression's type; after reporting an error it returns `unknown`, so the mistake
// isn't reported again by the expression around it.
import type { Span } from "../diagnostics.ts";
import type { MessageArgs } from "../messages/index.ts";
import type { BinaryOperator, Expr } from "./ast.ts";
import {
  arrayOf,
  BOOLEAN,
  CHARACTER,
  commonElement,
  INTEGER,
  isNumber,
  isText,
  isUnknown,
  REAL,
  STRING,
  typeName,
  UNKNOWN,
  withArticle,
  type Ty,
  type Typed,
} from "./types.ts";

/** What expression checking needs from the statement checker. */
export interface Scope {
  /** The variable's type; `unknown` if it isn't known yet; undefined if it is never given a value anywhere. */
  typeOf(name: string): Ty | undefined;
  /** Every name the program gives a value to (for "did you mean"). */
  names(): Iterable<string>;
  report(code: string, span: Span, args?: MessageArgs, variant?: string): void;
  text(span: Span): string;
}

const reportedNames = new WeakMap<Scope, Set<string>>();

/** Levenshtein distance, for "did you mean" (small strings only). */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length] ?? 0;
}

function unknownName(scope: Scope, name: string, span: Span): void {
  const done = reportedNames.get(scope) ?? new Set<string>();
  reportedNames.set(scope, done);
  if (done.has(name)) return; // reported once, at its first use (harvested/README.md "How many")
  done.add(name);
  const known = [...scope.names()];
  const otherCase = known.find((k) => k.toLowerCase() === name.toLowerCase());
  if (otherCase !== undefined) {
    scope.report("E-CHK-UNKNOWN-NAME", span, { name, suggestion: otherCase }, "other-case");
    return;
  }
  const close = known.find((k) => name.length >= 3 && distance(k, name) <= (name.length > 5 ? 2 : 1));
  if (close !== undefined) scope.report("E-CHK-UNKNOWN-NAME", span, { name, suggestion: close }, "did-you-mean");
  else scope.report("E-CHK-UNKNOWN-NAME", span, { name });
}

/** A negative number written in the program (`-1`, `(-2)`): `2 ^ -1` is then a REAL (EDX-30, QUESTIONS.md 28). */
function isNegativeLiteral(e: Expr): boolean {
  if (e.kind === "paren") return isNegativeLiteral(e.inner);
  return e.kind === "unary" && e.op === "-" && (e.operand.kind === "int" || e.operand.kind === "real");
}

const ARITHMETIC = new Set<BinaryOperator>(["+", "-", "*"]);
const ORDER = new Set<BinaryOperator>(["<", "<=", ">", ">="]);

function binary(scope: Scope, e: Extract<Expr, { kind: "binary" }>): Typed {
  const l = check(scope, e.left).ty;
  const r = check(scope, e.right).ty;
  const op = e.op;
  const at = e.opSpan;
  const bad = (code: string, args: MessageArgs, variant?: string): Typed => {
    scope.report(code, at, args, variant);
    return { ty: UNKNOWN };
  };
  const nonNumber = !isUnknown(l) && !isNumber(l) ? l : r;
  if (ARITHMETIC.has(op) || op === "/" || op === "^") {
    if ((!isUnknown(l) && !isNumber(l)) || (!isUnknown(r) && !isNumber(r))) {
      return bad("E-CHK-OPERAND-TYPE", { operator: op, type: typeName(nonNumber) }, "arithmetic");
    }
    if (isUnknown(l) || isUnknown(r)) return { ty: op === "/" ? REAL : UNKNOWN };
    if (op === "/") return { ty: REAL }; // EDX-14
    if (op === "^")
      return { ty: l.kind === "INTEGER" && r.kind === "INTEGER" && !isNegativeLiteral(e.right) ? INTEGER : REAL };
    return { ty: l.kind === "INTEGER" && r.kind === "INTEGER" ? INTEGER : REAL }; // EDX-13
  }
  if (op === "DIV" || op === "MOD") {
    // EDX-31: both sides must be INTEGERs.
    const wrong = [l, r].find((t) => !isUnknown(t) && t.kind !== "INTEGER");
    if (wrong !== undefined) return bad("E-CHK-DIV-MOD-INTEGER", { operator: op, type: withArticle(wrong) });
    return { ty: INTEGER };
  }
  if (op === "&") {
    if (l.kind === "ARRAY" || r.kind === "ARRAY") return bad("E-CHK-CONCAT-ARRAY", {}); // EDX-26
    if (isText(l) || isText(r) || isUnknown(l) || isUnknown(r)) return { ty: STRING }; // EDX-16
    return bad("E-CHK-OPERAND-TYPE", { operator: "&", type: typeName(l) }, "concat"); // D4
  }
  if (op === "AND" || op === "OR") {
    const wrong = [l, r].find((t) => !isUnknown(t) && t.kind !== "BOOLEAN");
    if (wrong !== undefined) return bad("E-CHK-OPERAND-TYPE", { operator: op, type: typeName(wrong) }, "logic");
    return { ty: BOOLEAN };
  }
  // Comparisons (EDX-32): two numbers, two pieces of text, or (= and <> only) two BOOLEANs.
  if (isUnknown(l) || isUnknown(r)) return { ty: BOOLEAN };
  const arrayOrBool = [l, r].find((t) => t.kind === "ARRAY" || (ORDER.has(op) && t.kind === "BOOLEAN"));
  if (arrayOrBool !== undefined) {
    return bad(
      "E-CHK-OPERAND-TYPE",
      { operator: op, type: typeName(arrayOrBool) },
      ORDER.has(op) ? "order" : undefined,
    );
  }
  const comparable = (isNumber(l) && isNumber(r)) || (isText(l) && isText(r)) || l.kind === r.kind;
  if (!comparable) return bad("E-CHK-COMPARE-TYPES", { left: withArticle(l), right: withArticle(r) });
  return { ty: BOOLEAN };
}

function call(scope: Scope, e: Extract<Expr, { kind: "call" }>): Typed {
  const args = e.args.map((a) => check(scope, a).ty);
  if (e.name === "LENGTH") {
    if (args.length !== 1) {
      const counts = {
        name: "LENGTH",
        expected: "1 value",
        actual: args.length,
        signature: "LENGTH(<array or STRING>)",
      };
      scope.report("E-CHK-ARG-COUNT", e.nameSpan, counts, "builtin");
      return { ty: UNKNOWN };
    }
    const [t] = args;
    const arg = e.args[0];
    if (t !== undefined && arg !== undefined && !isUnknown(t) && t.kind !== "ARRAY" && !isText(t)) {
      const args2 = {
        function: "LENGTH",
        expected: "an array or a STRING",
        argument: scope.text(arg.span),
        actual: withArticle(t),
      };
      scope.report("E-CHK-ARG-TYPE", arg.span, args2);
      return { ty: UNKNOWN };
    }
    return { ty: INTEGER }; // EDX-90
  }
  if (e.name === "RANDOM") {
    scope.report("E-SYN-NOT-SUPPORTED", e.nameSpan, {
      feature: "RANDOM",
      advice: "Random numbers arrive in a later version of Sudocode.",
    });
    return { ty: UNKNOWN };
  }
  scope.report("E-CHK-UNKNOWN-FUNCTION", e.nameSpan, { name: e.name }); // Q-EDX-4: no other built-ins
  return { ty: UNKNOWN };
}

/** The type of an expression, reporting its mistakes. */
export function check(scope: Scope, e: Expr): Typed {
  switch (e.kind) {
    case "int":
      return { ty: INTEGER };
    case "real":
      return { ty: REAL };
    case "string":
      return { ty: STRING, oneCharacter: Array.from(e.value).length === 1 };
    case "bool":
      return { ty: BOOLEAN };
    case "name": {
      const t = scope.typeOf(e.name);
      if (t === undefined) {
        unknownName(scope, e.name, e.span);
        return { ty: UNKNOWN };
      }
      return { ty: t };
    }
    case "paren":
      return check(scope, e.inner);
    case "unary": {
      const t = check(scope, e.operand).ty;
      if (isUnknown(t)) return { ty: UNKNOWN };
      if (e.op === "-") {
        if (isNumber(t)) return { ty: t };
        scope.report("E-CHK-OPERAND-TYPE", e.opSpan, { operator: "-", type: typeName(t) }, "arithmetic");
        return { ty: UNKNOWN };
      }
      if (t.kind === "BOOLEAN") return { ty: BOOLEAN };
      scope.report("E-CHK-OPERAND-TYPE", e.opSpan, { operator: "NOT", type: typeName(t) }, "logic");
      return { ty: UNKNOWN };
    }
    case "binary":
      return binary(scope, e);
    case "index": {
      const target = check(scope, e.target).ty;
      const index = check(scope, e.index).ty;
      const name = scope.text(e.target.span);
      if (!isUnknown(index) && index.kind !== "INTEGER") {
        scope.report("E-CHK-NEEDS-INTEGER", e.index.span, { type: withArticle(index), name }, "index");
        return { ty: UNKNOWN };
      }
      if (target.kind === "ARRAY") return { ty: target.of };
      if (isText(target)) return { ty: CHARACTER }; // EDX-22: Name[0] is a CHARACTER
      if (!isUnknown(target)) scope.report("E-CHK-NOT-INDEXABLE", e.target.span, { name, type: withArticle(target) });
      return { ty: UNKNOWN };
    }
    case "array": {
      // EDX-25: every element has the first element's type.
      const types = e.elements.map((el) => check(scope, el));
      let shared: Ty = UNKNOWN;
      const first = types[0];
      for (const [i, t] of types.entries()) {
        const common = commonElement({ ty: shared }, t);
        const element = e.elements[i];
        if (common === null) {
          if (element !== undefined && first !== undefined) {
            scope.report("E-CHK-ARRAY-MIXED", element.span, {
              actual: withArticle(t.ty),
              expected: withArticle(first.ty),
            });
          }
          return { ty: arrayOf(UNKNOWN) };
        }
        shared = common;
      }
      return { ty: arrayOf(shared) };
    }
    case "call":
      return call(scope, e);
    default: {
      const unreachable: never = e;
      throw new Error(`Unknown expression ${JSON.stringify(unreachable)}`);
    }
  }
}

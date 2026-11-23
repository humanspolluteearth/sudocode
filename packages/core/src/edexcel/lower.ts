// Lowering: the checked Edexcel AST -> the shared core IR.
//
// Compiler concept: *lowering* translates a language's own constructs into a smaller, more explicit language.
// Here each Edexcel rule becomes a named IR rule: DIV is `intDivFloor` (SH-10), / is `divReal` (EDX-14), FOR is
// `forInclusive` (EDX-53), writing past the end of an array is `growOnWrite` (EDX-27), indexes have `base` 0
// (EDX-22). Spans are copied across, so runtime errors still point at the student's code. Lowering only runs on a
// program with no errors, so it never reports anything itself.
import type {
  BinaryOp,
  Expr as IrExpr,
  InputConversion,
  Program as IrProgram,
  Stmt as IrStmt,
  VarRef,
} from "../ir/ir.ts";
import type { BinaryOperator, Expr, Program, Stmt, Target, TypeName } from "./ast.ts";
import type { Ty } from "./types.ts";

const BINARY: Partial<Record<BinaryOperator, BinaryOp>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "divReal",
  DIV: "intDivFloor",
  MOD: "modFloor",
  "^": "powIntIfNonNegative",
  "&": "concatText",
  "=": "eq",
  "<>": "ne",
  "<": "lt",
  "<=": "le",
  ">": "gt",
  ">=": "ge",
};

/** How each RECEIVE type converts the typed line (EDX-72, SH-06). */
const CONVERT: Readonly<Record<TypeName, InputConversion>> = {
  INTEGER: "int",
  REAL: "real",
  BOOLEAN: "bool",
  CHARACTER: "char",
  STRING: "str",
};

export function lowerProgram(program: Program, source: string, types: ReadonlyMap<string, Ty>): IrProgram {
  const text = (e: { span: { start: number; end: number } }): string => source.slice(e.span.start, e.span.end);
  // In M2 every Edexcel variable is a global (EDX-28); subprograms and their locals arrive in M5.
  const variable = (name: string, span: VarRef["span"]): VarRef => ({ kind: "var", name, scope: "global", span });

  /** A one-character literal going into a CHARACTER becomes a CHARACTER value (EDX-15). */
  const valueFor = (into: Ty | undefined, value: Expr): IrExpr => {
    const e = expr(value);
    if (into?.kind === "CHARACTER" && e.kind === "literal" && e.value.kind === "str") {
      return { ...e, value: { kind: "char", value: e.value.value } };
    }
    return e;
  };

  const expr = (e: Expr): IrExpr => {
    switch (e.kind) {
      case "int": {
        const value = Number(e.text);
        // SH-07: a literal beyond the INTEGER range is the "number too large" runtime error where it is evaluated.
        if (!Number.isSafeInteger(value))
          return { kind: "fail", code: "E-RUN-NUMBER-TOO-LARGE", args: {}, span: e.span };
        return { kind: "literal", value: { kind: "int", value }, span: e.span };
      }
      case "real":
        return { kind: "literal", value: { kind: "real", value: Number(e.text) }, span: e.span };
      case "string":
        return { kind: "literal", value: { kind: "str", value: e.value }, span: e.span };
      case "bool":
        return { kind: "literal", value: { kind: "bool", value: e.value }, span: e.span };
      case "name":
        return variable(e.name, e.span);
      case "paren":
        return expr(e.inner);
      case "unary":
        return { kind: "unary", op: e.op === "-" ? "negate" : "not", operand: expr(e.operand), span: e.opSpan };
      case "binary": {
        if (e.op === "AND" || e.op === "OR") {
          const op = e.op === "AND" ? "andThen" : "orElse";
          return { kind: "logical", op, left: expr(e.left), right: expr(e.right), span: e.opSpan };
        }
        const op = BINARY[e.op];
        if (op === undefined) throw new Error(`No IR operator for ${e.op}`);
        return { kind: "binary", op, symbol: e.op, left: expr(e.left), right: expr(e.right), span: e.opSpan };
      }
      case "index":
        return {
          kind: "index",
          target: expr(e.target),
          index: expr(e.index),
          base: 0,
          text: text(e.target),
          span: e.span,
        };
      case "array":
        return { kind: "arrayLiteral", elements: e.elements.map(expr), span: e.span };
      case "call":
        if (e.name !== "LENGTH") throw new Error(`${e.name} should have been rejected by the checker`);
        return { kind: "builtin", name: "length", args: e.args.map(expr), span: e.span };
      default: {
        const unreachable: never = e;
        throw new Error(`Unknown expression ${JSON.stringify(unreachable)}`);
      }
    }
  };

  const target = (t: Target): Extract<IrStmt, { kind: "assign" }>["target"] =>
    t.kind === "name"
      ? variable(t.name, t.span)
      : {
          kind: "element",
          array: variable(t.name, t.nameSpan),
          index: expr(t.index),
          base: 0,
          growOnWrite: true, // EDX-27
          text: t.name,
          span: t.span,
        };

  const elementType = (t: Target): Ty | undefined => {
    const ty = types.get(t.name);
    if (t.kind === "name") return ty;
    return ty?.kind === "ARRAY" ? ty.of : undefined;
  };

  const block = (stmts: readonly Stmt[]): IrStmt[] => stmts.flatMap(statement);

  const statement = (s: Stmt): IrStmt[] => {
    switch (s.kind) {
      case "set":
        return [
          { kind: "assign", target: target(s.target), value: valueFor(elementType(s.target), s.value), span: s.span },
        ];
      case "send": {
        const [value] = s.values;
        if (value === undefined) return [];
        return [{ kind: "output", value: expr(value), device: s.device === "DISPLAY" ? null : s.device, span: s.span }];
      }
      case "receive": {
        if (s.type === null) throw new Error("A RECEIVE without a type should have been rejected by the checker");
        const device = s.device === "KEYBOARD" ? null : s.device;
        const target = variable(s.name, s.nameSpan);
        return [{ kind: "input", target, convert: CONVERT[s.type], device, span: s.span }];
      }
      case "const":
        return []; // the type is the checker's business; the value comes from its SET
      case "bareAssign":
        throw new Error("A bare assignment should have been rejected by the checker");
      case "if":
        return [{ kind: "if", condition: expr(s.condition), then: block(s.then), else: block(s.else), span: s.span }];
      case "while":
        return [{ kind: "while", condition: expr(s.condition), body: block(s.body), span: s.span }];
      case "repeatUntil":
        return [{ kind: "repeatUntil", body: block(s.body), condition: expr(s.condition), span: s.span }];
      case "repeatTimes":
        return [{ kind: "repeatTimes", count: expr(s.count), body: block(s.body), span: s.span }];
      case "for":
        return [
          {
            kind: "forInclusive",
            variable: variable(s.name, s.nameSpan),
            start: expr(s.start),
            end: expr(s.end),
            step: s.step === null ? null : expr(s.step),
            body: block(s.body),
            span: s.span,
          },
        ];
      case "forEach":
        return [
          {
            kind: "forEach",
            variable: variable(s.name, s.nameSpan),
            iterable: expr(s.iterable),
            body: block(s.body),
            span: s.span,
          },
        ];
      default: {
        const unreachable: never = s;
        throw new Error(`Unknown statement ${JSON.stringify(unreachable)}`);
      }
    }
  };

  return { format: "pseudocode", main: block(program.body), subprograms: {} };
}

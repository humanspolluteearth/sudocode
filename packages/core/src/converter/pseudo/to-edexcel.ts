// Cambridge IR to Edexcel text (CNV-20..24).
//
// Compiler concept: *erasing declarations*. Edexcel has no DECLARE, so the declared types are dropped, except where a
// value needs one: a typed RECEIVE reads the type from the IR's input conversion, and an array becomes a filled literal.
import type { Expr, Program, Stmt, Subprogram } from "../../ir/ir.ts";
import type { Comments } from "./comments.ts";
import { expr, Refuse, target, type Cx } from "./expr.ts";

const INDENT = "    ";
const indent = (lines: string[]): string[] => lines.map((l) => INDENT + l);
type Lines = string[];
const refuseAt = (
  s: { span: { line: number; column: number } },
  why: ConstructorParameters<typeof Refuse>[0],
  d?: string,
): never => {
  throw new Refuse(why, s.span.line, s.span.column, d);
};
const FILL: Record<string, string> = { int: "0", real: "0.0", str: "''", bool: "FALSE" };
const RECEIVE: Record<string, string> = {
  int: "INTEGER",
  real: "REAL",
  bool: "BOOLEAN",
  char: "STRING",
  str: "STRING",
};

function block(body: Stmt[], cx: Cx, c: Comments): Lines {
  return body.flatMap((s) => [...c.before(s), ...one(s, cx, c)]);
}

function one(s: Stmt, cx: Cx, c: Comments): Lines {
  const e = (x: Expr): string => expr(x, cx).text;
  switch (s.kind) {
    case "assign": {
      if (s.value.kind === "newArray") {
        if (s.value.dims.length !== 1) return refuseAt(s, "multi-array");
        if (s.target.kind !== "var") return refuseAt(s, "multi-array");
        const name = s.target.name;
        const ty = cx.types.typeOf(s.target, cx.sub);
        const fill = FILL[ty.slice(1, -1)];
        if (!ty.startsWith("[") || ty.startsWith("[[") || fill === undefined) return refuseAt(s, "unknown-type", name);
        const [n = 0] = s.value.dims;
        return [`SET ${cx.names.of(name)} TO [${Array<string>(n).fill(fill).join(", ")}]`];
      }
      return [`SET ${target(s.target, cx)} TO ${e(s.value)}`];
    }
    case "output":
      return s.device === null ? [`SEND ${e(s.value)} TO DISPLAY`] : refuseAt(s, "devices");
    case "input": {
      if (s.prompt !== undefined) return refuseAt(s, "prompt");
      const kind = RECEIVE[s.convert] ?? "STRING";
      if (s.target.kind === "element") {
        // RECEIVE only fills a plain variable, so an array item goes through a made-up one.
        const temp = cx.names.fresh("input");
        return [`RECEIVE ${temp} FROM (${kind}) KEYBOARD`, `SET ${target(s.target, cx)} TO ${temp}`];
      }
      return [`RECEIVE ${target(s.target, cx)} FROM (${kind}) KEYBOARD`];
    }
    case "if": {
      const lines = [`IF ${e(s.condition)} THEN`, ...indent(block(s.then, cx, c))];
      if (s.else.length > 0) lines.push("ELSE", ...indent(block(s.else, cx, c)));
      return [...lines, "END IF"];
    }
    case "while":
      return [`WHILE ${e(s.condition)} DO`, ...indent(block(s.body, cx, c)), "END WHILE"];
    case "repeatUntil":
      return ["REPEAT", ...indent(block(s.body, cx, c)), `UNTIL ${e(s.condition)}`];
    case "forInclusive": {
      const step = s.step === null ? "" : ` STEP ${e(s.step)}`;
      const head = `FOR ${cx.names.of(s.variable.name)} FROM ${e(s.start)} TO ${e(s.end)}${step} DO`;
      return [head, ...indent(block(s.body, cx, c)), "END FOR"];
    }
    case "callStatement":
      return [`${cx.names.of(s.callee)}(${s.args.map(e).join(", ")})`];
    case "return":
      return [s.value === null ? "RETURN" : `RETURN ${e(s.value)}`];
    default:
      return refuseAt(s, "problems");
  }
}

function printSub(sub: Subprogram, cx: Cx, c: Comments): Lines {
  cx.sub = sub.name;
  const word = sub.kind === "procedure" ? "PROCEDURE" : "FUNCTION";
  const params = sub.params.map((p) => cx.names.of(p));
  for (const [i, p] of sub.params.entries()) {
    if (cx.types.paramType(sub.name, p).startsWith("[")) refuseAt(sub, "multi-array", params[i]);
  }
  const body = block(sub.body, cx, c);
  cx.sub = null;
  return [
    ...c.before(sub),
    `${word} ${cx.names.of(sub.name)}(${params.join(", ")})`,
    `BEGIN ${word}`,
    ...indent(body),
    `END ${word}`,
  ];
}

export function printProgramEdexcel(program: Program, cx: Cx, c: Comments): string {
  const subs = Object.values(program.subprograms).map((s) => printSub(s, cx, c).join("\n"));
  const main = [...block(program.main, cx, c), ...c.tail()];
  return [...subs, main.join("\n")].filter((p) => p !== "").join("\n\n");
}

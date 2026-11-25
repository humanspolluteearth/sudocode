// Edexcel IR to Cambridge text (CNV-10..16).
//
// Compiler concept: *hoisting declarations*. Cambridge wants every variable DECLAREd with a type; the IR has none, so
// the types come from `Types` (static inference) and the DECLAREs are printed at the top of each scope.
import type { Expr, Program, Stmt, Subprogram } from "../../ir/ir.ts";
import { expr, Refuse, target, type Cx } from "./expr.ts";
import type { Comments } from "./comments.ts";

const INDENT = "  ";
const indent = (lines: string[]): string[] => lines.map((l) => INDENT + l);
const TYPE: Record<string, string> = { int: "INTEGER", real: "REAL", bool: "BOOLEAN", str: "STRING" };

type Lines = string[];
const refuseAt = (
  s: { span: { line: number; column: number } },
  why: ConstructorParameters<typeof Refuse>[0],
  d?: string,
): never => {
  throw new Refuse(why, s.span.line, s.span.column, d);
};

/** Records `a <- [..]` sizes in a scope; a second different size means the array grows, which Cambridge cannot do. */
function scanSizes(body: Stmt[], sub: string, cx: Cx): void {
  for (const s of body) {
    if (s.kind === "assign" && s.target.kind === "var" && s.value.kind === "arrayLiteral") {
      const key = `${sub}:${s.target.name}`;
      const n = s.value.elements.length;
      const had = cx.sizes.get(key);
      if (n === 0 || (had !== undefined && had !== n)) refuseAt(s, "growing-array");
      cx.sizes.set(key, n);
    }
    if ("body" in s && Array.isArray(s.body)) scanSizes(s.body as Stmt[], sub, cx);
    if (s.kind === "if") {
      scanSizes(s.then, sub, cx);
      scanSizes(s.else, sub, cx);
    }
  }
}

function declares(
  vars: [string, string][],
  sub: string,
  cx: Cx,
  at: { span: { line: number; column: number } },
): Lines {
  const out: Lines = [];
  for (const [name, ty] of vars) {
    const shown = cx.names.of(name);
    if (ty.startsWith("[")) {
      const size = cx.sizes.get(`${sub}:${name}`);
      const item = TYPE[ty.slice(1, -1)];
      if (ty.startsWith("[[")) refuseAt(at, "multi-array");
      if (size === undefined || item === undefined) return refuseAt(at, "unknown-type", shown);
      out.push(`DECLARE ${shown} : ARRAY[0:${String(size - 1)}] OF ${item}`);
    } else {
      const t = TYPE[ty];
      if (t === undefined) refuseAt(at, "unknown-type", shown);
      out.push(`DECLARE ${shown} : ${String(t)}`);
    }
  }
  return out;
}

export function printStmt(s: Stmt, cx: Cx, c: Comments): Lines {
  cx.pre.length = 0;
  const lines = body1(s, cx, c);
  const pre = cx.pre.splice(0);
  return [...c.before(s), ...pre, ...lines];
}

function block(body: Stmt[], cx: Cx, c: Comments): Lines {
  return body.flatMap((s) => printStmt(s, cx, c));
}

function withLift<T>(cx: Cx, on: boolean, f: () => T): T {
  const old = cx.canLift;
  cx.canLift = on;
  try {
    return f();
  } finally {
    cx.canLift = old;
  }
}

function counted(s: Extract<Stmt, { kind: "forEach" }>, cx: Cx, c: Comments): Lines {
  const name = cx.names.of(s.variable.name);
  const ty = cx.types.typeOf(s.iterable, cx.sub);
  const it = withLift(cx, false, () => expr(s.iterable, cx).text);
  const i = cx.names.fresh("i");
  cx.extra.push([i, "INTEGER"]);
  if (ty === "str") {
    return [
      `FOR ${i} <- 1 TO LENGTH(${it})`,
      ...indent([`${name} <- MID(${it}, ${i}, 1)`, ...block(s.body, cx, c)]),
      `NEXT ${i}`,
    ];
  }
  const size = s.iterable.kind === "var" ? cx.sizes.get(`${cx.sub ?? ""}:${s.iterable.name}`) : undefined;
  if (size === undefined) return refuseAt(s, "unknown-type", "this array");
  return [
    `FOR ${i} <- 0 TO ${String(size - 1)}`,
    ...indent([`${name} <- ${it}[${i}]`, ...block(s.body, cx, c)]),
    `NEXT ${i}`,
  ];
}

function body1(s: Stmt, cx: Cx, c: Comments): Lines {
  const e = (x: Expr, lift = true): string => withLift(cx, lift, () => expr(x, cx).text);
  switch (s.kind) {
    case "assign": {
      if (s.value.kind === "arrayLiteral") {
        if (s.target.kind !== "var") return refuseAt(s, "multi-array");
        const name = cx.names.of(s.target.name);
        return s.value.elements.map((x, i) => `${name}[${String(i)}] <- ${e(x)}`);
      }
      if (
        s.target.kind === "element" &&
        s.target.growOnWrite &&
        s.target.index.kind === "literal" &&
        s.target.index.value.kind === "int"
      ) {
        const size = cx.sizes.get(`${cx.sub ?? ""}:${s.target.array.name}`);
        if (size !== undefined && s.target.index.value.value >= size) return refuseAt(s, "growing-array");
      }
      return [`${target(s.target, cx)} <- ${e(s.value)}`];
    }
    case "output":
      if (s.device !== null) return refuseAt(s, "devices");
      return [`OUTPUT ${e(s.value)}`];
    case "input":
      return [`INPUT ${target(s.target, cx)}`];
    case "if": {
      const lines = [`IF ${e(s.condition, false)} THEN`, ...indent(block(s.then, cx, c))];
      if (s.else.length > 0) lines.push("ELSE", ...indent(block(s.else, cx, c)));
      return [...lines, "ENDIF"];
    }
    case "while":
      return [`WHILE ${e(s.condition, false)} DO`, ...indent(block(s.body, cx, c)), "ENDWHILE"];
    case "repeatUntil":
      return ["REPEAT", ...indent(block(s.body, cx, c)), `UNTIL ${e(s.condition, false)}`];
    case "repeatTimes": {
      const i = cx.names.fresh("i");
      cx.extra.push([i, "INTEGER"]);
      return [`FOR ${i} <- 1 TO ${e(s.count, false)}`, ...indent(block(s.body, cx, c)), `NEXT ${i}`];
    }
    case "forInclusive": {
      const v = cx.names.of(s.variable.name);
      const step = s.step === null ? "" : ` STEP ${e(s.step, false)}`;
      return [
        `FOR ${v} <- ${e(s.start, false)} TO ${e(s.end, false)}${step}`,
        ...indent(block(s.body, cx, c)),
        `NEXT ${v}`,
      ];
    }
    case "forEach":
      return counted(s, cx, c);
    case "callStatement":
      return [`CALL ${cx.names.of(s.callee)}(${s.args.map((a) => e(a, false)).join(", ")})`];
    case "return":
      return [s.value === null ? "RETURN" : `RETURN ${e(s.value, false)}`];
    default:
      return refuseAt(s, "problems");
  }
}

function printSub(sub: Subprogram, cx: Cx, c: Comments): Lines {
  cx.sub = sub.name;
  cx.extra.length = 0;
  scanSizes(sub.body, sub.name, cx);
  const params = sub.params.map((p) => {
    const t = TYPE[cx.types.paramType(sub.name, p)];
    if (t === undefined) return refuseAt(sub, "unknown-type", cx.names.of(p));
    return `${cx.names.of(p)} : ${t}`;
  });
  const body = block(sub.body, cx, c);
  const decls = declares(
    [
      ...cx.types.localVars(sub.name),
      ...cx.extra.map(([n, t]) => [n, t === "INTEGER" ? "int" : "str"] as [string, string]),
    ],
    sub.name,
    cx,
    sub,
  );
  cx.sub = null;
  const name = cx.names.of(sub.name);
  const head =
    sub.kind === "procedure"
      ? `PROCEDURE ${name}(${params.join(", ")})`
      : `FUNCTION ${name}(${params.join(", ")}) RETURNS ${TYPE[cx.types.returnType(sub.name)] ?? refuseAt(sub, "unknown-type", name)}`;
  return [
    ...c.before(sub),
    head,
    ...indent([...decls, ...body]),
    sub.kind === "procedure" ? "ENDPROCEDURE" : "ENDFUNCTION",
  ];
}

export function printProgramCie(program: Program, cx: Cx, c: Comments): string {
  // The main program is printed first so its made-up variables are known, but its DECLAREs go before the
  // subprograms: Cambridge wants a global declared before any subprogram that uses it.
  cx.sub = null;
  cx.extra.length = 0;
  scanSizes(program.main, "", cx);
  const main = block(program.main, cx, c);
  const decls = declares(
    [...cx.types.globalVars(), ...cx.extra.map(([n, t]) => [n, t === "INTEGER" ? "int" : "str"] as [string, string])],
    "",
    cx,
    program.main[0] ?? { span: { line: 1, column: 1 } }, // an empty program: nothing to point at, so line 1,
  );
  const subs = Object.values(program.subprograms).map((s) => printSub(s, cx, c).join("\n"));
  const top = [...decls, ...(subs.length > 0 && decls.length > 0 ? [""] : [])].join("\n");
  const rest = [...subs, [...main, ...c.tail()].join("\n")].filter((p) => p !== "");
  return subs.length === 0 ? [top, ...rest].filter((p) => p !== "").join("\n") : [top, rest.join("\n\n")].join("\n");
}

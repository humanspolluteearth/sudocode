// Printing IR statements and subprograms as indented Python lines.
import type { Expr, Program, Stmt, Subprogram } from "../ir/ir.ts";
import { expr, printable, target, Unprintable } from "./expr.ts";
import { use, type Cx } from "./helpers.ts";
import { pyName } from "./names.ts";

const INDENT = "    ";

type Lines = string[];

const indent = (lines: Lines): Lines => lines.map((line) => INDENT + line);

function block(body: Stmt[], cx: Cx): Lines {
  const lines = body.flatMap((s) => stmt(s, cx));
  return lines.length === 0 ? ["pass"] : lines;
}

/** Names this statement writes that live outside the subprogram, so the `def` can say `global`. */
function noteWrite(t: { kind: string; scope?: string; name?: string }, cx: Cx): void {
  if (t.kind === "var" && t.scope === "global" && t.name !== undefined) cx.globalsWritten.add(pyName(t.name));
}

/** `1 + n` for `range`, folded when `n` is a number written in the program. */
function plusOne(e: Expr, by: 1 | -1, cx: Cx): string {
  if (e.kind === "literal" && e.value.kind === "int") return String(e.value.value + by);
  const inner = expr(e, cx);
  const text = inner.prec < 5 ? `(${inner.text})` : inner.text;
  return `${text} ${by === 1 ? "+" : "-"} 1`;
}

function forRange(s: Extract<Stmt, { kind: "forInclusive" }>, cx: Cx): string {
  const start = expr(s.start, cx).text;
  if (s.step === null) return `range(${start}, ${plusOne(s.end, 1, cx)})`;
  if (s.step.kind === "literal" && s.step.value.kind === "int" && s.step.value.value !== 0) {
    const step = s.step.value.value;
    const end = plusOne(s.end, step > 0 ? 1 : -1, cx);
    return step === 1 ? `range(${start}, ${end})` : `range(${start}, ${end}, ${String(step)})`;
  }
  use(cx, "range"); // the sign of the step is only known when the program runs
  return `_range(${start}, ${expr(s.end, cx).text}, ${expr(s.step, cx).text})`;
}

function conditional(s: Extract<Stmt, { kind: "if" }>, cx: Cx, word: "if" | "elif"): Lines {
  const lines = [`${word} ${expr(s.condition, cx).text}:`, ...indent(block(s.then, cx))];
  const [only] = s.else;
  if (s.else.length === 1 && only?.kind === "if") return [...lines, ...conditional(only, cx, "elif")];
  if (s.else.length > 0) lines.push("else:", ...indent(block(s.else, cx)));
  return lines;
}

function input(s: Extract<Stmt, { kind: "input" }>): string {
  const ask = s.prompt === undefined ? "" : JSON.stringify(s.prompt);
  switch (s.convert) {
    case "int":
      return `int(input(${ask}))`;
    case "real":
      return `float(input(${ask}))`;
    case "bool":
      return `input(${ask}).strip().upper() == "TRUE"`;
    case "char":
    case "str":
      return `input(${ask})`;
    default: {
      const never: never = s.convert;
      throw new Unprintable(String(never));
    }
  }
}

export function stmt(s: Stmt, cx: Cx): Lines {
  switch (s.kind) {
    case "assign": {
      noteWrite(s.target, cx);
      const value = expr(s.value, cx).text;
      if (s.target.kind === "element" && s.target.growOnWrite) {
        use(cx, "put"); // writing just past the end makes the array longer (EDX-27)
        const { index, base, index2 } = s.target;
        const at = (i: Expr, b: number): string => (b === 0 ? expr(i, cx).text : `${expr(i, cx).text} - ${String(b)}`);
        const row = pyName(s.target.array.name);
        if (index2 !== undefined)
          return [`_put(${row}[${at(index, base)}], ${at(index2, s.target.base2 ?? base)}, ${value})`];
        return [`_put(${row}, ${at(index, base)}, ${value})`];
      }
      return [`${target(s.target, cx)} = ${value}`];
    }
    case "output":
      return [`print(${printable(s.value, cx)})`];
    case "input":
      noteWrite(s.target, cx);
      return [`${target(s.target, cx)} = ${input(s)}`];
    case "if":
      return conditional(s, cx, "if");
    case "while":
      return [`while ${expr(s.condition, cx).text}:`, ...indent(block(s.body, cx))];
    case "repeatUntil": {
      // Python has no test-at-the-end loop: loop forever and leave when the condition is TRUE.
      const body = s.body.flatMap((b) => stmt(b, cx));
      return ["while True:", ...indent([...body, `if ${expr(s.condition, cx).text}:`, `${INDENT}break`])];
    }
    case "repeatTimes":
      return [`for _ in range(${expr(s.count, cx).text}):`, ...indent(block(s.body, cx))];
    case "forInclusive":
      noteWrite(s.variable, cx);
      return [`for ${pyName(s.variable.name)} in ${forRange(s, cx)}:`, ...indent(block(s.body, cx))];
    case "forEach":
      noteWrite(s.variable, cx);
      return [`for ${pyName(s.variable.name)} in ${expr(s.iterable, cx).text}:`, ...indent(block(s.body, cx))];
    case "callStatement":
      return [`${pyName(s.callee)}(${s.args.map((a) => expr(a, cx).text).join(", ")})`];
    case "return":
      return [s.value === null ? "return" : `return ${expr(s.value, cx).text}`];
    default:
      throw new Unprintable(s.kind); // files, TRY and Python statements were refused earlier
  }
}

export function printSubprogram(sub: Subprogram, cx: Cx): Lines {
  cx.sub = sub.name; // so names inside are looked up among this subprogram's own variables
  const outer = new Set(cx.globalsWritten);
  cx.globalsWritten.clear();
  const body = block(sub.body, cx);
  const globals = [...cx.globalsWritten].sort();
  cx.globalsWritten.clear();
  for (const name of outer) cx.globalsWritten.add(name);
  cx.sub = null;
  const head = `def ${pyName(sub.name)}(${sub.params.map(pyName).join(", ")}):`;
  return [head, ...indent([...(globals.length > 0 ? [`global ${globals.join(", ")}`] : []), ...body])];
}

export function printProgram(program: Program, cx: Cx): string {
  const parts: string[] = [];
  for (const sub of Object.values(program.subprograms)) parts.push(printSubprogram(sub, cx).join("\n"));
  cx.globalsWritten.clear();
  const main = program.main.flatMap((s) => stmt(s, cx));
  if (main.length > 0) parts.push(main.join("\n"));
  return parts.join("\n\n\n");
}

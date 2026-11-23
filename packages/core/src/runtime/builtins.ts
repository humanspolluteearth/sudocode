// Cambridge 9618 built-in functions (CIE-120 to CIE-129). The checker has already made sure each call has the
// right number and types of arguments, so only the VALUE of an argument can still be wrong here (the insert says
// both are errors): that is the runtime error E-RUN-BAD-ARGUMENT, reported at the call.
import type { Span } from "../diagnostics.ts";
import type { BuiltinName } from "../ir/ir.ts";
import type { Machine } from "./evaluate.ts";
import { formatValue } from "./format.ts";
import { RunError } from "./run-error.ts";
import { characters, char, int, real, str, type Value } from "./values.ts";

const NUMBER = /^-?\d+(\.\d+)?$/; // CIE-125: an optional '-', digits, and optionally a point with digits

const fail = (fn: string, span: Span, problem: string): RunError =>
  new RunError("E-RUN-BAD-ARGUMENT", span, { function: fn, problem });

function text(v: Value | undefined): string {
  if (v?.kind === "str" || v?.kind === "char") return v.value;
  throw new Error(`Expected text but got ${v?.kind ?? "nothing"}`);
}
function whole(v: Value | undefined): number {
  if (v?.kind === "int") return v.value;
  throw new Error(`Expected an INTEGER but got ${v?.kind ?? "nothing"}`);
}
function numeric(v: Value | undefined): number {
  if (v?.kind === "int" || v?.kind === "real") return v.value;
  throw new Error(`Expected a number but got ${v?.kind ?? "nothing"}`);
}
function date(v: Value | undefined): Extract<Value, { kind: "date" }> {
  if (v?.kind === "date") return v;
  throw new Error(`Expected a DATE but got ${v?.kind ?? "nothing"}`);
}

const daysIn = (month: number, year: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function cieBuiltin(
  name: Exclude<BuiltinName, "length" | "random">,
  args: Value[],
  span: Span,
  m: Machine,
): Value {
  const [a, b, c] = args;
  switch (name) {
    case "left":
    case "right": {
      const chars = characters(text(a));
      const n = whole(b);
      if (n < 0 || n > chars.length)
        throw fail(name.toUpperCase(), span, `${String(n)} characters from a STRING of ${String(chars.length)}`);
      return str((name === "left" ? chars.slice(0, n) : chars.slice(chars.length - n)).join(""));
    }
    case "mid": {
      const chars = characters(text(a));
      const start = whole(b);
      const n = whole(c);
      if (start < 1 || n < 0 || start - 1 + n > chars.length)
        throw fail(
          "MID",
          span,
          `${String(n)} characters from position ${String(start)} of a STRING of ${String(chars.length)}`,
        );
      return str(chars.slice(start - 1, start - 1 + n).join(""));
    }
    case "ucase":
    case "lcase":
    case "toUpper":
    case "toLower": {
      const s = text(a);
      const out = name === "ucase" || name === "toUpper" ? s.toUpperCase() : s.toLowerCase();
      // CIE-121/122: the result has the argument's type; a letter like ß that grows when upper-cased stays as it was.
      return a?.kind === "char" ? char(characters(out).length === 1 ? out : s) : str(out);
    }
    case "numToStr":
      return str(formatValue(a ?? int(0), m.format));
    case "strToNum": {
      const s = text(a);
      if (!NUMBER.test(s)) throw fail("STR_TO_NUM", span, `"${s}", which is not a number`);
      return real(Number(s)); // always REAL: the checker types the result REAL (an INTEGER fits into a REAL)
    }
    case "isNum":
      return { kind: "bool", value: NUMBER.test(text(a)) };
    case "asc": {
      const code = text(a).charCodeAt(0);
      if (code > 127) throw fail("ASC", span, `"${text(a)}", which is not an ASCII character`);
      return int(code);
    }
    case "chr": {
      const n = whole(a);
      if (n < 0 || n > 127) throw fail("CHR", span, `${String(n)}, which is not an ASCII code (0 to 127)`);
      return char(String.fromCharCode(n));
    }
    case "truncate":
      return int(Math.trunc(numeric(a)));
    case "randomReal": {
      const x = numeric(a);
      if (x < 0) throw fail("RAND", span, `${String(x)}, which is below 0`);
      return real(m.randomReal() * x);
    }
    case "day":
      return int(date(a).day);
    case "month":
      return int(date(a).month);
    case "year":
      return int(date(a).year);
    case "dayIndex": {
      const d = date(a);
      return int(new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 1); // Sunday = 1 (CIE-129)
    }
    case "setDate": {
      const [day, month, year] = [whole(a), whole(b), whole(c)];
      if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysIn(month, year))
        throw fail("SETDATE", span, `${String(day)}/${String(month)}/${String(year)}, which is not a real date`);
      return { kind: "date", day, month, year };
    }
    case "today":
      return { kind: "date", ...m.today() };
    default: {
      const unreachable: never = name;
      throw new Error(`Unknown built-in ${String(unreachable)}`);
    }
  }
}

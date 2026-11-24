// The small Python functions that converted programs carry with them, and the context that records which are needed.
//
// Compiler concept: a *runtime library* (helper preamble). When the converter can't tell (types.ts) whether `OUTPUT x`
// prints an INTEGER, a REAL or a BOOLEAN, it calls a helper that decides when the program runs. INTEGER and STRING
// values need no helper. Only the helpers a program actually uses are written out.

import type { Types } from "./types.ts";

export interface Cx {
  /** What the converter knows about the type of each expression (types.ts). */
  types: Types;
  /** The subprogram being printed, or null for the main program (so a local name is looked up in the right place). */
  sub: string | null;
  helpers: Set<HelperName>;
  imports: Set<string>;
  /** The names a function assigns that live outside it (they need a `global` line). */
  globalsWritten: Set<string>;
}

export type HelperName = "show" | "copy" | "put" | "right" | "mid" | "isNum" | "range";

export const newCx = (types: Types): Cx => ({
  types,
  sub: null,
  helpers: new Set(),
  imports: new Set(),
  globalsWritten: new Set(),
});

export const use = (cx: Cx, helper: HelperName): void => void cx.helpers.add(helper);

// `_show` is formatPseudocodeReal (runtime/format.ts) written in Python: round to 10 places, shortest digits, never an
// exponent for a number of 1 or more, and TRUE / FALSE for booleans (SH-03, SH-04).
const SOURCES: Record<HelperName, string> = {
  show: `def _show(value):
    if value is True:
        return "TRUE"
    if value is False:
        return "FALSE"
    if not isinstance(value, float):
        return str(value)
    value = round(value, 10)
    if value == 0:
        return "0"
    text = repr(value)
    sign = ""
    if text[0] == "-":
        sign = "-"
        text = text[1:]
    mantissa, _, exponent = text.partition("e")
    whole, _, fraction = mantissa.partition(".")
    digits = whole + fraction
    point = len(whole) + (int(exponent) if exponent else 0)
    trimmed = digits.lstrip("0")
    point = point - (len(digits) - len(trimmed))
    digits = trimmed.rstrip("0")
    if point >= 1:
        if point >= len(digits):
            return sign + digits + "0" * (point - len(digits))
        return sign + digits[:point] + "." + digits[point:]
    return sign + "0." + "0" * (-point) + digits`,
  copy: `def _copy(items):
    return [_copy(item) if isinstance(item, list) else item for item in items]`,
  put: `def _put(items, index, value):
    while len(items) <= index:
        items.append(None)
    items[index] = value`,
  right: `def _right(text, count):
    return text[len(text) - count:]`,
  mid: `def _mid(text, start, count):
    return text[start - 1:start - 1 + count]`,
  isNum: `def _is_num(text):
    body = text[1:] if text.startswith("-") else text
    whole, dot, fraction = body.partition(".")
    for part in (whole, fraction):
        for letter in part:
            if letter not in "0123456789":
                return False
    return whole != "" and (dot == "" or fraction != "")`,
  range: `def _range(start, end, step):
    if step > 0:
        return range(start, end + 1, step)
    return range(start, end - 1, step)`,
};

const ORDER: HelperName[] = ["show", "copy", "put", "right", "mid", "isNum", "range"];

/** The lines that go above the program: imports, then each helper that was used. Empty when none were. */
export function preamble(cx: Cx): string {
  const imports = [...cx.imports].sort().map((name) => `import ${name}`);
  const used = ORDER.filter((name) => cx.helpers.has(name));
  const blocks: string[] = [];
  if (imports.length > 0) blocks.push(imports.join("\n"));
  if (used.length > 0) {
    blocks.push(
      `# These helpers make Python print and calculate the way the pseudocode does.\n\n${used.map((n) => SOURCES[n]).join("\n\n\n")}`,
    );
  }
  return blocks.join("\n\n\n");
}

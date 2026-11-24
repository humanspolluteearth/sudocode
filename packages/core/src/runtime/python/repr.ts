// How Python values print: `str()` for print, `repr()` inside containers (PY-30, PY-31).
import type { Value } from "../values.ts";

/** Python's float repr: the shortest digits that round-trip, in fixed form for exponents -4..15 (PY-31). */
export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(x.toExponential());
  if (m === null) return String(x);
  const sign = m[1] ?? "";
  const digits = (m[2] ?? "") + (m[3] ?? "");
  const exp = Number(m[4]);
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) {
      const whole = digits.length > exp + 1 ? digits.slice(0, exp + 1) : digits.padEnd(exp + 1, "0");
      const frac = digits.slice(exp + 1);
      return `${sign}${whole}.${frac === "" ? "0" : frac}`;
    }
    return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  }
  const mant = digits.length > 1 ? `${digits[0] ?? ""}.${digits.slice(1)}` : digits;
  const e = Math.abs(exp) < 10 ? `0${String(Math.abs(exp))}` : String(Math.abs(exp));
  return `${sign}${mant}e${exp < 0 ? "-" : "+"}${e}`;
}

export function strRepr(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === quote || ch === "\\") out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (c < 32 || c === 127) out += `\\x${c.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return out + quote;
}

/** The Python class name of a value, as `type(x).__name__` shows it. */
export function pyTypeName(v: Value): string {
  switch (v.kind) {
    case "none":
      return "NoneType";
    case "bool":
      return "bool";
    case "pyint":
    case "int":
      return "int";
    case "real":
      return "float";
    case "str":
    case "char":
      return "str";
    case "list":
      return "list";
    case "tuple":
      return "tuple";
    case "dict":
      return "dict";
    case "set":
      return "set";
    case "range":
      return "range";
    case "func":
      return "function";
    case "builtin":
      return "builtin_function_or_method";
    case "type":
      return "type";
    case "exc":
      return v.name;
    case "class":
      return "type";
    case "file":
      return "TextIOWrapper";
    case "instance":
      return v.cls.name;
    case "bound":
      return "method";
    case "super":
      return "super";
    default:
      return v.kind;
  }
}

export type Orderer = (items: Value[]) => Value[];

/** `repr()` (inside containers and `!r`). `setItems` gives a set's items in CPython's order (hash.ts). */
export function pyRepr(v: Value, setItems: Orderer): string {
  switch (v.kind) {
    case "str":
    case "char":
      return strRepr(v.value);
    case "exc":
      return `${v.name}(${v.args.map((a) => pyRepr(a, setItems)).join(", ")})`;
    case "instance":
      return pyStr(v, setItems, true);
    default:
      return pyStr(v, setItems, true);
  }
}

/** `str()` (what print shows); with `inner` true it is the repr form used for container items. */
export function pyStr(v: Value, setItems: Orderer, inner = false): string {
  const rep = (x: Value): string => pyRepr(x, setItems);
  switch (v.kind) {
    case "none":
      return "None";
    case "bool":
      return v.value ? "True" : "False";
    case "pyint":
      return v.value.toString();
    case "int":
      return String(v.value);
    case "real":
      return floatRepr(v.value);
    case "str":
    case "char":
      return inner ? strRepr(v.value) : v.value;
    case "list":
      return `[${v.items.map(rep).join(", ")}]`;
    case "tuple":
      return v.items.length === 1 ? `(${rep(v.items[0] as Value)},)` : `(${v.items.map(rep).join(", ")})`;
    case "dict":
      return `{${[...v.map.values()].map((e) => `${rep(e.key)}: ${rep(e.value)}`).join(", ")}}`;
    case "set":
      return v.map.size === 0
        ? "set()"
        : `{${setItems([...v.map.values()])
            .map(rep)
            .join(", ")}}`;
    case "range":
      return v.step === 1n
        ? `range(${String(v.start)}, ${String(v.stop)})`
        : `range(${String(v.start)}, ${String(v.stop)}, ${String(v.step)})`;
    case "func":
      return `<function ${v.name}>`;
    case "builtin":
      return `<built-in function ${v.name}>`;
    case "type":
      return `<class '${v.name}'>`;
    case "exc":
      return inner ? `${v.name}(${v.args.map(rep).join(", ")})` : v.detail;
    case "class":
      return `<class '__main__.${v.name}'>`;
    case "file":
      return `<_io.TextIOWrapper name='${v.name}' mode='${v.mode}' encoding='UTF-8'>`;
    case "bound":
      return `<bound method ${pyStr(v.fn, setItems)}>`;
    case "instance": {
      // `shown` was filled by the student's __str__ / __repr__ before printing (see class-calls.ts).
      const custom = inner ? v.shown.repr : (v.shown.str ?? v.shown.repr);
      if (custom !== undefined) return custom;
      const args = v.attrs.get("args");
      if (v.cls.exc && args?.kind === "tuple") {
        if (inner) return `${v.cls.name}(${args.items.map(rep).join(", ")})`;
        if (args.items.length === 0) return "";
        return args.items.length === 1 ? pyStr(args.items[0] as Value, setItems) : rep(args);
      }
      return `<__main__.${v.cls.name} object at 0x7f0000000000>`;
    }
    case "env":
      return "<frame>";
    default:
      return `<${v.kind}>`;
  }
}

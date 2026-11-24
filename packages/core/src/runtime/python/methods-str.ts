// str methods (PY-31, PY-32).
import type { Span } from "../../diagnostics.ts";
import { bool, list, pyint, str, tuple, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { formatWithSpec } from "./format-spec.ts";
import { setOrder } from "./hash.ts";
import { asBig } from "./numbers.ts";
import { pyRepr, pyStr, pyTypeName } from "./repr.ts";
import { iterate } from "./seq.ts";

export interface CallArgs {
  args: Value[];
  kwargs: Map<string, Value>;
}

const text = (v: Value | undefined, what: string, span: Span): string => {
  if (v === undefined || (v.kind !== "str" && v.kind !== "char")) {
    throw typeError(`${what} must be str, not ${v === undefined ? "NoneType" : pyTypeName(v)}`, span);
  }
  return v.value;
};

const int = (v: Value | undefined, span: Span): number => {
  const n = v === undefined ? null : asBig(v);
  if (n === null)
    throw typeError(
      `'${v === undefined ? "NoneType" : pyTypeName(v)}' object cannot be interpreted as an integer`,
      span,
    );
  return Number(n);
};

const WS = /^[\s]+|[\s]+$/g;
function strip(s: string, chars: string | null, left: boolean, right: boolean): string {
  if (chars === null) return s.replace(left && right ? WS : left ? /^\s+/ : /\s+$/, "");
  const set = new Set(Array.from(chars));
  const cs = Array.from(s);
  let a = 0;
  let b = cs.length;
  if (left) while (a < b && set.has(cs[a] as string)) a++;
  if (right) while (b > a && set.has(cs[b - 1] as string)) b--;
  return cs.slice(a, b).join("");
}

/** `"{} {name} {0:>5} {!r}".format(...)`: also used for f-string-like replacement fields. */
export function strFormat(template: string, args: Value[], kwargs: Map<string, Value>, span: Span): string {
  let auto = 0;
  let out = "";
  for (let i = 0; i < template.length; i++) {
    const c = template[i] as string;
    if (c === "{" && template[i + 1] === "{") {
      out += "{";
      i++;
      continue;
    }
    if (c === "}" && template[i + 1] === "}") {
      out += "}";
      i++;
      continue;
    }
    if (c === "}") throw valueError("Single '}' encountered in format string", span);
    if (c !== "{") {
      out += c;
      continue;
    }
    const end = template.indexOf("}", i);
    if (end < 0) throw valueError("Single '{' encountered in format string", span);
    const field = template.slice(i + 1, end);
    i = end;
    const m = /^([^!:]*)(?:!([rsa]))?(?::(.*))?$/s.exec(field);
    const name = m?.[1] ?? "";
    let value: Value | undefined;
    if (name === "") {
      value = args[auto++];
      if (value === undefined)
        throw pyError(
          "IndexError",
          `Replacement index ${String(auto - 1)} out of range for positional args tuple`,
          span,
        );
    } else if (/^\d+$/.test(name)) {
      value = args[Number(name)];
      if (value === undefined)
        throw pyError("IndexError", `Replacement index ${name} out of range for positional args tuple`, span);
    } else {
      value = kwargs.get(name);
      if (value === undefined) throw pyError("KeyError", `'${name}'`, span);
    }
    if (m?.[2] === "r" || m?.[2] === "a") value = str(pyRepr(value, setOrder));
    else if (m?.[2] === "s") value = str(pyStr(value, setOrder));
    out += formatWithSpec(value, m?.[3] ?? "", span);
  }
  return out;
}

/** Returns undefined when `name` is not a str method. */
export function strMethod(s: string, name: string, { args, kwargs }: CallArgs, span: Span): Value | undefined {
  const a0 = args[0];
  switch (name) {
    case "upper":
      return str(s.toUpperCase());
    case "lower":
      return str(s.toLowerCase());
    case "strip":
    case "lstrip":
    case "rstrip":
      return str(
        strip(
          s,
          a0 === undefined || a0.kind === "none" ? null : text(a0, "strip arg", span),
          name !== "rstrip",
          name !== "lstrip",
        ),
      );
    case "split":
    case "rsplit": {
      const sepArg = a0 ?? kwargs.get("sep");
      const maxArg = args[1] ?? kwargs.get("maxsplit");
      const max = maxArg === undefined ? -1 : int(maxArg, span);
      if (sepArg === undefined || sepArg.kind === "none") {
        const parts = s.trim() === "" ? [] : s.trim().split(/\s+/);
        if (max >= 0 && parts.length > max + 1) {
          const words = s.trim().split(/\s+/);
          return list([...words.slice(0, max).map((w) => str(w)), str(s.trim().split(/\s+/).slice(max).join(" "))]);
        }
        return list(parts.map((p) => str(p)));
      }
      const sep = text(sepArg, "sep", span);
      if (sep === "") throw valueError("empty separator", span);
      const all = s.split(sep);
      if (max >= 0 && all.length > max + 1) {
        if (name === "split") return list([...all.slice(0, max), all.slice(max).join(sep)].map((p) => str(p)));
        return list([all.slice(0, all.length - max).join(sep), ...all.slice(all.length - max)].map((p) => str(p)));
      }
      return list(all.map((p) => str(p)));
    }
    case "splitlines":
      return list(
        s === ""
          ? []
          : s
              .replace(/\r?\n$/, "")
              .split(/\r?\n/)
              .map((p) => str(p)),
      );
    case "join": {
      if (a0 === undefined) throw typeError("str.join() takes exactly one argument (0 given)", span);
      const items = iterate(a0, span);
      return str(
        items
          .map((x, i) => {
            if (x.kind !== "str" && x.kind !== "char")
              throw typeError(`sequence item ${String(i)}: expected str instance, ${pyTypeName(x)} found`, span);
            return x.value;
          })
          .join(s),
      );
    }
    case "find":
    case "rfind":
    case "index":
    case "rindex": {
      const sub = text(a0, "must be str", span);
      const from = args[1] === undefined ? 0 : int(args[1], span);
      const i = name === "find" || name === "index" ? s.indexOf(sub, from) : s.lastIndexOf(sub);
      if (i < 0 && name.endsWith("index")) throw valueError("substring not found", span);
      return pyint(BigInt(i));
    }
    case "replace": {
      const [from, to] = [text(a0, "replace() argument 1", span), text(args[1], "replace() argument 2", span)];
      const count = args[2] === undefined ? -1 : int(args[2], span);
      if (count < 0) return str(from === "" ? s : s.split(from).join(to));
      let out = s;
      let pos = 0;
      for (let k = 0; k < count; k++) {
        const i = out.indexOf(from, pos);
        if (i < 0) break;
        out = out.slice(0, i) + to + out.slice(i + from.length);
        pos = i + to.length;
      }
      return str(out);
    }
    case "count": {
      const sub = text(a0, "must be str", span);
      return pyint(BigInt(sub === "" ? Array.from(s).length + 1 : s.split(sub).length - 1));
    }
    case "startswith":
    case "endswith": {
      const subs =
        a0 !== undefined && a0.kind === "tuple"
          ? a0.items.map((x) => text(x, "tuple item", span))
          : [text(a0, `${name} first arg`, span)];
      return bool(subs.some((p) => (name === "startswith" ? s.startsWith(p) : s.endsWith(p))));
    }
    case "isdigit":
      return bool(/^\d+$/.test(s));
    case "isdecimal":
    case "isnumeric":
      return bool(/^\d+$/.test(s));
    case "isalpha":
      return bool(/^\p{L}+$/u.test(s));
    case "isalnum":
      return bool(/^[\p{L}\p{N}]+$/u.test(s));
    case "isspace":
      return bool(/^\s+$/.test(s));
    case "isupper":
      return bool(/\p{Lu}/u.test(s) && s === s.toUpperCase());
    case "islower":
      return bool(/\p{Ll}/u.test(s) && s === s.toLowerCase());
    case "capitalize":
      return str(
        s === "" ? s : (Array.from(s)[0] as string).toUpperCase() + Array.from(s).slice(1).join("").toLowerCase(),
      );
    case "title":
      return str(s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase()));
    case "swapcase":
      return str(Array.from(s, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(""));
    case "center":
    case "ljust":
    case "rjust": {
      const width = int(a0, span);
      const fill = args[1] === undefined ? " " : text(args[1], "fill", span);
      const room = width - Array.from(s).length;
      if (room <= 0) return str(s);
      if (name === "ljust") return str(s + fill.repeat(room));
      if (name === "rjust") return str(fill.repeat(room) + s);
      const left = Math.floor(room / 2) + (room % 2 === 1 && width % 2 === 1 ? 1 : 0);
      return str(fill.repeat(left) + s + fill.repeat(room - left));
    }
    case "zfill": {
      const width = int(a0, span);
      const sign = /^[+-]/.test(s) ? s.slice(0, 1) : "";
      return str(sign + s.slice(sign.length).padStart(width - sign.length, "0"));
    }
    case "format":
      return str(strFormat(s, args, kwargs, span));
    case "partition": {
      const sep = text(a0, "sep", span);
      const i = s.indexOf(sep);
      return i < 0
        ? tuple([str(s), str(""), str("")])
        : tuple([str(s.slice(0, i)), str(sep), str(s.slice(i + sep.length))]);
    }
    default:
      return undefined;
  }
}

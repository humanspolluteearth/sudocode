// CIE PROCEDURE and FUNCTION definitions (CIE-70..78).
import type { Subprogram } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { CIE_RESERVED } from "./cursor.ts";
import type { Param, Signature } from "./env.ts";
import { SCALAR_TYPES, type Ty } from "./types.ts";
import type { Statements } from "./statements.ts";

/** Parses one definition into `out`. `collecting` is true on the first pass, which only gathers signatures. */
export function installSubprograms(s: Statements, out: Record<string, Subprogram>, collecting: boolean): void {
  const c = s.c;
  const env = s.env;

  const paramType = (): Ty => {
    const t = c.peek();
    const ty = t.kind === "word" ? (SCALAR_TYPES[t.text.toUpperCase()] ?? env.types.get(t.text)) : undefined;
    if (ty === undefined) return c.fail("a type", "Use INTEGER, REAL, CHAR, STRING or BOOLEAN.");
    c.next();
    return ty;
  };

  const params = (kind: "procedure" | "function"): Param[] => {
    const list: Param[] = [];
    if (!c.isSymbol("(")) return list;
    c.next();
    if (c.isSymbol(")")) {
      c.next();
      return list;
    }
    let byRef = false; // CIE-73: a mode keyword carries on to the parameters after it
    for (;;) {
      const mode = c.peek();
      const upper = mode.kind === "word" ? mode.text.toUpperCase() : "";
      if (upper === "BYVAL" || upper === "BYVALUE" || upper === "BYREF") {
        c.next();
        byRef = upper === "BYREF";
        if (upper === "BYVALUE")
          c.report("W-CIE-BYVALUE", mode.span, {}, undefined, [
            { start: mode.span.start, end: mode.span.end, replacement: "BYVAL" },
          ]);
        if (byRef && kind === "function") c.report("W-CIE-BYREF-FUNCTION", mode.span);
      }
      const name = c.peek();
      if (name.kind !== "word") return c.fail("a parameter name", "Write the parameter's name, then : and its type.");
      c.next();
      if (CIE_RESERVED.has(name.text.toUpperCase())) {
        c.report("E-SYN-KEYWORD-AS-NAME", name.span, { word: name.text, suggestion: `my${name.text}` });
        return c.failSilently();
      }
      c.expectSymbol(":", ":", "Write the type after a colon, e.g. N : INTEGER.");
      list.push({ name: name.text, ty: paramType(), byRef });
      if (!c.isSymbol(",")) break;
      c.next();
    }
    c.expectSymbol(")", ") or ,", "Separate the parameters with commas and close them with ).");
    return list;
  };

  s.subprogram = (first: Token, upper: string): void => {
    const kind = upper === "PROCEDURE" ? "procedure" : "function";
    const closer = kind === "procedure" ? "ENDPROCEDURE" : "ENDFUNCTION";
    c.next();
    c.warnCase(first, upper);
    const name = c.peek();
    if (name.kind !== "word") return c.fail("a name", `Write a name after ${upper}.`);
    c.next();
    const ps = params(kind);
    let returns: Ty | null = null;
    if (kind === "function") {
      c.expectKeyword("RETURNS", "Write RETURNS and the type the function gives back.");
      returns = paramType();
    }
    c.endStatement();
    const sig: Signature = { name: name.text, kind, params: ps, returns, span: first.span };
    if (collecting) {
      const earlier = env.subs.get(name.text);
      if (earlier !== undefined)
        c.report("E-CHK-DUPLICATE-SUBPROGRAM", name.span, { name: name.text, line: earlier.span.line });
      else env.subs.set(name.text, sig);
    }
    const locals = new Map(ps.map((p) => [p.name, { ty: p.ty, constant: false }]));
    env.locals = locals;
    env.current = sig;
    const body = s.block(first, upper, [closer], closer);
    env.locals = null;
    env.current = null;
    c.endStatement();
    out[name.text] = {
      name: name.text,
      kind,
      params: ps.map((p) => p.name),
      ...(ps.some((p) => p.byRef) ? { byRef: ps.map((p) => p.byRef) } : {}),
      body: body.stmts,
      span: c.spanFrom(first),
    };
  };
}

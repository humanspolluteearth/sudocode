// CIE DECLARE, CONSTANT, type names and variable references. Split out of statements.ts.

import type { Stmt as Ir, VarRef } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { Abandon, CIE_RESERVED } from "./cursor.ts";
import { arrayType } from "./arrays.ts";
import { startingValue } from "./records.ts";
import { SCALAR_TYPES, UNKNOWN } from "./types.ts";
import type { Ty } from "./types.ts";
import type { Statements } from "./statements.ts";

/** A name being declared or assigned: a keyword in any case is an error (CIE-03). */
function newName(s: Statements): Token {
  const c = s.c;
  const t = c.peek();
  if (t.kind === "error") return c.failSilently();
  if (t.kind !== "word") return c.fail("a name", "Names start with a letter.");
  c.next();
  if (CIE_RESERVED.has(t.text.toUpperCase())) {
    c.report("E-SYN-KEYWORD-AS-NAME", t.span, {
      word: t.text,
      suggestion: `my${t.text.charAt(0).toUpperCase()}${t.text.slice(1).toLowerCase()}`,
    });
    s.env.declare(t.text, { ty: UNKNOWN, constant: false }); // so later uses add no errors
    throw new Abandon();
  }
  return t;
}

export function typeName(s: Statements, scalarOnly = false): Ty {
  const c = s.c;
  const t = c.peek();
  if (t.kind === "word") {
    const ty = SCALAR_TYPES[t.text.toUpperCase()];
    if (ty !== undefined) {
      c.next();
      c.warnCase(t, t.text.toUpperCase());
      return ty;
    }
    const declared = s.env.types.get(t.text);
    if (declared !== undefined) {
      c.next();
      return declared;
    }
    if (t.text.toUpperCase() === "ARRAY" && !scalarOnly) {
      c.next();
      c.warnCase(t, "ARRAY");
      return arrayType(c, t, () => typeName(s, true));
    }
  }
  if (t.kind === "word" && t.text.toUpperCase() === "FILE") {
    // CIE-10: a file is named by a STRING, there is no FILE type.
    c.report("E-CHK-FILE-TYPE", t.span);
    c.next();
    return UNKNOWN;
  }
  return c.fail("a type", "Use INTEGER, REAL, CHAR, STRING or BOOLEAN.");
}

export function declare(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "DECLARE");
  const names: Token[] = [];
  for (;;) {
    names.push(newName(s));
    if (!c.isSymbol(",")) break;
    c.next();
  }
  c.expectSymbol(":", ":", "Write the type after a colon, e.g. DECLARE Age : INTEGER.");
  const ty = typeName(s);
  for (const n of names) s.env.declare(n.text, { ty, constant: false });
  c.endStatement();
  // An array or record exists from its DECLARE, with every item unset (CIE-20, CIE-30); other types get their
  // value on assignment.
  const span = c.spanFrom(first);
  return names.flatMap((n): Ir[] => {
    const value = startingValue(ty, span);
    return value === null ? [] : [{ kind: "assign", target: ref(s, n), value, span }];
  });
}

export function constant(s: Statements, first: Token): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, "CONSTANT");
  const name = newName(s);
  c.expectSymbol("=", "=", "Write the value after =, e.g. CONSTANT Max = 10.");
  const value = s.x.expr();
  const ir = value.ir;
  const plain = ir.kind === "literal" || (ir.kind === "unary" && ir.op === "negate" && ir.operand.kind === "literal");
  if (!plain) c.report("E-CHK-CONSTANT-LITERAL", value.span);
  s.env.declare(name.text, { ty: plain ? value.ty : UNKNOWN, constant: true });
  c.endStatement();
  return [{ kind: "assign", target: ref(s, name), value: ir, span: c.spanFrom(first) }];
}

export function ref(s: Statements, t: Token): VarRef {
  return {
    kind: "var",
    name: s.env.lookup(t.text)?.name ?? t.text,
    scope: s.env.isLocal(t.text) ? "local" : "global",
    span: t.span,
  };
}

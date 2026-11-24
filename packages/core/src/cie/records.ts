// Records and enumerated types (CIE-30, CIE-31): the `TYPE` declaration and the starting value of a declared variable.
//
// Compiler concept: a *user-defined type* is added to the symbol table (`env.types`) when it is declared, so a later
// DECLARE can name it exactly as it names INTEGER. An enumerated type also declares its values as constants, each
// of which lowers to an `enumValue` node.
import type { Expr } from "../ir/ir.ts";
import type { Span } from "../diagnostics.ts";
import type { Token } from "../edexcel/tokens.ts";
import type { CieCursor } from "./cursor.ts";
import type { Env } from "./env.ts";
import { type Ty } from "./types.ts";

/**
 * `TYPE Name` fields `ENDTYPE`, or `TYPE Name = (a, b, c)`. `first` is the TYPE word, already peeked.
 * `typeName` parses a field's type (so a field may itself be an array or another record).
 */
export function typeDeclaration(c: CieCursor, env: Env, first: Token, typeName: () => Ty): void {
  c.next();
  c.warnCase(first, "TYPE");
  const nameToken = c.peek();
  if (nameToken.kind !== "word") return c.fail("a type name", "Give the type a name, e.g. TYPE Pupil.");
  c.next();
  if (c.isSymbol("=")) {
    enumeration(c, env, nameToken);
    return;
  }
  c.endStatement();
  const fields: { name: string; ty: Ty }[] = [];
  for (;;) {
    while (c.peek().kind === "newline") c.next();
    const t = c.peek();
    if (t.kind === "eof") {
      c.report("E-SYN-BLOCK-NOT-CLOSED", first.span, { block: "TYPE", line: first.span.line, closer: "ENDTYPE" });
      break;
    }
    if (t.kind === "word" && t.text.toUpperCase() === "ENDTYPE") {
      c.next();
      c.warnCase(t, "ENDTYPE");
      c.endStatement();
      break;
    }
    if (t.kind === "word" && t.text.toUpperCase() === "DECLARE") {
      c.next();
      c.warnCase(t, "DECLARE");
    } else if (t.kind === "word") {
      // CIE-30: a field line without DECLARE is accepted, with a warning.
      c.report("W-CIE-FIELD-DECLARE", t.span, {}, undefined, [
        { start: t.span.start, end: t.span.start, replacement: "DECLARE " },
      ]);
    } else {
      return c.fail("a field", "Write each field as DECLARE Name : TYPE.");
    }
    const f = c.next();
    c.expectSymbol(":", ":", "Write the type after a colon, e.g. DECLARE Age : INTEGER.");
    const ty = typeName();
    c.endStatement();
    fields.push({ name: f.text, ty });
  }
  env.types.set(nameToken.text, { kind: "RECORD", name: nameToken.text, fields });
}

function enumeration(c: CieCursor, env: Env, nameToken: Token): void {
  c.next(); // =
  c.expectSymbol("(", "(", "List the values in brackets, e.g. TYPE Season = (Spring, Summer).");
  const names: string[] = [];
  const spans: Span[] = [];
  for (;;) {
    const v = c.peek();
    if (v.kind !== "word") return c.fail("a value name", "Write each value as a plain word, separated by commas.");
    c.next();
    names.push(v.text);
    spans.push(v.span);
    if (!c.isSymbol(",")) break;
    c.next();
  }
  c.expectSymbol(")", ")", "Close the list with ).");
  c.endStatement();
  const ty: Ty = { kind: "ENUM", name: nameToken.text, names };
  env.types.set(nameToken.text, ty);
  names.forEach((n, ordinal) => {
    env.declare(n, {
      ty,
      constant: true,
      literal: (span) => ({ kind: "enumValue", type: nameToken.text, names, ordinal, span }),
    });
  });
}

/** What a declared variable holds before it is assigned: arrays and records exist at once; other types do not. */
export function startingValue(ty: Ty, span: Span): Expr | null {
  switch (ty.kind) {
    case "ARRAY": {
      const fill = startingValue(ty.of, span);
      return { kind: "newArray", dims: ty.dims, ...(fill === null ? {} : { fill }), span };
    }
    case "RECORD":
      return {
        kind: "newRecord",
        fields: ty.fields.map((f) => ({ name: f.name, init: startingValue(f.ty, span) })),
        span,
      };
    default:
      return null;
  }
}

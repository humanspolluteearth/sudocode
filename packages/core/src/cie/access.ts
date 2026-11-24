// CIE field and array-item access in expressions. Split out of expressions.ts; each function takes the
// Expressions host, the same shape as statements.ts uses for control.ts.
import type { Span } from "../diagnostics.ts";
import type { Expr as Ir } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { joinSpans } from "./cursor.ts";
import { member } from "./classes.ts";
import { CHAR, UNKNOWN, isUnknown, withArticle } from "./types.ts";
import type { Ty } from "./types.ts";
import type { Expressions, Typed } from "./expressions.ts";
import { typed } from "./expressions.ts";

/**
 * CIE-30: `.field` after a name or an item, as often as it is written (`Form[2].Name`, `A.Inner.F`). The result's
 * `path` is the text so far, for messages such as "A.F has no value yet".
 */
export function fields(x: Expressions, t: Token, base: Typed): Typed {
  const c = x.c;
  let left = base;
  let text = x.text(joinSpans(t.span, base.span));
  while (c.isSymbol(".") && c.peek(1).kind === "word") {
    c.next();
    const f = c.next();
    const span = joinSpans(t.span, f.span);
    if (isUnknown(left.ty)) {
      left = typed(left.ir, UNKNOWN, span);
    } else if (left.ty.kind === "CLASS") {
      left = member(x, left, text, f, span);
    } else if (left.ty.kind !== "RECORD") {
      c.report("E-CHK-NOT-RECORD", f.span, { name: text, type: withArticle(left.ty) });
      left = typed(left.ir, UNKNOWN, span);
    } else {
      const field = left.ty.fields.find((x) => x.name === f.text);
      if (field === undefined) {
        c.report("E-CHK-NO-FIELD", f.span, {
          name: text,
          field: f.text,
          fields: left.ty.fields.map((x) => x.name).join(", "),
        });
        left = typed(left.ir, UNKNOWN, span);
      } else {
        left = typed({ kind: "field", target: left.ir, name: f.text, text, span }, field.ty, span);
      }
    }
    text = `${text}.${f.text}`;
  }
  return left;
}

/**
 * Reads `A[i]`, `A[i, j]` or `S[i]` (CIE-20 to CIE-25). A 2D read is two nested `index` nodes: the first picks the
 * row, the second the item (the runtime has no 2D read of its own). Lower bounds go in `base`, so the IR states
 * where counting starts; a STRING counts from 1 (CIE-25).
 */
export function element(x: Expressions, t: Token, whole: Typed): Typed {
  const { indexes, span } = subscripts(x, t, whole.ty);
  const full = joinSpans(t.span, span);
  if (isUnknown(whole.ty)) return typed(whole.ir, UNKNOWN, full);
  const ty = whole.ty;
  const [first, second] = indexes;
  if (first === undefined) return typed(whole.ir, UNKNOWN, full);
  const lows = ty.kind === "ARRAY" ? ty.lows : [1];
  const row: Ir = {
    kind: "index",
    target: whole.ir,
    index: first.ir,
    base: lows[0] ?? 1,
    text: t.text,
    span: full,
  };
  const item = ty.kind === "ARRAY" ? ty.of : CHAR;
  if (second === undefined) return typed(row, item, full);
  const rowText = `${t.text}[${x.text(first.span)}]`;
  return typed(
    { kind: "index", target: row, index: second.ir, base: lows[1] ?? 1, text: rowText, span: full },
    item,
    full,
  );
}

/**
 * The indexes after a name: `[` expr {`,` expr} `]`. Checks that the name can be indexed, that the right number of
 * indexes is given and that each is an INTEGER. `A[1 TO 3]` is the CIE-24 group assignment error.
 */
export function subscripts(x: Expressions, t: Token, ty: Ty): { indexes: Typed[]; span: Span } {
  const c = x.c;
  c.next(); // [
  const indexes: Typed[] = [];
  for (;;) {
    const value = x.expr();
    if (c.peek().kind === "word" && c.peek().text.toUpperCase() === "TO") {
      c.report("E-CHK-GROUP-ASSIGN", t.span);
      return c.failSilently();
    }
    if (!isUnknown(value.ty) && value.ty.kind !== "INTEGER") {
      c.report("E-CHK-NEEDS-INTEGER", value.span, { type: withArticle(value.ty), name: t.text }, "index");
    }
    indexes.push(value);
    if (!c.isSymbol(",")) break;
    c.next();
  }
  const close = c.expectSymbol("]", "]", "Close the index with ].");
  if (!isUnknown(ty)) {
    const allowed = ty.kind === "ARRAY" ? ty.dims.length : ty.kind === "STRING" ? 1 : 0;
    if (allowed === 0) {
      c.report("E-CHK-NOT-INDEXABLE", t.span, { name: t.text, type: withArticle(ty) });
      return c.failSilently();
    }
    if (indexes.length !== allowed) {
      const found = `${String(indexes.length)} ${indexes.length === 1 ? "index" : "indexes"}`;
      c.report("E-SYN-EXPECTED", close.span, {
        expected: allowed === 1 ? "one index" : "two indexes",
        found,
        advice: allowed === 1 ? `Write ${t.text}[index].` : `Write ${t.text}[row, column].`,
      });
      return c.failSilently();
    }
  }
  return { indexes, span: close.span };
}

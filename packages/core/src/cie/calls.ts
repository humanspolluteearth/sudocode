// CIE calls in expressions: user functions, built-in functions and argument checks. Split out of expressions.ts.
import type { Span } from "../diagnostics.ts";
import type { Expr as Ir } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { BUILTINS, KIND_NAME, fitsKind } from "./builtins.ts";
import type { BuiltinSignature } from "./builtins.ts";
import { joinSpans } from "./cursor.ts";
import { ownMethodCall } from "./classes.ts";
import { CHAR, STRING, UNKNOWN, isUnknown, typeName } from "./types.ts";
import type { Ty } from "./types.ts";
import type { Expressions, Typed } from "./expressions.ts";
import { typed } from "./expressions.ts";

/** A call to a user function in an expression (CIE-70..78). */
export function call(x: Expressions, t: Token): Typed {
  const c = x.c;
  c.next();
  const args = argumentList(x);
  const close = c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
  const span = joinSpans(t.span, close.span);
  const sig = x.env.subs.get(t.text);
  const builtin = BUILTINS[t.text];
  if (sig === undefined && builtin !== undefined) return builtinCall(x, t, builtin, args, span);
  const own = sig === undefined ? ownMethodCall(x, t, args, span) : null;
  if (own !== null) return own;
  if (sig === undefined) {
    c.report("E-CHK-UNKNOWN-FUNCTION", t.span, { name: t.text });
    return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, UNKNOWN, span);
  }
  if (sig.kind === "procedure") {
    c.report("E-CHK-CALL-REQUIRED", t.span, { name: t.text }, "procedure-in-expression");
    return typed({ kind: "call", callee: t.text, args: args.map((a) => a.ir), span }, UNKNOWN, span);
  }
  checkArgs(x, sig.name, sig.params, args, t);
  return typed({ kind: "call", callee: t.text, args: argIrs(x, sig.params, args), span }, sig.returns ?? UNKNOWN, span);
}

/** A call of a built-in function (CIE-120 to CIE-129): check the argument count and kinds, then type the result. */
export function builtinCall(x: Expressions, t: Token, sig: BuiltinSignature, args: Typed[], span: Span): Typed {
  const ir: Ir = { kind: "builtin", name: sig.ir, args: args.map((a) => a.ir), span: t.span };
  const first = args[0];
  const result = sig.returns === "sameAsFirst" ? (first?.ty.kind === "CHAR" ? CHAR : STRING) : sig.returns;
  if (args.length !== sig.params.length) {
    const n = (k: number): string => (k === 0 ? "no arguments" : k === 1 ? "1 argument" : `${String(k)} arguments`);
    const names = sig.params.map((p) => KIND_NAME[p]).join(", ");
    x.c.report(
      "E-CHK-ARG-COUNT",
      t.span,
      { name: t.text, expected: n(sig.params.length), actual: String(args.length), signature: `${t.text}(${names})` },
      "builtin",
    );
    return typed(ir, UNKNOWN, span);
  }
  let ok = true;
  for (const [i, kind] of sig.params.entries()) {
    const a = args[i];
    if (a === undefined || isUnknown(a.ty) || fitsKind(kind, a.ty, a.oneChar)) continue;
    ok = false;
    const useStringVersion = sig.stringVersion !== undefined && a.ty.kind === "STRING";
    x.c.report(
      "E-CHK-ARG-TYPE",
      a.span,
      {
        function: t.text,
        expected: KIND_NAME[kind],
        argument: x.text(a.span),
        actual: typeName(a.ty),
        alternative: sig.stringVersion ?? "",
      },
      useStringVersion ? "use-to-upper" : undefined,
    );
  }
  return typed(ir, ok ? result : UNKNOWN, span);
}

export function argumentList(x: Expressions): Typed[] {
  const out: Typed[] = [];
  if (x.c.isSymbol(")")) return out;
  for (;;) {
    out.push(x.expr());
    if (!x.c.isSymbol(",")) return out;
    x.c.next();
  }
}

/** CIE-74: the number and types of the arguments must match the parameters. */
/** BYVAL array and record arguments are copied in, so the procedure cannot change the caller's (CIE-73). */
export function argIrs(x: Expressions, params: { ty: Ty; byRef: boolean }[], args: Typed[]): Ir[] {
  return args.map((a, k) => {
    const p = params[k];
    const shared = p !== undefined && !p.byRef && (p.ty.kind === "ARRAY" || p.ty.kind === "RECORD");
    return shared ? { kind: "copyArray", source: a.ir, span: a.span } : a.ir;
  });
}

export function checkArgs(
  x: Expressions,
  name: string,
  params: { name: string; ty: Ty }[],
  args: Typed[],
  at: Token,
): void {
  if (args.length !== params.length) {
    const n = (k: number): string => (k === 1 ? "1 argument" : `${String(k)} arguments`);
    const signature = `${name}(${params.map((p) => `${p.name} : ${typeName(p.ty)}`).join(", ")})`;
    x.c.report("E-CHK-ARG-COUNT", at.span, {
      name,
      expected: n(params.length),
      actual: String(args.length),
      line: at.span.line,
      signature,
    });
    return;
  }
  params.forEach((p, k) => {
    const a = args[k];
    if (a === undefined) return;
    if (!fitsArg(a, p.ty)) {
      x.c.report("E-CHK-ARG-TYPE", a.span, {
        function: name,
        expected: typeName(p.ty),
        argument: x.text(a.span),
        actual: typeName(a.ty),
        alternative: "",
      });
    }
  });
}

function fitsArg(a: Typed, into: Ty): boolean {
  if (isUnknown(a.ty) || isUnknown(into)) return true;
  if (into.kind === "REAL" && a.ty.kind === "INTEGER") return true;
  if (into.kind === "CHAR" && a.ty.kind === "STRING") return a.oneChar;
  if (into.kind === "STRING" && a.ty.kind === "CHAR") return true;
  if (into.kind === "CLASS" && a.ty.kind === "CLASS") return a.ty.name === into.name || a.ty.supers.includes(into.name);
  return a.ty.kind === into.kind;
}

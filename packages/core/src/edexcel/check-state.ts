// Shared state of the Edexcel checker: the symbol tables, subprogram signatures and diagnostics that both passes use.
import type { Diagnostic, Span, TextEdit } from "../diagnostics.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { Stmt } from "./ast.ts";
import type { Scope, SubprogramSignature } from "./check-expression.ts";
import { CHARACTER, INTEGER, REAL, STRING, UNKNOWN, type Ty } from "./types.ts";

export interface Variable {
  ty: Ty;
  /** The statement whose value gave the variable its type (EDX-12). */
  definedBy: Stmt | null;
  constant: { nameSpan: Span; sets: number; firstSetLine: number } | null;
}

export type SubprogramStmt = Extract<Stmt, { kind: "subprogram" }>;
export interface Signature extends SubprogramSignature {
  node: SubprogramStmt;
}

export const TYPE_OF: Record<string, Ty> = { INTEGER, REAL, BOOLEAN: { kind: "BOOLEAN" }, CHARACTER, STRING };

export interface CheckState {
  readonly vars: Map<string, Variable>;
  readonly diagnostics: Diagnostic[];
  readonly signatures: Map<string, Signature>;
  readonly localsOf: Map<Stmt, Map<string, Variable>>;
  current: SubprogramStmt | null;
  locals: Map<string, Variable> | null;
  /** How many types inference has found so far. */
  changes: number;
  text(span: Span): string;
  lookup(name: string): Variable | undefined;
  enter(s: SubprogramStmt): void;
  leave(): void;
  /** A scope that finds types without reporting (pass 1, and re-typing in pass 2). */
  readonly quiet: Scope;
  /** A scope that reports mistakes. */
  readonly loud: Scope;
  report(code: string, span: Span, args?: MessageArgs, variant?: string, edits?: TextEdit[]): void;
}

export function createState(source: string): CheckState {
  const diagnostics: Diagnostic[] = [];
  const makeScope = (reporting: boolean): Scope => ({
    typeOf: (name) => st.lookup(name)?.ty,
    names: () => [...(st.locals?.keys() ?? []), ...st.vars.keys()],
    subprogram: (name) => st.signatures.get(name),
    report: (code, span, args = {}, variant) => {
      if (!reporting) return;
      diagnostics.push(
        makeDiagnostic({ code, language: "edexcel", span, args, ...(variant === undefined ? {} : { variant }) }),
      );
    },
    text: (span) => st.text(span),
  });
  const st: CheckState = {
    vars: new Map(),
    diagnostics,
    signatures: new Map(),
    localsOf: new Map(),
    current: null,
    locals: null,
    changes: 0,
    text: (span) => source.slice(span.start, span.end),
    // Compiler concept: a *scope* is the region where a name means one variable, kept in a *symbol table* (a map
    // from name to what is known about it). A subprogram has its own table, `locals`; a name it never assigns is
    // looked up in the global table, `vars`. A name first assigned inside a subprogram is local to it (EDX-63).
    lookup: (name) => st.locals?.get(name) ?? st.vars.get(name),
    enter: (s) => {
      let table = st.localsOf.get(s);
      if (table === undefined) {
        table = new Map(s.params.map((p) => [p.name, { ty: UNKNOWN, definedBy: null, constant: null }]));
        st.localsOf.set(s, table);
      }
      st.current = s;
      st.locals = table;
    },
    leave: () => {
      st.current = null;
      st.locals = null;
    },
    quiet: makeScope(false),
    loud: makeScope(true),
    report: (code, span, args = {}, variant, edits) => {
      const extra = edits === undefined ? {} : { edits };
      diagnostics.push(
        makeDiagnostic({
          code,
          language: "edexcel",
          span,
          args,
          ...(variant === undefined ? {} : { variant }),
          ...extra,
        }),
      );
    },
  };
  return st;
}

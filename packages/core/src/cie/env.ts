// What the CIE translator knows while it works: declared variables and subprogram signatures.
//
// Compiler concept: a *symbol table* maps each name to what the checker knows about it. CIE declares every
// variable (CIE-11), so a name that is not in the table is an error at its first use.
import type { Span } from "../diagnostics.ts";
import type { Expr } from "../ir/ir.ts";
import type { Ty } from "./types.ts";

export interface Variable {
  /** How it was first written; every later spelling in another case is the same variable (CIE-03). */
  name: string;
  ty: Ty;
  constant: boolean;
  /** For the values of an enumerated type: the IR to use wherever the name appears (CIE-31). */
  literal?: (span: Span) => Expr;
}

export interface Param {
  name: string;
  ty: Ty;
  byRef: boolean;
}

export interface Signature {
  name: string;
  kind: "procedure" | "function";
  params: Param[];
  returns: Ty | null;
  span: Span;
}

export class Env {
  /** Types declared with TYPE (CIE-30, CIE-31), by name. */
  readonly types = new Map<string, Ty>();
  readonly globals = new Map<string, Variable>();
  readonly subs: Map<string, Signature>;
  locals: Map<string, Variable> | null = null;
  /** The function being translated (for RETURN), or null. */
  current: Signature | null = null;

  constructor(subs: Map<string, Signature> = new Map()) {
    this.subs = subs;
  }

  // CIE-03: identifiers are not case-sensitive, so both maps are keyed by the lower-case name.
  lookup(name: string): Variable | undefined {
    const key = name.toLowerCase();
    return this.locals?.get(key) ?? this.globals.get(key);
  }

  isLocal(name: string): boolean {
    return this.locals?.has(name.toLowerCase()) === true;
  }

  names(): string[] {
    return [...(this.locals?.values() ?? []), ...this.globals.values()].map((v) => v.name);
  }

  declare(name: string, v: Omit<Variable, "name">): void {
    (this.locals ?? this.globals).set(name.toLowerCase(), { ...v, name });
  }
}

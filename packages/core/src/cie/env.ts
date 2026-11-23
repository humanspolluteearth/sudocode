// What the CIE translator knows while it works: declared variables and subprogram signatures.
//
// Compiler concept: a *symbol table* maps each name to what the checker knows about it. CIE declares every
// variable (CIE-11), so a name that is not in the table is an error at its first use.
import type { Span } from "../diagnostics.ts";
import type { Ty } from "./types.ts";

export interface Variable {
  ty: Ty;
  constant: boolean;
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
  readonly globals = new Map<string, Variable>();
  readonly subs: Map<string, Signature>;
  locals: Map<string, Variable> | null = null;
  /** The function being translated (for RETURN), or null. */
  current: Signature | null = null;

  constructor(subs: Map<string, Signature> = new Map()) {
    this.subs = subs;
  }

  lookup(name: string): Variable | undefined {
    return this.locals?.get(name) ?? this.globals.get(name);
  }

  isLocal(name: string): boolean {
    return this.locals?.has(name) === true;
  }

  names(): string[] {
    return [...(this.locals?.keys() ?? []), ...this.globals.keys()];
  }

  declare(name: string, v: Variable): void {
    (this.locals ?? this.globals).set(name, v);
  }
}

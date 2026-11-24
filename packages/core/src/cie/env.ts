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
  /** True for an attribute of the class being translated: `literal` reads it from `Self` (CIE-111). */
  attr?: boolean;
}

/** A class's attribute and method (CIE-111, CIE-112); `owner` is the class that declared it. */
export interface Attr {
  name: string;
  ty: Ty;
  private: boolean;
  owner: string;
}
export interface Method {
  name: string;
  kind: "procedure" | "function";
  params: Param[];
  returns: Ty | null;
  private: boolean;
  owner: string;
  span: Span;
}
export interface ClassInfo {
  name: string;
  parent: string | null;
  attrs: Attr[];
  methods: Method[];
  span: Span;
}
export interface MemberContext {
  cls: ClassInfo;
  private: boolean;
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
  /** Classes by lower-case name; pass 1 fills it and pass 2 reads it (like `subs`). */
  readonly classes: Map<string, ClassInfo>;
  /** The class whose method is being translated, and its attributes as variables (CIE-111). */
  currentClass: ClassInfo | null = null;
  attrs: Map<string, Variable> | null = null;

  constructor(subs: Map<string, Signature> = new Map(), classes: Map<string, ClassInfo> = new Map()) {
    this.subs = subs;
    this.classes = classes;
  }

  // CIE-03: identifiers are not case-sensitive, so both maps are keyed by the lower-case name.
  lookup(name: string): Variable | undefined {
    const key = name.toLowerCase();
    return this.locals?.get(key) ?? this.attrs?.get(key) ?? this.globals.get(key);
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

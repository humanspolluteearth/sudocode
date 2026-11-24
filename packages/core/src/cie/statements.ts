// CIE statements: parse, check and lower in one pass (see expressions.ts for the idea).
//
// Compiler concepts:
// - *Recursive descent*: one method per statement kind; a block's method calls `body`, which calls `statement`.
// - *Panic-mode recovery*: a mistake reports once, throws `Abandon`, and `body` skips to the next line.
// - *Desugaring*: CASE has no IR node of its own; it becomes an if-chain, and an OUTPUT list becomes one text join.
import type { AssignTarget, VarRef, Stmt as Ir, Expr as IrExpr } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import { Abandon, CIE_RESERVED, type CieCursor } from "./cursor.ts";
import type { Env } from "./env.ts";
import { fileStatement } from "./files.ts";
import { superCall } from "./classes.ts";
import { placeOf } from "./byref.ts";
import { typeDeclaration } from "./records.ts";
import { Expressions, type Typed } from "./expressions.ts";
import { assignOrCall, input, output } from "./assign.ts";
import { caseStatement, forStatement, ifStatement, repeatStatement, tryStatement, whileStatement } from "./control.ts";
import { constant, declare, ref, typeName as parseTypeName } from "./declarations.ts";
import { fits, isUnknown, typeName, withArticle, type Ty } from "./types.ts";

/** Closer word -> the block it closes, for "has no matching ..." messages. */
const OWNER: Readonly<Record<string, string>> = {
  ENDIF: "IF",
  ELSE: "IF",
  ENDWHILE: "WHILE",
  NEXT: "FOR",
  UNTIL: "REPEAT",
  ENDCASE: "CASE",
  ENDPROCEDURE: "PROCEDURE",
  ENDFUNCTION: "FUNCTION",
  ENDCLASS: "CLASS",
  ENDTRY: "TRY",
  EXCEPT: "TRY",
};

export interface BodyResult {
  stmts: Ir[];
  /** The closer that ended the body (consumed), or null at the end of the program. */
  end: string | null;
}

export class Statements {
  readonly x: Expressions;
  /** Set by the subprogram part; gives access to `procedure` and `function` parsing. */
  subprogram: ((first: Token, upper: string) => void) | null = null;
  /** Set by the class part (CIE-110). */
  classDefinition: ((first: Token) => void) | null = null;

  constructor(
    readonly c: CieCursor,
    readonly env: Env,
  ) {
    this.x = new Expressions(c, env);
  }

  skipBlank(): void {
    while (this.c.peek().kind === "newline") this.c.next();
  }

  /** Is the next statement a closer from `terms`? Handles the two-word END IF (CIE-51). */
  private closerAhead(terms: readonly string[]): string | null {
    const t = this.c.peek();
    if (t.kind !== "word") return null;
    const upper = t.text.toUpperCase();
    if (upper === "END" && terms.includes("ENDIF") && this.c.isKeyword("IF", 1)) return "END IF";
    return terms.includes(upper) ? upper : null;
  }

  /** Statements until one of `terms` (consumed) or the end of the program. */
  body(terms: readonly string[]): BodyResult {
    const stmts: Ir[] = [];
    for (;;) {
      this.skipBlank();
      const found = this.closerAhead(terms);
      if (found !== null) {
        const first = this.c.next();
        if (found === "END IF") {
          this.c.report("W-CIE-ENDIF", first.span, {}, undefined, [
            { start: first.span.start, end: this.c.peek().span.end, replacement: "ENDIF" },
          ]);
          this.c.next();
          return { stmts, end: "ENDIF" };
        }
        this.c.warnCase(first, found);
        return { stmts, end: found };
      }
      if (this.c.peek().kind === "eof") return { stmts, end: null };
      try {
        stmts.push(...this.statement());
      } catch (e) {
        if (!(e instanceof Abandon)) throw e;
        this.c.skipLine();
        this.c.endLine();
      }
    }
  }

  /** A block that must end with `closer`; reports "never closed" otherwise (CIE-50). */
  block(opener: Token, name: string, terms: readonly string[], closer: string): BodyResult {
    const r = this.body(terms);
    if (r.end === null) {
      const at = this.c.source.length;
      this.c.report("E-SYN-BLOCK-NOT-CLOSED", opener.span, { block: name, line: opener.span.line, closer }, undefined, [
        { start: at, end: at, replacement: `\n${closer}\n` },
      ]);
    }
    return r;
  }

  statement(): Ir[] {
    const c = this.c;
    const first = c.peek();
    if (first.kind === "error") return c.failSilently();
    if (first.kind !== "word")
      return c.fail("a statement", "Statements start with a keyword such as OUTPUT or IF, or a variable name.");
    const upper = first.text.toUpperCase();
    switch (upper) {
      case "TRY":
        return tryStatement(this, first);
      case "DECLARE":
        return declare(this, first);
      case "CONSTANT":
        return constant(this, first);
      case "INPUT":
        return input(this, first);
      case "OUTPUT":
        return output(this, first);
      case "IF":
        return ifStatement(this, first);
      case "CASE":
        return caseStatement(this, first);
      case "FOR":
        return forStatement(this, first);
      case "WHILE":
        return whileStatement(this, first);
      case "REPEAT":
        return repeatStatement(this, first);
      case "CALL":
        return this.call(first);
      case "RETURN":
        return this.returnStatement(first);
      case "PROCEDURE":
      case "FUNCTION":
        if (this.subprogram === null) throw new Error("subprogram parser missing");
        this.subprogram(first, upper);
        return [];
      case "TYPE":
        typeDeclaration(c, this.env, first, () => this.typeName());
        return [];
      case "CLASS":
        // A name already declared (even wrongly, as `Class` was) is a variable, not the keyword (CIE-03).
        if (this.env.lookup(first.text) !== undefined) break;
        if (this.classDefinition === null) throw new Error("class parser missing");
        this.classDefinition(first);
        return [];
      case "SUPER": {
        const call = superCall(this.x, first);
        c.endStatement();
        if (call?.ir.kind !== "call") return [];
        return [{ kind: "callStatement", callee: call.ir.callee, args: call.ir.args, span: c.spanFrom(first) }];
      }
      case "ARRAY":
      case "FINALLY": // CIE-101: only one EXCEPT clause exists; FINALLY is not supported
        return this.notSupported(first, upper);
      case "OPENFILE":
      case "READFILE":
      case "WRITEFILE":
      case "CLOSEFILE":
      case "SEEK":
      case "GETRECORD":
      case "PUTRECORD":
        return fileStatement(this, first, upper);
      default:
        break;
    }
    if (OWNER[upper] !== undefined || upper === "END") {
      c.next();
      c.report("E-SYN-UNMATCHED-CLOSER", first.span, { closer: upper, block: OWNER[upper] ?? "block" });
      c.skipLine();
      c.endLine();
      return [];
    }
    if (CIE_RESERVED.has(upper) && first.text === upper)
      return c.fail("a statement", "Check the first word on the line.");
    return assignOrCall(this, first);
  }

  notSupported(first: Token, upper: string): never {
    this.c.report("E-SYN-NOT-SUPPORTED", first.span, {
      feature: upper,
      advice: "This part of Cambridge pseudocode is not available in Sudocode yet.",
    });
    return this.c.failSilently();
  }

  typeName(scalarOnly = false): Ty {
    return parseTypeName(this, scalarOnly);
  }

  ref(t: Token): VarRef {
    return ref(this, t);
  }

  /** CIE-13, CIE-49: the value must fit the variable's type. */
  checkFits(name: string, into: Ty, value: Typed): void {
    if (fits(value.ty, value.oneChar, into)) return;
    this.c.report("E-CHK-TYPE-CHANGE", value.span, { name, expected: typeName(into), actual: withArticle(value.ty) });
  }

  /** A one-character STRING literal going into a CHAR becomes a CHAR value (CIE-49). */
  valueFor(into: Ty, value: Typed): IrExpr {
    const ir = value.ir;
    if (into.kind === "CHAR" && ir.kind === "literal" && ir.value.kind === "str") {
      return { ...ir, value: { kind: "char", value: ir.value.value } };
    }
    return ir;
  }

  condition(value: Typed): void {
    if (value.ty.kind !== "BOOLEAN" && !isUnknown(value.ty)) {
      this.c.report("E-CHK-CONDITION-TYPE", value.span, { type: withArticle(value.ty), name: this.c.text(value.span) });
    }
  }

  private call(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "CALL");
    const name = c.peek();
    if (name.kind !== "word") return c.fail("a procedure name", "Write CALL followed by the procedure's name.");
    c.next();
    let args: Typed[] = [];
    if (c.isSymbol("(")) {
      c.next();
      args = this.x.args();
      c.expectSymbol(")", ") or ,", "Separate the arguments with commas and close them with ).");
    }
    c.endStatement();
    const sig = this.env.subs.get(name.text);
    if (sig === undefined) {
      this.x.undeclared(name);
      return [];
    }
    if (sig.kind === "function") {
      c.report("E-CHK-FUNCTION-CALL", name.span, { name: name.text });
      return [];
    }
    this.x.checkArgs(sig.name, sig.params, args, name);
    // CIE-76: a BYREF argument must be a place (variable, array item, record field) to write the result back to.
    const outs: (AssignTarget | null)[] = args.map((a, k) => {
      if (sig.params[k]?.byRef !== true) return null;
      const place = placeOf(a.ir);
      if (place === null && !isUnknown(a.ty)) c.report("E-CHK-BYREF-ARG", a.span);
      return place;
    });
    return [
      {
        kind: "callStatement",
        callee: name.text,
        args: this.x.argIrs(sig.params, args),
        ...(outs.some((o) => o !== null) ? { outs } : {}),
        span: c.spanFrom(first),
      },
    ];
  }

  private returnStatement(first: Token): Ir[] {
    const c = this.c;
    c.next();
    c.warnCase(first, "RETURN");
    if (this.env.current === null) {
      c.report("E-CHK-RETURN-OUTSIDE", first.span);
      return c.failSilently();
    }
    const value = c.atLineEnd() ? null : this.x.expr();
    c.endStatement();
    return [{ kind: "return", value: value === null ? null : value.ir, span: c.spanFrom(first) }];
  }
}

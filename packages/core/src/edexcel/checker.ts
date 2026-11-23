// The Edexcel checker: finds type and name mistakes before the program runs (DECISIONS: full pre-run checking).
//
// It works in two passes over the surface AST:
// 1. *Inference*: walk the program in source order and give each variable the type of the first value assigned to
//    it (EDX-12), or its CONST type (EDX-17). This repeats until nothing changes, so a variable used inside a loop
//    before the line that first sets it still has a type.
// 2. *Checking*: walk again and report every mistake: a later value of a different type, conditions that aren't
//    BOOLEAN (EDX-43), operator types (check-expression.ts), constants set twice, SEND with a comma (EDX-71) or a
//    whole array (EDX-75), and bare `x = 5` assignments (EDX-33).
import type { Diagnostic, Span, TextEdit } from "../diagnostics.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { Expr, Program, Stmt, Target } from "./ast.ts";
import { check, type Scope } from "./check-expression.ts";
import {
  CHARACTER,
  fits,
  INTEGER,
  isNumber,
  isText,
  isUnknown,
  REAL,
  STRING,
  typeName,
  UNKNOWN,
  withArticle,
  type Ty,
  type Typed,
} from "./types.ts";

interface Variable {
  ty: Ty;
  /** The statement whose value gave the variable its type (EDX-12). */
  definedBy: Stmt | null;
  constant: { nameSpan: Span; sets: number; firstSetLine: number } | null;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  /** Each variable's type, for lowering (a one-character literal put into a CHARACTER becomes a CHARACTER). */
  types: ReadonlyMap<string, Ty>;
}

const TYPE_OF: Record<string, Ty> = { INTEGER, REAL, BOOLEAN: { kind: "BOOLEAN" }, CHARACTER, STRING };

export function checkProgram(program: Program, source: string): CheckResult {
  const vars = new Map<string, Variable>();
  const diagnostics: Diagnostic[] = [];
  const text = (span: Span): string => source.slice(span.start, span.end);

  const scope = (report: boolean): Scope => ({
    typeOf: (name) => vars.get(name)?.ty,
    names: () => vars.keys(),
    report: (code, span, args = {}, variant) => {
      if (!report) return;
      diagnostics.push(
        makeDiagnostic({ code, language: "edexcel", span, args, ...(variant === undefined ? {} : { variant }) }),
      );
    },
    text,
  });
  const quiet = scope(false);
  const loud = scope(true);
  const report = (code: string, span: Span, args: MessageArgs = {}, variant?: string, edits?: TextEdit[]): void => {
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
  };

  // ---------- pass 1: inference

  let changes = 0; // how many types inference has found so far
  const define = (name: string, ty: Ty, by: Stmt): void => {
    const v = vars.get(name);
    if (v === undefined) {
      vars.set(name, { ty, definedBy: by, constant: null });
      changes++;
    } else if (v.constant === null && v.definedBy === by && isUnknown(v.ty) && !isUnknown(ty)) {
      v.ty = ty;
      changes++;
    } else if (
      v.constant === null &&
      v.definedBy === by &&
      v.ty.kind === "ARRAY" &&
      isUnknown(v.ty.of) &&
      ty.kind === "ARRAY" &&
      !isUnknown(ty.of)
    ) {
      v.ty = ty;
      changes++;
    }
  };
  const loopType = (s: Extract<Stmt, { kind: "for" }>, sc: Scope): Ty => {
    const parts = [s.start, s.end, ...(s.step === null ? [] : [s.step])].map((e) => check(sc, e).ty);
    return parts.some((t) => t.kind === "REAL") ? REAL : INTEGER;
  };
  const itemType = (iterable: Expr, sc: Scope): Ty => {
    const t = check(sc, iterable).ty;
    return t.kind === "ARRAY" ? t.of : isText(t) ? CHARACTER : UNKNOWN;
  };
  const infer = (stmts: readonly Stmt[]): void => {
    for (const s of stmts) {
      switch (s.kind) {
        case "const":
          if (!vars.has(s.name))
            vars.set(s.name, {
              ty: TYPE_OF[s.type] ?? UNKNOWN,
              definedBy: s,
              constant: { nameSpan: s.nameSpan, sets: 0, firstSetLine: 0 },
            });
          break;
        case "set":
        case "bareAssign":
          if (s.target.kind === "name") define(s.target.name, check(quiet, s.value).ty, s);
          break;
        case "for":
          define(s.name, loopType(s, quiet), s);
          infer(s.body);
          break;
        case "forEach":
          define(s.name, itemType(s.iterable, quiet), s);
          infer(s.body);
          break;
        case "if":
          infer(s.then);
          infer(s.else);
          break;
        case "while":
        case "repeatUntil":
        case "repeatTimes":
          infer(s.body);
          break;
        case "send":
          break;
        default: {
          const unreachable: never = s;
          throw new Error(`Unknown statement ${JSON.stringify(unreachable)}`);
        }
      }
    }
  };
  for (let round = 0; round < 5; round++) {
    const before = changes;
    infer(program.body);
    if (changes === before) break; // nothing new: every type that can be known is known
  }

  // ---------- pass 2: checking

  const forVariables: string[] = [];

  /** A value going into a variable (or one of its elements): EDX-12, EDX-17, EDX-25. */
  const assign = (s: Stmt, target: Target, value: Expr): void => {
    const typed: Typed = check(loud, value);
    const v = vars.get(target.name);
    if (target.kind === "element") {
      if (v === undefined) {
        check(loud, { kind: "name", name: target.name, span: target.nameSpan }); // never given a value
        return;
      }
      const index = check(loud, target.index).ty;
      if (!isUnknown(index) && index.kind !== "INTEGER") {
        report("E-CHK-NEEDS-INTEGER", target.index.span, { type: withArticle(index), name: target.name }, "index");
        return;
      }
      if (isText(v.ty))
        // Until QUESTIONS.md 26 decides (proposed: E-CHK-STRING-ELEMENT), changing one character is "not yet".
        report("E-SYN-NOT-SUPPORTED", target.nameSpan, {
          feature: "Changing one character of a STRING",
          advice: "Build a new STRING with & instead.",
        });
      else if (v.ty.kind === "ARRAY") {
        if (!fits(typed, v.ty.of)) {
          report("E-CHK-TYPE-CHANGE", value.span, {
            name: target.name,
            expected: typeName(v.ty.of),
            actual: withArticle(typed.ty),
          });
        }
      } else if (!isUnknown(v.ty)) {
        report("E-CHK-NOT-INDEXABLE", target.nameSpan, { name: target.name, type: withArticle(v.ty) });
      }
      return;
    }
    if (v === undefined) return;
    if (forVariables.includes(target.name)) report("W-EDX-FOR-VAR-SET", target.span, { name: target.name }); // EDX-55
    if (v.constant !== null) {
      v.constant.sets++;
      if (v.constant.sets === 1) v.constant.firstSetLine = s.span.line;
      else {
        report("E-CHK-CONST-SET-TWICE", target.span, { name: target.name, line: v.constant.firstSetLine });
        return;
      }
    } else if (v.definedBy === s) {
      return; // this value gave the variable its type
    }
    if (!fits(typed, v.ty)) {
      report("E-CHK-TYPE-CHANGE", value.span, {
        name: target.name,
        expected: typeName(v.ty),
        actual: withArticle(typed.ty),
      });
    }
  };

  const condition = (e: Expr, variant?: string): void => {
    const t = check(loud, e).ty;
    if (!isUnknown(t) && t.kind !== "BOOLEAN") {
      report("E-CHK-CONDITION-TYPE", e.span, { type: withArticle(t), name: text(e.span) }, variant); // EDX-43
    }
  };

  /** A loop variable gets a value from the loop: it must fit a type the variable already has. */
  const loopVariable = (s: Stmt, name: string, ty: Ty, at: Span): void => {
    const v = vars.get(name);
    if (v === undefined || v.definedBy === s) return;
    if (!fits({ ty }, v.ty))
      report("E-CHK-TYPE-CHANGE", at, { name, expected: typeName(v.ty), actual: withArticle(ty) });
  };

  const statements = (stmts: readonly Stmt[]): void => {
    for (const s of stmts) statement(s);
  };

  const statement = (s: Stmt): void => {
    switch (s.kind) {
      case "set":
        assign(s, s.target, s.value);
        return;
      case "bareAssign": {
        // EDX-33: not accepted, because it loses marks in the exam; the hint and fix write the SET form.
        const name = text(s.target.span);
        const value = text(s.value.span);
        const edits = [{ start: s.span.start, end: s.span.end, replacement: `SET ${name} TO ${value}` }];
        report("E-CHK-BARE-ASSIGN", s.target.span, { name, value }, undefined, edits);
        return;
      }
      case "send": {
        if (s.comma !== null) {
          report("E-CHK-SEND-COMMA", s.comma); // EDX-71
          return;
        }
        const [value] = s.values;
        if (value === undefined) return;
        const t = check(loud, value).ty;
        if (t.kind === "ARRAY") report("E-CHK-SEND-ARRAY", value.span, { name: text(value.span) }); // EDX-75
        return;
      }
      case "const":
        return;
      case "if":
        condition(s.condition);
        statements(s.then);
        statements(s.else);
        return;
      case "while":
        condition(s.condition, "while");
        statements(s.body);
        return;
      case "repeatUntil":
        statements(s.body);
        condition(s.condition, "until");
        return;
      case "repeatTimes": {
        const t = check(loud, s.count).ty;
        if (!isUnknown(t) && t.kind !== "INTEGER")
          report("E-CHK-NEEDS-INTEGER", s.count.span, { type: withArticle(t) }, "count");
        statements(s.body);
        return;
      }
      case "for": {
        let ok = true;
        for (const e of [s.start, s.end, ...(s.step === null ? [] : [s.step])]) {
          const t = check(loud, e).ty;
          if (!isUnknown(t) && !isNumber(t)) {
            report("E-CHK-NEEDS-INTEGER", e.span, { type: withArticle(t) });
            ok = false;
          }
        }
        if (ok) loopVariable(s, s.name, loopType(s, quiet), s.start.span);
        forVariables.push(s.name);
        statements(s.body);
        forVariables.pop();
        return;
      }
      case "forEach": {
        const t = check(loud, s.iterable).ty;
        if (!isUnknown(t) && t.kind !== "ARRAY" && !isText(t)) {
          report("E-CHK-FOREACH-TYPE", s.iterable.span, { type: withArticle(t), name: s.name }); // EDX-57
        } else {
          loopVariable(s, s.name, itemType(s.iterable, quiet), s.iterable.span);
        }
        statements(s.body);
        return;
      }
      default: {
        const unreachable: never = s;
        throw new Error(`Unknown statement ${JSON.stringify(unreachable)}`);
      }
    }
  };

  statements(program.body);
  for (const [name, v] of vars) {
    if (v.constant !== null && v.constant.sets === 0) report("E-CHK-CONST-NEVER-SET", v.constant.nameSpan, { name }); // EDX-17
  }
  return { diagnostics, types: new Map([...vars].map(([name, v]) => [name, v.ty])) };
}

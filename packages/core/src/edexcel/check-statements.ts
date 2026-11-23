// Pass 2 of the Edexcel checker: report every mistake. See checker.ts for the two passes.
import type { Expr, Program, Stmt, Target } from "./ast.ts";
import { check, checkArgumentCount } from "./check-expression.ts";
import { TYPE_OF, type CheckState } from "./check-state.ts";
import { itemType, loopType } from "./infer.ts";
import { fits, isNumber, isText, isUnknown, typeName, withArticle, type Ty, type Typed } from "./types.ts";
import type { Span } from "../diagnostics.ts";

export function checkStatements(st: CheckState, program: Program): void {
  const forVariables: string[] = [];
  const noted = new Set<string>(); // globals already reported as changed by the st.current subprogram

  /** A value going into a variable (or one of its elements): EDX-12, EDX-17, EDX-25. */
  const assign = (s: Stmt, target: Target, value: Expr): void => {
    const typed: Typed = check(st.loud, value);
    const v = st.lookup(target.name);
    if (target.kind === "element") {
      if (v === undefined) {
        check(st.loud, { kind: "name", name: target.name, span: target.nameSpan }); // never given a value
        return;
      }
      for (const at of [target.index, ...(target.index2 === null ? [] : [target.index2])]) {
        const index = check(st.loud, at).ty;
        if (!isUnknown(index) && index.kind !== "INTEGER") {
          st.report("E-CHK-NEEDS-INTEGER", at.span, { type: withArticle(index), name: target.name }, "index");
          return;
        }
      }
      // EDX-24: a grid item is the element type of the row, which is itself an array.
      let element: Ty = v.ty;
      if (target.index2 !== null && element.kind === "ARRAY") element = element.of;
      if (isText(v.ty))
        // Until QUESTIONS.md 26 decides (proposed: E-CHK-STRING-ELEMENT), changing one character is "not yet".
        st.report("E-SYN-NOT-SUPPORTED", target.nameSpan, {
          feature: "Changing one character of a STRING",
          advice: "Build a new STRING with & instead.",
        });
      else if (element.kind === "ARRAY") {
        if (!fits(typed, element.of)) {
          st.report("E-CHK-TYPE-CHANGE", value.span, {
            name: target.name,
            expected: typeName(element.of),
            actual: withArticle(typed.ty),
          });
        }
      } else if (!isUnknown(v.ty)) {
        st.report("E-CHK-NOT-INDEXABLE", target.nameSpan, { name: target.name, type: withArticle(v.ty) });
      }
      return;
    }
    intoName(s, target.name, target.span, typed, value.span);
  };

  /** A value of type `typed` going into the variable `name` (from SET or RECEIVE); `at` is where a type error points. */
  const intoName = (s: Stmt, name: string, nameSpan: Span, typed: Typed, at: Span): void => {
    const v = st.lookup(name);
    if (v === undefined) return;
    if (st.locals !== null && !st.locals.has(name) && !noted.has(name)) {
      noted.add(name); // Q-EDX-3: say once per subprogram that this st.changes a global
      st.report("I-EDX-GLOBAL-UPDATE", nameSpan, { name });
    }
    if (forVariables.includes(name)) st.report("W-EDX-FOR-VAR-SET", nameSpan, { name }); // EDX-55
    if (v.constant !== null) {
      v.constant.sets++;
      if (v.constant.sets === 1) v.constant.firstSetLine = s.span.line;
      else {
        st.report("E-CHK-CONST-SET-TWICE", nameSpan, { name, line: v.constant.firstSetLine });
        return;
      }
    } else if (v.definedBy === s) {
      return; // this value gave the variable its type
    }
    if (!fits(typed, v.ty)) {
      st.report("E-CHK-TYPE-CHANGE", at, { name, expected: typeName(v.ty), actual: withArticle(typed.ty) });
    }
  };

  const condition = (e: Expr, variant?: string): void => {
    const t = check(st.loud, e).ty;
    if (!isUnknown(t) && t.kind !== "BOOLEAN") {
      st.report("E-CHK-CONDITION-TYPE", e.span, { type: withArticle(t), name: st.text(e.span) }, variant); // EDX-43
    }
  };

  /** A loop variable gets a value from the loop: it must fit a type the variable already has. */
  const loopVariable = (s: Stmt, name: string, ty: Ty, at: Span): void => {
    const v = st.lookup(name);
    if (v === undefined || v.definedBy === s) return;
    if (!fits({ ty }, v.ty))
      st.report("E-CHK-TYPE-CHANGE", at, { name, expected: typeName(v.ty), actual: withArticle(ty) });
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
        const name = st.text(s.target.span);
        const value = st.text(s.value.span);
        const edits = [{ start: s.span.start, end: s.span.end, replacement: `SET ${name} TO ${value}` }];
        st.report("E-CHK-BARE-ASSIGN", s.target.span, { name, value }, undefined, edits);
        return;
      }
      case "send": {
        if (s.comma !== null) {
          st.report("E-CHK-SEND-COMMA", s.comma); // EDX-71
          return;
        }
        const [value] = s.values;
        if (value === undefined) return;
        const t = check(st.loud, value).ty;
        if (t.kind === "ARRAY") st.report("E-CHK-SEND-ARRAY", value.span, { name: st.text(value.span) }); // EDX-75
        return;
      }
      case "receive": {
        const ty = s.type === null ? undefined : TYPE_OF[s.type];
        if (ty === undefined || s.typeSpan === null) {
          st.report("E-CHK-RECEIVE-NO-TYPE", s.deviceSpan, { name: s.name }); // EDX-73
          return;
        }
        intoName(s, s.name, s.nameSpan, { ty }, s.typeSpan);
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
        const t = check(st.loud, s.count).ty;
        if (!isUnknown(t) && t.kind !== "INTEGER")
          st.report("E-CHK-NEEDS-INTEGER", s.count.span, { type: withArticle(t) }, "count");
        statements(s.body);
        return;
      }
      case "for": {
        let ok = true;
        for (const e of [s.start, s.end, ...(s.step === null ? [] : [s.step])]) {
          const t = check(st.loud, e).ty;
          if (!isUnknown(t) && !isNumber(t)) {
            st.report("E-CHK-NEEDS-INTEGER", e.span, { type: withArticle(t) });
            ok = false;
          }
        }
        if (ok) loopVariable(s, s.name, loopType(s, st.quiet), s.start.span);
        forVariables.push(s.name);
        statements(s.body);
        forVariables.pop();
        return;
      }
      case "forEach": {
        const t = check(st.loud, s.iterable).ty;
        if (!isUnknown(t) && t.kind !== "ARRAY" && !isText(t)) {
          st.report("E-CHK-FOREACH-TYPE", s.iterable.span, { type: withArticle(t), name: s.name }); // EDX-57
        } else {
          loopVariable(s, s.name, itemType(s.iterable, st.quiet), s.iterable.span);
        }
        statements(s.body);
        return;
      }
      case "subprogram": {
        const sig = st.signatures.get(s.name);
        if (sig !== undefined && sig.node !== s) {
          st.report("E-CHK-DUPLICATE-SUBPROGRAM", s.nameSpan, { name: s.name, line: sig.line });
          return;
        }
        st.enter(s);
        noted.clear();
        statements(s.body);
        st.leave();
        return;
      }
      case "return": {
        if (st.current === null) {
          st.report("E-CHK-RETURN-OUTSIDE", s.span);
          return;
        }
        if (s.value !== null) check(st.loud, s.value);
        if (s.value !== null && st.current.sub === "procedure")
          st.report("E-CHK-PROCEDURE-RETURN", s.span, { name: st.current.name });
        return;
      }
      case "callStatement": {
        for (const a of s.args) check(st.loud, a);
        const sig = st.signatures.get(s.name);
        if (sig === undefined) st.report("E-CHK-UNKNOWN-FUNCTION", s.nameSpan, { name: s.name }, "procedure");
        else checkArgumentCount(st.loud, s.name, s.nameSpan, s.args.length, sig);
        return;
      }
      default: {
        const unreachable: never = s;
        throw new Error(`Unknown statement ${JSON.stringify(unreachable)}`);
      }
    }
  };

  statements(program.body);
}

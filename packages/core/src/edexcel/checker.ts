// The Edexcel checker: finds type and name mistakes before the program runs (DECISIONS: full pre-run checking).
//
// It works in two passes over the surface AST:
// 1. *Inference*: walk the program in source order and give each variable the type of the first value assigned to
//    it (EDX-12), or its CONST type (EDX-17). This repeats until nothing changes, so a variable used inside a loop
//    before the line that first sets it still has a type.
// 2. *Checking*: walk again and report every mistake: a later value of a different type, conditions that aren't
//    BOOLEAN (EDX-43), operator types (check-expression.ts), constants set twice, RECEIVE without a type (EDX-73), SEND with a comma (EDX-71) or a
//    whole array (EDX-75), and bare `x = 5` assignments (EDX-33).
import type { Diagnostic } from "../diagnostics.ts";
import type { Program, Stmt } from "./ast.ts";
import { checkStatements } from "./check-statements.ts";
import { createState, type Variable } from "./check-state.ts";
import { inferTypes } from "./infer.ts";
import type { Ty } from "./types.ts";

export interface CheckResult {
  diagnostics: Diagnostic[];
  /** Each variable's type, for lowering (a one-character literal put into a CHARACTER becomes a CHARACTER). */
  types: ReadonlyMap<string, Ty>;
  /** The types of each subprogram's own variables (its parameters and the names it first sets), for lowering. */
  locals: ReadonlyMap<Stmt, ReadonlyMap<string, Ty>>;
}

export function checkProgram(program: Program, source: string): CheckResult {
  const st = createState(source);
  inferTypes(st, program);
  checkStatements(st, program);
  for (const [name, v] of st.vars) {
    if (v.constant !== null && v.constant.sets === 0) {
      st.report("E-CHK-CONST-NEVER-SET", v.constant.nameSpan, { name }); // EDX-17
    }
  }
  const types = (table: ReadonlyMap<string, Variable>): Map<string, Ty> =>
    new Map([...table].map(([name, v]) => [name, v.ty]));
  return {
    diagnostics: st.diagnostics,
    types: types(st.vars),
    locals: new Map([...st.localsOf].map(([stmt, table]) => [stmt, types(table)])),
  };
}

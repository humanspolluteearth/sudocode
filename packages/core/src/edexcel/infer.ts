// Pass 1 of the Edexcel checker: *type inference*. See checker.ts for the two passes.
import type { Expr, Program, Stmt } from "./ast.ts";
import { check, type Scope } from "./check-expression.ts";
import { TYPE_OF, type CheckState } from "./check-state.ts";
import { CHARACTER, INTEGER, isText, isUnknown, REAL, STRING, UNKNOWN, type Ty } from "./types.ts";

export function loopType(s: Extract<Stmt, { kind: "for" }>, sc: Scope): Ty {
  const parts = [s.start, s.end, ...(s.step === null ? [] : [s.step])].map((e) => check(sc, e).ty);
  return parts.some((t) => t.kind === "REAL") ? REAL : INTEGER;
}

export function itemType(iterable: Expr, sc: Scope): Ty {
  const t = check(sc, iterable).ty;
  return t.kind === "ARRAY" ? t.of : isText(t) ? CHARACTER : UNKNOWN;
}

/** Walks the program (and then each subprogram) until no new type is found, at most five rounds. */
export function inferTypes(st: CheckState, program: Program): void {
  const define = (name: string, ty: Ty, by: Stmt): void => {
    const v = st.lookup(name);
    if (v === undefined) {
      (st.locals ?? st.vars).set(name, { ty, definedBy: by, constant: null });
      st.changes++;
    } else if (v.constant === null && v.definedBy === by && isUnknown(v.ty) && !isUnknown(ty)) {
      v.ty = ty;
      st.changes++;
    } else if (
      v.constant === null &&
      v.definedBy === by &&
      v.ty.kind === "ARRAY" &&
      isUnknown(v.ty.of) &&
      ty.kind === "ARRAY" &&
      !isUnknown(ty.of)
    ) {
      v.ty = ty;
      st.changes++;
    }
  };
  const infer = (stmts: readonly Stmt[]): void => {
    for (const s of stmts) {
      switch (s.kind) {
        case "const":
          if (!st.vars.has(s.name))
            st.vars.set(s.name, {
              ty: TYPE_OF[s.type] ?? UNKNOWN,
              definedBy: s,
              constant: { nameSpan: s.nameSpan, sets: 0, firstSetLine: 0 },
            });
          break;
        case "set":
        case "bareAssign":
          if (s.target.kind === "name") define(s.target.name, check(st.quiet, s.value).ty, s);
          break;
        case "for":
          define(s.name, loopType(s, st.quiet), s);
          infer(s.body);
          break;
        case "forEach":
          define(s.name, itemType(s.iterable, st.quiet), s);
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
        case "receive": {
          const ty = s.type === null ? undefined : TYPE_OF[s.type];
          if (ty !== undefined) define(s.name, ty, s); // EDX-12: RECEIVE ... FROM (type) gives the type
          break;
        }
        case "read":
          define(s.name, STRING, s); // EDX-82: a variable with no type yet becomes a STRING
          break;
        case "send":
        case "write":
        case "callStatement":
          break;
        case "subprogram":
          if (!st.signatures.has(s.name)) {
            const text = `${s.name}(${s.params.map((p) => p.name).join(", ")})`;
            const sig = { sub: s.sub, params: s.params.length, line: s.span.line, text, returns: UNKNOWN, node: s };
            st.signatures.set(s.name, sig);
            st.changes++;
          }
          break; // the body is inferred after the main program, so every global is known (see below)
        case "return": {
          const sig = st.current === null ? undefined : st.signatures.get(st.current.name);
          if (sig !== undefined && s.value !== null && sig.node === st.current && isUnknown(sig.returns)) {
            const ty = check(st.quiet, s.value).ty;
            if (!isUnknown(ty)) {
              sig.returns = ty;
              st.changes++;
            }
          }
          break;
        }
        default: {
          const unreachable: never = s;
          throw new Error(`Unknown statement ${JSON.stringify(unreachable)}`);
        }
      }
    }
  };
  for (let round = 0; round < 5; round++) {
    const before = st.changes;
    infer(program.body);
    for (const s of program.body) {
      if (s.kind !== "subprogram") continue;
      st.enter(s);
      infer(s.body);
      st.leave();
    }
    if (st.changes === before) break; // nothing new: every type that can be known is known
  }
}

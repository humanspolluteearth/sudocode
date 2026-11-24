// The CIE engine: lexer -> translator (parse + check + lower) -> runtime, behind the engine-neutral Engine interface.
import { sortDiagnostics, type Diagnostic } from "../diagnostics.ts";
import type { Program as IrProgram, Subprogram } from "../ir/ir.ts";
import type { Engine } from "../runner/engine.ts";
import { runProgram } from "../runtime/driver.ts";
import { CieCursor } from "./cursor.ts";
import { Env } from "./env.ts";
import { lex } from "./lexer.ts";
import { Statements } from "./statements.ts";
import { finishClasses, installClasses } from "./class-definition.ts";
import { declaredTable } from "./types.ts";
import { installSubprograms } from "./subprograms.ts";

export interface Analysis {
  diagnostics: Diagnostic[];
  program: IrProgram | null;
}

function translate(source: string, env: Env, collecting: boolean): { program: IrProgram; diagnostics: Diagnostic[] } {
  const lexed = lex(source);
  const cursor = new CieCursor(lexed.tokens, source);
  const s = new Statements(cursor, env);
  const subprograms: Record<string, Subprogram> = {};
  installSubprograms(s, subprograms, collecting);
  installClasses(s, subprograms, collecting);
  const main = s.body([]).stmts;
  if (!collecting) finishClasses(env, subprograms);
  return {
    program: { format: "pseudocode", main, subprograms, declared: declaredTable(env.globals.values()) },
    diagnostics: [...lexed.diagnostics, ...cursor.diagnostics],
  };
}

export function analyse(source: string): Analysis {
  // Pass 1 only gathers the subprogram signatures, so a call may come before its definition (CIE-70).
  const first = new Env();
  translate(source, first, true);
  const env = new Env(first.subs, first.classes);
  const { program, diagnostics: found } = translate(source, env, false);
  const diagnostics = sortDiagnostics(found);
  if (diagnostics.some((d) => d.severity === "error")) return { diagnostics, program: null };
  return { diagnostics, program };
}

export const cieEngine: Engine = {
  check: (source) => analyse(source).diagnostics,
  start(request, emit) {
    const { diagnostics, program } = analyse(request.source);
    if (diagnostics.length > 0) emit({ type: "diagnostics", diagnostics });
    if (program === null) {
      emit({ type: "done", status: "error" });
      return { command: () => undefined };
    }
    return runProgram({
      language: "cie",
      program,
      emit,
      trace: request.trace,
      breakpoints: request.breakpoints,
      files: request.files,
      ...(request.today === undefined ? {} : { today: request.today }),
      seed: request.seed,
    });
  },
};

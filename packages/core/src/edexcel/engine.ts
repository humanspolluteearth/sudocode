// The Edexcel engine: lexer -> parser -> checker -> lowering -> runtime, behind the engine-neutral Engine interface.
import { sortDiagnostics, type Diagnostic } from "../diagnostics.ts";
import type { Program as IrProgram } from "../ir/ir.ts";
import type { Engine } from "../runner/engine.ts";
import { runProgram } from "../runtime/driver.ts";
import { checkProgram } from "./checker.ts";
import { lowerProgram } from "./lower.ts";
import { parse } from "./parser.ts";

export interface Analysis {
  /** Every syntax error, checker error, warning and info note, in position order. */
  diagnostics: Diagnostic[];
  /** The program to run, or null when there are errors. */
  program: IrProgram | null;
}

/** Everything that happens before a run (what the check worker shows as the student types). */
export function analyse(source: string): Analysis {
  const parsed = parse(source);
  // Decision D1: while there are syntax errors, only they are shown (a broken line would cause follow-on errors).
  if (parsed.diagnostics.some((d) => d.severity === "error")) {
    return { diagnostics: sortDiagnostics(parsed.diagnostics), program: null };
  }
  const checked = checkProgram(parsed.program, source);
  const diagnostics = sortDiagnostics([...parsed.diagnostics, ...checked.diagnostics]);
  if (diagnostics.some((d) => d.severity === "error")) return { diagnostics, program: null };
  return { diagnostics, program: lowerProgram(parsed.program, source, checked.types) };
}

export const edexcelEngine: Engine = {
  check: (source) => analyse(source).diagnostics,
  start(request, emit) {
    const { diagnostics, program } = analyse(request.source);
    if (diagnostics.length > 0) emit({ type: "diagnostics", diagnostics });
    if (program === null) {
      emit({ type: "done", status: "error" }); // checker errors: the program doesn't run
      return { command: () => undefined };
    }
    return runProgram({ language: "edexcel", program, emit, trace: request.trace, breakpoints: request.breakpoints });
  },
};

// The Python engine: lexer -> parser -> lowering -> shared runtime, behind the engine-neutral Engine interface.
import { sortDiagnostics, type Diagnostic } from "../diagnostics.ts";
import type { Program } from "../ir/ir.ts";
import type { Engine } from "../runner/engine.ts";
import { runProgram } from "../runtime/driver.ts";
import { lower } from "./lower.ts";
import { Locator, Reporter } from "./locator.ts";
import { parse } from "./parser.ts";

export interface Analysis {
  diagnostics: Diagnostic[];
  program: Program | null;
}

export function analyse(source: string): Analysis {
  const report = new Reporter();
  const surface = parse(new Locator(source), report);
  const program = report.failed ? null : lower(surface, report);
  const diagnostics = sortDiagnostics(report.diagnostics);
  if (diagnostics.some((d) => d.severity === "error")) return { diagnostics, program: null };
  return { diagnostics, program };
}

export const pythonEngine: Engine = {
  check: (source) => analyse(source).diagnostics,
  start(request, emit) {
    const { diagnostics, program } = analyse(request.source);
    if (diagnostics.length > 0) emit({ type: "diagnostics", diagnostics });
    if (program === null) {
      emit({ type: "done", status: "error" });
      return { command: () => undefined };
    }
    return runProgram({
      language: "python",
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

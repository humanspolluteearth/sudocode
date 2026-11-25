// The converter (M10): Edexcel or Cambridge pseudocode in, Python out.
//
// Compiler concept: an *IR printer*, a code-generation back end that prints text instead of running the program.
// The pseudocode is lexed, parsed, checked and lowered by the same front ends the interpreter uses, so the converter
// never re-reads the student's syntax. It then prints the shared IR as Python. Because IR nodes already say which rule
// applies (`intDivFloor`, `forInclusive`, a `base` on every index), the printer only has to write the Python that
// follows that rule. Anything with no faithful Python version is refused with a message, never quietly changed.
import { analyse as analyseCie } from "../cie/engine.ts";
import { analyse as analyseEdexcel } from "../edexcel/engine.ts";
import type { Language } from "../language.ts";
import { Unprintable } from "./expr.ts";
import { Types } from "./types.ts";
import { newCx, preamble } from "./helpers.ts";
import { findRefusal, refusalWords, type RefusedFeature } from "./refuse.ts";
import { printProgram } from "./stmt.ts";

export type ConvertFrom = Extract<Language, "edexcel" | "cie">;
export type { RefusedFeature };

export type ConvertResult =
  | { ok: true; code: string }
  | {
      ok: false;
      code: "E-CONV-UNSUPPORTED";
      feature: RefusedFeature;
      line: number;
      column: number;
      message: string;
      hint: string;
    };

const refused = (feature: RefusedFeature, line: number, column: number): ConvertResult => ({
  ok: false,
  code: "E-CONV-UNSUPPORTED",
  feature,
  line,
  column,
  ...refusalWords(feature),
});

const NAME: Record<ConvertFrom, string> = { edexcel: "Edexcel pseudocode", cie: "Cambridge pseudocode" };

export function convertToPython(source: string, from: ConvertFrom): ConvertResult {
  const { diagnostics, program } = from === "edexcel" ? analyseEdexcel(source) : analyseCie(source);
  if (program === null) {
    const first = diagnostics.find((d) => d.severity === "error");
    return refused("problems", first?.line ?? 1, first?.column ?? 1);
  }
  const found = findRefusal(program);
  if (found !== null) return refused(found.feature, found.line, found.column);
  try {
    const cx = newCx(new Types(program));
    const body = printProgram(program, cx);
    const head = preamble(cx);
    const code = [`# Converted from ${NAME[from]} by Sudocode.`, head, body].filter((p) => p !== "").join("\n\n\n");
    return { ok: true, code: `${code}\n` };
  } catch (error) {
    if (error instanceof Unprintable) return refused("problems", 1, 1);
    throw error;
  }
}

/** Where a program can be converted to. Python is a target only: Python to pseudocode is not offered (CNV-02). */
export type ConvertTarget = Language;

/**
 * Convert between any two of the three languages (CNV-02). Edexcel and Cambridge go to each other and to Python.
 * Not written yet for the pseudocode targets: the tests in tests/converter/ are pending until it is.
 */
export function convert(source: string, from: ConvertFrom, to: ConvertTarget): ConvertResult {
  if (to === "python") return convertToPython(source, from);
  throw new Error(`converting ${from} to ${to} is not written yet`);
}

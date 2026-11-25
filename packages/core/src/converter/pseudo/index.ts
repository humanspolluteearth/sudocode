// Edexcel <-> Cambridge conversion (CNV-10..24): analyse, refuse, infer types, print the shared IR.
import { analyse as analyseCie } from "../../cie/engine.ts";
import { analyse as analyseEdexcel } from "../../edexcel/engine.ts";
import { findRefusal, refusalWords, type PseudoFeature } from "../refuse.ts";
import { Types } from "../types.ts";
import { attachComments, commentsOf, extractComments } from "./comments.ts";
import { Refuse, type Cx } from "./expr.ts";
import { Names, type PseudoTarget } from "./names.ts";
import { printProgramCie } from "./to-cie.ts";
import { printProgramEdexcel } from "./to-edexcel.ts";

export type PseudoResult =
  | { ok: true; code: string }
  | {
      ok: false;
      code: "E-CONV-UNSUPPORTED";
      feature: PseudoFeature;
      line: number;
      column: number;
      message: string;
      hint: string;
    };

const refused = (feature: PseudoFeature, line: number, column: number, detail?: string): PseudoResult => ({
  ok: false,
  code: "E-CONV-UNSUPPORTED",
  feature,
  line,
  column,
  ...refusalWords(feature, detail),
});

const HEADER: Record<PseudoTarget, string> = {
  cie: "// Converted from Edexcel pseudocode by Sudocode.",
  edexcel: "# Converted from Cambridge pseudocode by Sudocode.",
};

export function convertToPseudocode(source: string, from: PseudoTarget, to: PseudoTarget): PseudoResult {
  const { diagnostics, program } = from === "edexcel" ? analyseEdexcel(source) : analyseCie(source);
  if (program === null) {
    const first = diagnostics.find((d) => d.severity === "error");
    // `first` is only missing if the checker gave no program and no error; point at line 1 rather than crash.
    return refused("problems", first?.line ?? 1, first?.column ?? 1);
  }
  const found = findRefusal(program);
  if (found !== null) return refused(found.feature, found.line, found.column);
  const names = Names.build(program, from, to);
  if ("clash" in names) return refused("name-clash", 1, 1, names.clash);
  try {
    const cx: Cx = {
      target: to,
      types: new Types(program, true),
      names,
      sub: null,
      sizes: new Map(),
      pre: [],
      extra: [],
      canLift: true,
    };
    const write = (text: string): string => (to === "cie" ? `// ${text}` : `# ${text}`);
    const comments = commentsOf(
      attachComments(extractComments(source, from === "edexcel" ? "#" : "//"), program, write),
    );
    const body = to === "cie" ? printProgramCie(program, cx, comments) : printProgramEdexcel(program, cx, comments);
    return { ok: true, code: `${HEADER[to]}\n\n${body}\n` };
  } catch (error) {
    if (error instanceof Refuse) return refused(error.feature, error.line, error.column, error.detail);
    throw error;
  }
}

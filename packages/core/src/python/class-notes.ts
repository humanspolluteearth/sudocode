// PY-54: a friendly note when a class sets attributes in __init__ but never lists them in comments.
//
// Cambridge 9618 Paper 4 asks for the attributes of a class to be declared up front. Python has no such syntax, so
// students write them as comments (`# size: int`) above the first method. We only nudge; it is never an error.
import type { Span } from "../diagnostics.ts";
import type { SExpr, SStmt } from "./ast.ts";
import type { Reporter } from "./locator.ts";

/** The first attribute `self.<attr> = ...` that a block assigns, looking inside `if` and loops, or null. */
function firstSelfAttribute(body: readonly SStmt[], self: string): string | null {
  for (const s of body) {
    if (s.kind === "assign" || s.kind === "augassign") {
      const targets: SExpr[] = s.kind === "assign" ? s.targets : [s.target];
      for (const t of targets)
        if (t.kind === "attr" && t.target.kind === "name" && t.target.name === self) return t.name;
    }
    const nested =
      s.kind === "if" ? [...s.then, ...s.else] : s.kind === "while" || s.kind === "for" ? [...s.body, ...s.orelse] : [];
    const found = firstSelfAttribute(nested, self);
    if (found !== null) return found;
  }
  return null;
}

export function noteMissingDeclarations(
  name: string,
  body: readonly SStmt[],
  at: Span,
  source: string,
  report: Reporter,
): void {
  const init = body.find((s) => s.kind === "def" && s.name === "__init__");
  if (init?.kind !== "def") return;
  const self = init.params[0]?.name;
  if (self === undefined) return;
  const attribute = firstSelfAttribute(init.body, self);
  if (attribute === null) return;
  const firstMethod = body.find((s) => s.kind === "def") as SStmt;
  const header = source.slice(at.start, firstMethod.span.start);
  const lines = header.split("\n").slice(1);
  if (lines.some((l) => l.trim().startsWith("#"))) return;
  report.info("I-PY-CLASS-DECLARATIONS", at, { name, example: `${attribute}: type` });
}

// Turns the engine's diagnostics (SH-15) into what CodeMirror's lint layer draws as underlines.
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Diagnostic } from "@sudocode/core";

/** Offset of the first character of a 1-based line (clamped to the end of the source). */
export function lineStart(source: string, line: number): number {
  let offset = 0;
  for (let l = 1; l < line; l++) {
    const next = source.indexOf("\n", offset);
    if (next === -1) return source.length;
    offset = next + 1;
  }
  return offset;
}

function lineEnd(source: string, from: number): number {
  const next = source.indexOf("\n", from);
  return next === -1 ? source.length : next;
}

/** Underline range: the diagnostic's span, else its whole line; never empty unless the source is. */
export function underlineRange(source: string, d: Diagnostic): { from: number; to: number } {
  const from = Math.min(d.span?.start ?? lineStart(source, d.line), Math.max(0, source.length - 1));
  let to = d.span?.end ?? lineEnd(source, from);
  to = Math.min(Math.max(to, from + 1), source.length);
  return { from: Math.min(from, to), to };
}

export function toCodeMirrorDiagnostics(source: string, diagnostics: readonly Diagnostic[]): CmDiagnostic[] {
  return diagnostics.map((d): CmDiagnostic => {
    const { fix } = d;
    return {
      ...underlineRange(source, d),
      severity: d.severity,
      message: d.hint === "" ? d.message : `${d.message} ${d.hint}`,
      source: d.code,
      ...(fix === undefined
        ? {}
        : {
            actions: [
              {
                name: fix.label,
                apply(view) {
                  view.dispatch({
                    changes: fix.edits.map((e) => ({ from: e.start, to: e.end, insert: e.replacement })),
                  });
                },
              },
            ],
          }),
    };
  });
}

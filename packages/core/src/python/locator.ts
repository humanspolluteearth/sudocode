// Turning offsets into spans, and the helpers every Python front-end stage uses to report a problem.
import { makeDiagnostic } from "../messages/index.ts";
import type { Diagnostic, Span } from "../diagnostics.ts";

/** Maps UTF-16 offsets to line and column quickly (a binary search over the line starts), for every token. */
export class Locator {
  private readonly starts: number[] = [0];

  constructor(readonly source: string) {
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") this.starts.push(i + 1);
  }

  span(start: number, end: number): Span {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.starts[mid] as number) <= start) lo = mid;
      else hi = mid - 1;
    }
    const lineStart = this.starts[lo] as number;
    const column = Array.from(this.source.slice(lineStart, start)).length + 1;
    return { line: lo + 1, column, start, end: Math.max(end, start) };
  }
}

/** Collects the problems one run of the front end finds. */
export class Reporter {
  readonly diagnostics: Diagnostic[] = [];

  syntax(span: Span, detail: string, indentation = false): void {
    this.diagnostics.push(
      makeDiagnostic({
        code: indentation ? "E-PY-IndentationError" : "E-PY-SyntaxError",
        language: "python",
        span,
        args: { detail },
      }),
    );
  }

  notSupported(span: Span, feature: string, advice: string): void {
    this.diagnostics.push(
      makeDiagnostic({ code: "E-SYN-NOT-SUPPORTED", language: "python", span, args: { feature, advice } }),
    );
  }

  /** A friendly note that is not a mistake (code starts with I-). */
  info(code: string, span: Span, args: Record<string, string>): void {
    this.diagnostics.push(makeDiagnostic({ code, language: "python", span, args }));
  }

  get failed(): boolean {
    return this.diagnostics.some((d) => d.severity === "error");
  }
}

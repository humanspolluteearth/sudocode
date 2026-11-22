// Diagnostics: every error, warning and info note Sudocode shows a student (SH-15).
//
// Compiler concept: a *diagnostic* is the compiler's report about the source, separate from the text shown.
// The lexer, parser, checker and runtime only decide WHICH problem happened (a stable `code`) and WHERE (a span);
// the words come from the message catalogue (src/messages/), so they can be reviewed and tuned per language.

/**
 * A stretch of the student's source.
 * - `line` and `column` are 1-based and count Unicode code points: what the student sees in the editor.
 * - `start` and `end` are UTF-16 offsets into the source string (what JavaScript string methods use); `end` is
 *   exclusive.
 * Every token and syntax node carries one, and lowering copies it into the IR (CLAUDE.md).
 */
export interface Span {
  line: number;
  column: number;
  start: number;
  end: number;
}

export type Severity = "error" | "warning" | "info";

/** One replacement in the source, by UTF-16 offsets (`end` exclusive). */
export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

/** A suggested fix the editor can apply with one click, e.g. "Write END IF". */
export interface Fix {
  label: string;
  edits: TextEdit[];
}

/** What the student sees: where, what went wrong, how to put it right (SH-15). Plain data, safe to post to the UI. */
export interface Diagnostic {
  code: string;
  line: number;
  column: number;
  message: string;
  hint: string;
  fix?: Fix;
  severity: Severity;
  /** The full stretch to underline; `line`/`column` are its start. */
  span?: Span;
}

/** Codes: E- error, W- warning, I- info (the letter decides the severity); Python exceptions are E-PY-<Name>. */
const CODE_PATTERN = /^([EWI]-[A-Z][A-Z0-9]*(-[A-Z0-9]+)*|E-PY-[A-Z][A-Za-z]*)$/;

export function isDiagnosticCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function severityOf(code: string): Severity {
  if (!isDiagnosticCode(code)) throw new Error(`Not a diagnostic code: ${code}`);
  switch (code[0]) {
    case "E":
      return "error";
    case "W":
      return "warning";
    default:
      return "info";
  }
}

/**
 * Line and column (1-based, code points) of a UTF-16 offset. A line break is `\n` or `\r\n` (SH-01); an offset
 * on the `\n` of a `\r\n` pair belongs to the same line as the `\r`.
 */
export function positionAt(source: string, offset: number): { line: number; column: number } {
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) {
    throw new RangeError(`Offset ${String(offset)} is outside the source (length ${String(source.length)})`);
  }
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (source[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  if (source[offset] === "\n" && source[offset - 1] === "\r") {
    // Inside a \r\n pair: still the line that the \r ends.
    return { line, column: codePointLength(source.slice(lineStart, offset - 1)) + 1 };
  }
  return { line, column: codePointLength(source.slice(lineStart, offset)) + 1 };
}

/** The span from `start` to `end` (UTF-16 offsets, `end` exclusive). */
export function spanOf(source: string, start: number, end: number): Span {
  if (end < start) throw new RangeError(`Span end ${String(end)} is before its start ${String(start)}`);
  positionAt(source, end); // validates `end`
  return { ...positionAt(source, start), start, end };
}

function codePointLength(text: string): number {
  return Array.from(text).length;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Order shown to students and used by golden files: by line, then column, then severity, then code. */
export function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  return (
    a.line - b.line ||
    a.column - b.column ||
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  );
}

export function sortDiagnostics(list: readonly Diagnostic[]): Diagnostic[] {
  return [...list].sort(compareDiagnostics);
}

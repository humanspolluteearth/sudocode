// The bottom status bar: run state, problem counts, cursor position and language.
import type { Diagnostic } from "@sudocode/core";
import { BUG_EMAIL, BUG_MAILTO } from "./bug-report.ts";

export type RunState = "idle" | "checking" | "running" | "paused" | "waiting" | "finished" | "stopped" | "error";

export const STATE_TEXT: Record<RunState, string> = {
  idle: "Ready",
  checking: "Checking",
  running: "Running",
  paused: "Paused",
  waiting: "Waiting for input",
  finished: "Finished",
  stopped: "Stopped",
  error: "Stopped with an error",
};

/** The status bar's wording from the design: "Paused at line 7", "Error, line 3", "Waiting for input", "Finished", "Ready". */
export function statusText(state: RunState, line: number | null): string {
  if (state === "paused" && line !== null) return `Paused at line ${String(line)}`;
  if (state === "error") return line === null ? "Error" : `Error, line ${String(line)}`;
  return STATE_TEXT[state];
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface StatusBarProps {
  state: RunState;
  /** The line the run is paused at, or the line of its error. */
  line?: number | null;
  /** Where the editor's cursor is (1-based). */
  cursor?: CursorPosition;
  diagnostics: readonly Diagnostic[];
  languageName: string;
}

export function StatusBar({
  state,
  line = null,
  cursor = { line: 1, column: 1 },
  diagnostics,
  languageName,
}: StatusBarProps) {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  // The status follows the current code: while the program isn't running, a problem in it reads "Error, line N",
  // even if the last run finished fine or the error came from the checker rather than a runtime error.
  const firstError = diagnostics.find((d) => d.severity === "error");
  const idleLike = state === "idle" || state === "finished" || state === "stopped" || state === "error";
  const shown: RunState = idleLike && firstError !== undefined ? "error" : state;
  const shownLine = shown === "error" ? (state === "error" && line !== null ? line : (firstError?.line ?? null)) : line;
  return (
    <div className="sc-statusbar" role="status" aria-label="Status bar">
      <span>{statusText(shown, shownLine)}</span>
      <span>{`${String(errors)} ${errors === 1 ? "error" : "errors"}, ${String(warnings)} ${warnings === 1 ? "warning" : "warnings"}`}</span>
      <span className="sc-grow" />
      <span>{`Ln ${String(cursor.line)}, Col ${String(cursor.column)}`}</span>
      <span className="sc-hide-compact">{languageName}</span>
      <span className="sc-report">
        <a href={BUG_MAILTO}>
          Report a bug<span className="sc-hide-compact">{`: ${BUG_EMAIL}`}</span>
        </a>
      </span>
    </div>
  );
}

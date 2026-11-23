// The bottom status bar: run state, problem counts, cursor position and language.
import type { Diagnostic } from "@sudocode/core";

export type RunState = "idle" | "checking" | "running" | "paused" | "waiting" | "finished" | "stopped" | "error";

const STATE_TEXT: Record<RunState, string> = {
  idle: "Ready",
  checking: "Checking",
  running: "Running",
  paused: "Paused",
  waiting: "Waiting for input",
  finished: "Finished",
  stopped: "Stopped",
  error: "Stopped with an error",
};

export interface StatusBarProps {
  state: RunState;
  diagnostics: readonly Diagnostic[];
  languageName: string;
}

export function StatusBar({ state, diagnostics, languageName }: StatusBarProps) {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  return (
    <footer className="sc-statusbar" role="status" aria-label="Status bar">
      <span>{STATE_TEXT[state]}</span>
      <span>{`${String(errors)} ${errors === 1 ? "error" : "errors"}, ${String(warnings)} ${warnings === 1 ? "warning" : "warnings"}`}</span>
      <span className="sc-grow" />
      <span>{languageName}</span>
    </footer>
  );
}

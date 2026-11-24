// The protocol between the UI and the engine. The UI never imports a parser or the runtime: it talks to the
// engine only through a `Runner` (CLAUDE.md), which in the browser wraps a Web Worker.
//
// Two workers (docs/DECISIONS.md):
// - the CHECK worker lives as long as the editor and re-checks the source as the student types;
// - a fresh RUN worker is started for every run and thrown away afterwards, so Stop can always terminate it.
//
// Every message is plain JSON data (no classes, functions or Maps), so it survives `postMessage` unchanged and
// can be logged or replayed in tests. Debugger values are shown as text; the engine formats them per language.
import type { Diagnostic } from "./diagnostics.ts";
import type { Language } from "./language.ts";

/** Virtual files of a project: file name -> contents (SH-11). */
export type VirtualFiles = Record<string, string>;

/** Everything needed to start one run. */
export interface RunRequest {
  language: Language;
  source: string;
  /** Files that exist before the run. */
  files: VirtualFiles;
  /** Random seed (SH-12): fresh for normal runs, fixed for tests and replay. */
  seed: number;
  /** Today's date for TODAY() (CIE-129). Left out in the app, which then reads the real clock; tests fix it. */
  today?: { day: number; month: number; year: number };
  /** 1-based source lines with a breakpoint. */
  breakpoints: number[];
  /** Record trace rows (SH-17). Off when the trace panel is hidden, to save memory on small devices. */
  trace: boolean;
}

// ---------- UI -> run worker

export type RunnerCommand =
  | { type: "run"; request: RunRequest }
  /** A line typed by the student, without the newline (SH-05). */
  | { type: "input"; text: string }
  | { type: "pause" }
  | { type: "continue" }
  | { type: "stepOver" }
  | { type: "stepInto" }
  | { type: "stepOut" }
  | { type: "stop" }
  | { type: "setBreakpoints"; lines: number[] };

// ---------- run worker -> UI

/** One variable as the debugger shows it. */
export interface VariableView {
  name: string;
  /** The language's own type name, e.g. INTEGER, STRING, list. */
  type: string;
  /** The value as the language would print it. */
  value: string;
}

export interface StackFrame {
  /** Procedure or function name; the main program is "(main program)". */
  name: string;
  line: number;
  variables: VariableView[];
}

/** One trace-table row (SH-17): an assignment or an output, with its line. */
export type TraceRow =
  { kind: "assign"; line: number; variable: string; value: string } | { kind: "output"; line: number; text: string };

export type PauseReason = "breakpoint" | "step" | "pause" | "stepLimit";

export type RunStatus = "finished" | "stopped" | "error";

export type RunnerEvent =
  /** Text the program printed, including any newline it ends with. */
  | { type: "output"; text: string }
  /**
   * The program waits for a line of input (SH-05). Any prompt text is ALSO printed: the engine sends it as an
   * `output` event first (docs/TEST-PLAN.md section 3: prompts are part of stdout). `prompt` repeats it for the
   * input box; `device` is set for Edexcel devices other than KEYBOARD and is shown only there (EDX-74, Q8).
   */
  | { type: "inputRequest"; prompt: string; device?: string }
  /** Paused before running `line`; `stack[0]` is the innermost frame. `stepLimit` is SH-14's 10-million-step pause. */
  | { type: "paused"; reason: PauseReason; line: number; column: number; stack: StackFrame[] }
  /** New trace rows since the last batch (only when `RunRequest.trace` is on). Batched to keep messages few. */
  | { type: "traceRows"; rows: TraceRow[] }
  /** A virtual file's whole new contents after the program wrote to it. */
  | { type: "fileWrite"; name: string; contents: string }
  /** Checker results (errors stop the run before it starts; warnings and info notes don't). */
  | { type: "diagnostics"; diagnostics: Diagnostic[] }
  /** A runtime error or info note while running. A runtime error is followed by `done` with status "error". */
  | { type: "error"; diagnostic: Diagnostic }
  | { type: "done"; status: RunStatus };

// ---------- UI <-> check worker

export interface CheckRequest {
  type: "check";
  /** Increases with every request, so the UI can ignore answers to out-of-date source. */
  id: number;
  language: Language;
  source: string;
}

export interface CheckResponse {
  type: "checked";
  id: number;
  diagnostics: Diagnostic[];
}

// ---------- The engine-neutral interface the UI uses

export type RunnerListener = (event: RunnerEvent) => void;

export interface Runner {
  /** Sends a command (start a run, give input, step, stop...). */
  send(command: RunnerCommand): void;
  /** Listens to events; returns a function that stops listening. */
  subscribe(listener: RunnerListener): () => void;
  /** Ends the run for good and frees the engine (terminates the worker). */
  dispose(): void;
}

export { isCheckRequest, isCheckResponse, isRunnerCommand, isRunnerEvent } from "./protocol-guards.ts";

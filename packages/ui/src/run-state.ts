// What the IDE knows about the current run, as a pure reducer over runner events, so it is tested without a DOM.
import type { Diagnostic, PauseReason, RunnerEvent, StackFrame, TraceRow } from "@sudocode/core";
import type { InputWait } from "./Console.tsx";
import type { RunState } from "./StatusBar.tsx";

export interface Paused {
  reason: PauseReason;
  line: number;
  /** stack[0] is the innermost frame. */
  stack: StackFrame[];
}

export interface RunView {
  state: RunState;
  output: string;
  error: Diagnostic | null;
  note: string | null;
  waiting: InputWait | null;
  paused: Paused | null;
  /** Values of the innermost frame at the previous pause, if it was the same frame (for "changed" highlights). */
  previous: ReadonlyMap<string, string> | null;
  /** The innermost frame at the latest pause; kept while running so the next pause can compare. */
  lastFrame: StackFrame | null;
  trace: TraceRow[];
  traceRecorded: boolean;
}

export type RunAction =
  | { type: "start"; trace: boolean }
  | { type: "event"; event: RunnerEvent }
  /** The student typed a line: echo it in the console and stop waiting. */
  | { type: "typed"; text: string }
  /** Continue or Step over was pressed: the program runs again. */
  | { type: "resumed" }
  | { type: "clearOutput" };

export const initialRunView: RunView = {
  state: "idle",
  output: "",
  error: null,
  note: null,
  waiting: null,
  paused: null,
  previous: null,
  lastFrame: null,
  trace: [],
  traceRecorded: false,
};

const NOTE = { finished: "Finished.", stopped: "Stopped.", error: null } as const;

function onEvent(view: RunView, event: RunnerEvent): RunView {
  switch (event.type) {
    case "output":
      return { ...view, output: view.output + event.text };
    case "error":
      return { ...view, error: event.diagnostic };
    case "inputRequest":
      return {
        ...view,
        state: "waiting",
        waiting: event.device === undefined ? { prompt: event.prompt } : { prompt: event.prompt, device: event.device },
      };
    case "paused": {
      const frame = event.stack[0] ?? null;
      const last = view.lastFrame;
      const previous =
        frame !== null && last !== null && last.name === frame.name
          ? new Map(last.variables.map((v) => [v.name, v.value]))
          : null;
      return {
        ...view,
        state: "paused",
        paused: { reason: event.reason, line: event.line, stack: event.stack },
        previous,
        lastFrame: frame,
      };
    }
    case "traceRows":
      return { ...view, trace: [...view.trace, ...event.rows] };
    case "done":
      return { ...view, state: event.status, note: NOTE[event.status], waiting: null, paused: null };
    case "diagnostics":
    case "fileWrite":
      return view; // diagnostics are kept by the App; files arrive with M6
    default: {
      const unreachable: never = event;
      throw new Error(`Unknown event ${JSON.stringify(unreachable)}`);
    }
  }
}

export function runReducer(view: RunView, action: RunAction): RunView {
  switch (action.type) {
    case "start":
      return { ...initialRunView, state: "running", traceRecorded: action.trace };
    case "event":
      return onEvent(view, action.event);
    case "typed":
      return { ...view, state: "running", waiting: null, output: `${view.output}${action.text}\n` };
    case "resumed":
      return { ...view, state: "running", paused: null };
    case "clearOutput":
      return { ...view, output: "" };
    default: {
      const unreachable: never = action;
      throw new Error(`Unknown action ${JSON.stringify(unreachable)}`);
    }
  }
}

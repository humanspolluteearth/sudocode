// The driver runs a lowered program and reports what happens as RunnerEvents.
//
// Compiler concept: a *trampoline*. A recursive interpreter would run a call by calling itself, so 1,000 nested
// student calls would be 1,000 (times several) nested JavaScript frames, and a Web Worker's small stack
// overflows (docs/AUDIT.md, Performance). Instead each interpreted call is a separate generator kept on the
// driver's own array `frames`. When a body yields a "call" request, the driver pushes the callee's generator;
// when that generator returns, the driver pops it and resumes the caller with the value. The JavaScript stack
// then only grows with how deeply one expression is nested, never with the recursion depth (SH-13).
//
// The driver also owns everything about *when* the program runs: it runs a slice of steps, then gives the event
// loop a turn so Stop and Pause arrive; it pauses after SH-14's 10 million steps; and it waits for input.
import type { Span } from "../diagnostics.ts";
import type { Program } from "../ir/ir.ts";
import type { Language } from "../language.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { PauseReason, RunnerEvent, RunStatus, StackFrame } from "../protocol.ts";
import type { EngineRun } from "../runner/engine.ts";
import { formatValue, typeName } from "./format.ts";
import { runMain, runSubprogram, type Body, type Machine, type Request } from "./interpreter.ts";
import { RunError } from "./run-error.ts";
import { str, type Value } from "./values.ts";

export const DEFAULT_CALL_DEPTH = 1000; // SH-13
export const DEFAULT_STEP_LIMIT = 10_000_000; // SH-14

export interface DriverOptions {
  language: Language;
  program: Program;
  emit: (event: RunnerEvent) => void;
  /** Deepest allowed chain of subprogram calls (SH-13). */
  maxCallDepth?: number;
  /** Steps before the "possible infinite loop" pause (SH-14). */
  stepLimit?: number;
  /** Steps run before giving the event loop a turn. */
  sliceSteps?: number;
  /** Runs `resume` later; setTimeout by default (exists in Node and in Web Workers). */
  schedule?: (resume: () => void) => void;
}

interface Frame {
  name: string;
  body: Body;
  /** The frame's own variables; null for the main program, whose variables are the globals. */
  locals: Map<string, Value> | null;
  line: number;
  column: number;
}

type State = "running" | "paused" | "input" | "done";

export function runProgram(options: DriverOptions): EngineRun {
  const { language, program, emit } = options;
  const maxCallDepth = options.maxCallDepth ?? DEFAULT_CALL_DEPTH;
  const stepLimit = options.stepLimit ?? DEFAULT_STEP_LIMIT;
  const sliceSteps = options.sliceSteps ?? 50_000;
  const schedule = options.schedule ?? ((resume: () => void) => setTimeout(resume, 0));

  let state: State = "running";
  // Read through a function: commands and pauses change `state` inside callbacks TypeScript can't follow.
  const running = (): boolean => state === "running";
  let steps = 0;
  let pauseRequested = false;
  let pendingOutput = "";
  /** The value to resume the top frame with (a call's result or a line of input). */
  let resumeWith: Value | undefined;
  /** An error to raise in the top frame (it came from a callee, or from a call that was refused). */
  let raise: RunError | undefined;
  const noted = new Set<string>();

  const flush = (): void => {
    if (pendingOutput === "") return;
    emit({ type: "output", text: pendingOutput });
    pendingOutput = "";
  };

  const diagnostic = (code: string, span: Span, args: MessageArgs = {}, variant?: string) =>
    makeDiagnostic({ code, language, span, args, ...(variant === undefined ? {} : { variant }) });

  const machine: Machine = {
    format: program.format,
    globals: new Map(),
    output: (text) => {
      pendingOutput += text;
    },
    note: (code, span, args) => {
      if (noted.has(code)) return; // "an info note appears the first time" (EDX-27)
      noted.add(code);
      flush();
      emit({ type: "error", diagnostic: diagnostic(code, span, args) });
    },
  };

  const frames: Frame[] = [
    { name: "(main program)", body: runMain(program.main, machine), locals: null, line: 1, column: 1 },
  ];

  const finish = (status: RunStatus): void => {
    if (state === "done") return;
    state = "done";
    flush();
    emit({ type: "done", status });
  };

  const fail = (error: unknown): void => {
    if (state === "done") return;
    flush();
    const zero = { line: 1, column: 1, start: 0, end: 0 };
    const internal = (e: unknown) =>
      diagnostic("E-INTERNAL-ENGINE", zero, { detail: e instanceof Error ? e.message : String(e) });
    let d;
    try {
      d = error instanceof RunError ? diagnostic(error.code, error.span, error.args, error.variant) : internal(error);
    } catch (wordingBug) {
      d = internal(wordingBug); // even a missing message must still end the run, so the UI never waits forever
    }
    emit({ type: "error", diagnostic: d });
    finish("error");
  };

  const stack = (): StackFrame[] =>
    [...frames].reverse().map((f) => ({
      name: f.name,
      line: f.line,
      variables: [...(f.locals ?? machine.globals)].map(([name, value]) => ({
        name,
        type: typeName(value),
        value: formatValue(value, program.format),
      })),
    }));

  const pause = (reason: PauseReason): void => {
    state = "paused";
    flush();
    const top = frames[frames.length - 1];
    emit({ type: "paused", reason, line: top?.line ?? 1, column: top?.column ?? 1, stack: stack() });
  };

  const call = (callee: string, args: Value[], span: Span): void => {
    const sub = program.subprograms[callee];
    if (sub === undefined) throw new Error(`No subprogram called ${callee}`);
    if (frames.length - 1 >= maxCallDepth) {
      raise = new RunError("E-RUN-RECURSION-LIMIT", span, { name: callee });
      return;
    }
    const locals = new Map<string, Value>();
    frames.push({
      name: callee,
      body: runSubprogram(sub, args, machine, locals),
      locals,
      line: span.line,
      column: span.column,
    });
  };

  /** Runs until the slice is used up, the program pauses, waits, or ends. */
  const slice = (): void => {
    if (state !== "running") return;
    let budget = sliceSteps;
    try {
      while (running()) {
        const frame = frames[frames.length - 1];
        if (frame === undefined) {
          finish("finished");
          return;
        }
        let result: IteratorResult<unknown, Value | undefined>;
        try {
          if (raise !== undefined) {
            const error = raise;
            raise = undefined;
            result = frame.body.throw(error);
          } else {
            const value = resumeWith;
            resumeWith = undefined;
            result = frame.body.next(value);
          }
        } catch (error) {
          // The frame failed: unwind it and raise the error in its caller (where a future TRY could catch it).
          frames.pop();
          if (error instanceof RunError && frames.length > 0) {
            raise = error;
            continue;
          }
          throw error;
        }
        if (result.done === true) {
          frames.pop();
          if (frames.length === 0) {
            finish("finished");
            return;
          }
          resumeWith = result.value;
          continue;
        }
        const request = result.value as Request;
        if (handle(request, frame) === "yield" || --budget > 0) continue;
        flush();
        schedule(slice);
        return;
      }
    } catch (error) {
      fail(error);
    }
  };

  /** Handles one request; "yield" means it didn't use a step (so it doesn't count against the slice). */
  const handle = (request: Request, frame: Frame): "step" | "yield" => {
    switch (request.type) {
      case "step":
        frame.line = request.span.line;
        frame.column = request.span.column;
        steps++;
        if (pauseRequested) {
          pauseRequested = false;
          pause("pause");
        } else if (steps >= stepLimit) {
          steps = 0;
          pause("stepLimit");
        }
        return "step";
      case "call":
        call(request.callee, request.args, request.span);
        return "yield";
      case "input":
        state = "input";
        flush();
        if (request.prompt !== "") emit({ type: "output", text: request.prompt });
        emit({
          type: "inputRequest",
          prompt: request.prompt,
          ...(request.device === null ? {} : { device: request.device }),
        });
        return "yield";
      default: {
        const unreachable: never = request;
        throw new Error(`Unknown request ${JSON.stringify(unreachable)}`);
      }
    }
  };

  schedule(slice);

  return {
    command(command) {
      switch (command.type) {
        case "stop":
          finish("stopped");
          return;
        case "input":
          if (state !== "input") return;
          resumeWith = str(command.text);
          state = "running";
          schedule(slice);
          return;
        case "pause":
          if (state === "running") pauseRequested = true;
          return;
        // Stepping and breakpoints arrive with the debugger (M4); until then a step simply continues.
        case "continue":
        case "stepOver":
        case "stepInto":
        case "stepOut":
          if (state !== "paused") return;
          state = "running";
          schedule(slice);
          return;
        case "setBreakpoints":
          return; // M4
        default: {
          const unreachable: never = command;
          throw new Error(`Unknown command ${JSON.stringify(unreachable)}`);
        }
      }
    },
  };
}

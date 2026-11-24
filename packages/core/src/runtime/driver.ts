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
import type { FileMode, Program } from "../ir/ir.ts";
import type { Language } from "../language.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";
import type { PauseReason, VirtualFiles, RunnerEvent, RunStatus, StackFrame, TraceRow } from "../protocol.ts";
import type { EngineRun } from "../runner/engine.ts";
import { formatValue, typeName } from "./format.ts";
import { seededRandom } from "./random.ts";
import { copyOf } from "./evaluate.ts";
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
  /** 1-based lines with a breakpoint: the run pauses before any statement that starts on one. */
  breakpoints?: readonly number[];
  /** Record the trace table (SH-17); off by default, as the rows use memory. */
  trace?: boolean;
  /** Seed for RANDOM (SH-12); a fresh one when left out. */
  seed?: number;
  /** The date TODAY() returns; the real clock when left out (dependency injection, so tests are repeatable). */
  today?: { day: number; month: number; year: number };
  /** Files that exist before the run: name -> contents (SH-11). */
  files?: VirtualFiles;
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
  const nextRandom = seededRandom(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const sliceSteps = options.sliceSteps ?? 50_000;
  const schedule = options.schedule ?? ((resume: () => void) => setTimeout(resume, 0));

  let state: State = "running";
  // Read through a function: commands and pauses change `state` inside callbacks TypeScript can't follow.
  const running = (): boolean => state === "running";
  let steps = 0;
  let pauseRequested = false;
  let breakpoints = new Set(options.breakpoints ?? []);
  /**
   * While stepping: pause at the next statement run with at most this many frames on the stack. Step over keeps the
   * depth it was sent at (so a call runs through), Step into allows any depth, Step out one fewer than now.
   */
  let stepDepth: number | null = null;
  let pendingOutput = "";
  /** Trace rows not sent yet: like output, they go out in batches (protocol.ts) and always before a pause. */
  let pendingTrace: TraceRow[] = [];
  const tracing = options.trace ?? false;
  /** The value to resume the top frame with (a call's result or a line of input). */
  let resumeWith: Value | undefined;
  /** An error to raise in the top frame (it came from a callee, or from a call that was refused). */
  let raise: RunError | undefined;
  const noted = new Set<string>();
  /** Files written since the last flush; each goes out once, with its whole new contents. */
  const pendingFiles = new Map<string, string>();

  const flush = (): void => {
    if (pendingTrace.length > 0) {
      emit({ type: "traceRows", rows: pendingTrace });
      pendingTrace = [];
    }
    for (const [name, contents] of pendingFiles) emit({ type: "fileWrite", name, contents });
    pendingFiles.clear();
    if (pendingOutput === "") return;
    emit({ type: "output", text: pendingOutput });
    pendingOutput = "";
  };

  const diagnostic = (code: string, span: Span, args: MessageArgs = {}, variant?: string) =>
    makeDiagnostic({ code, language, span, args, ...(variant === undefined ? {} : { variant }) });

  // Compiler concept: an *I/O effect* kept behind the machine. The program only says "read a line" or "write a
  // line"; this table is the whole virtual file system, so the same program runs in Node, a Worker or a test. Names
  // match without regard to case (SH-11); `kept` remembers the spelling first used.
  interface VFile {
    name: string;
    text: string;
    position: number;
    written: boolean;
    /** Set by OPENFILE (CIE-90); null for a file Edexcel code reads or writes without opening. */
    mode: FileMode | null;
    openedAt: Span | null;
    /** Random-file records (CIE-94); a hole is an empty slot (CIE-95). */
    records: (Value | undefined)[];
    address: number;
  }
  const store = new Map<string, VFile>();
  const fresh = (name: string, text: string, written: boolean): VFile => ({
    name,
    text,
    position: 0,
    written,
    mode: null,
    openedAt: null,
    records: [],
    address: 1,
  });
  for (const [name, text] of Object.entries(options.files ?? {}))
    store.set(name.toLowerCase(), fresh(name, text, false));
  const modeName = (m: FileMode | null): string => (m === null ? "closed" : m.toUpperCase());
  /** Cambridge files must be open in the right mode (CIE-93); `strict` is false for Edexcel's unopened files. */
  const need = (file: string, span: Span, modes: FileMode[], strict: boolean): VFile | undefined => {
    const f = store.get(file.toLowerCase());
    if (!strict) return f;
    if (f?.mode == null) throw new RunError("E-RUN-FILE-NOT-OPEN", span, { file });
    if (!modes.includes(f.mode)) throw new RunError("E-RUN-FILE-MODE", span, { file: f.name, mode: modeName(f.mode) });
    return f;
  };

  const machine: Machine = {
    format: program.format,
    globals: new Map(),
    output: (text, span) => {
      pendingOutput += text;
      // D4: an output row holds the line as the console shows it, without its newline.
      if (tracing) pendingTrace.push({ kind: "output", line: span.line, text: text.replace(/\n$/, "") });
    },
    readLine: (file, span, strict = false) => {
      const f = need(file, span, ["read"], strict);
      if (f === undefined) throw new RunError("E-RUN-FILE-NOT-FOUND", span, { file });
      // Lines end with "\n" (or "\r\n"); a final newline does not start another, empty line.
      const lines = f.text === "" ? [] : f.text.replace(/\r?\n$/, "").split(/\r?\n/);
      const line = lines[f.position];
      if (line === undefined) throw new RunError("E-RUN-READ-PAST-END", span, { file: f.name });
      f.position++;
      return line;
    },
    writeLine: (file, text, span, strict = false) => {
      const key = file.toLowerCase();
      let f = need(file, span, ["write", "append"], strict);
      if (f === undefined) {
        f = fresh(file, "", true);
        store.set(key, f);
      } else if (!f.written) {
        f.text = ""; // EDX-83: the first WRITE of a run replaces the old contents
        f.written = true;
      }
      f.text += `${text}\n`;
      pendingFiles.set(f.name, f.text);
    },
    openFile: (file, mode, span) => {
      const key = file.toLowerCase();
      let f = store.get(key);
      if (f?.mode != null) throw new RunError("E-RUN-FILE-ALREADY-OPEN", span, { file: f.name });
      if (mode === "read" || mode === "random") {
        if (f === undefined) throw new RunError("E-RUN-FILE-NOT-FOUND", span, { file }); // CIE-97, SH-11
      } else if (f === undefined) {
        f = fresh(file, "", true);
        store.set(key, f);
      }
      if (mode === "write") {
        f.text = ""; // CIE-91: WRITE loses any old data
        f.records = [];
        pendingFiles.set(f.name, "");
      }
      f.written = true;
      f.mode = mode;
      f.openedAt = span;
      f.position = 0;
      f.address = 1;
    },
    closeFile: (file, span) => {
      const f = need(file, span, ["read", "write", "append", "random"], true);
      if (f !== undefined) {
        f.mode = null;
        f.openedAt = null;
      }
    },
    eof: (file, span) => {
      const f = need(file, span, ["read"], true);
      if (f === undefined) return true;
      const lines = f.text === "" ? 0 : f.text.replace(/\r?\n$/, "").split(/\r?\n/).length;
      return f.position >= lines;
    },
    seek: (file, address, span) => {
      const f = need(file, span, ["random"], true);
      if (f === undefined) return;
      if (address < 1) throw new RunError("E-RUN-RECORD-EMPTY", span, { file: f.name, address });
      f.address = address;
    },
    getRecord: (file, span) => {
      const f = need(file, span, ["random"], true);
      const v = f?.records[f.address - 1];
      if (f === undefined || v === undefined)
        throw new RunError("E-RUN-RECORD-EMPTY", span, { file: f?.name ?? file, address: f?.address ?? 0 });
      return copyOf(v);
    },
    putRecord: (file, value, span) => {
      const f = need(file, span, ["random"], true);
      if (f !== undefined) f.records[f.address - 1] = copyOf(value);
    },
    leftOpen: () => {
      for (const f of store.values())
        if (f.mode !== null && f.openedAt !== null) return { file: f.name, span: f.openedAt };
      return null;
    },
    assigned: (name, value, span) => {
      if (tracing && !name.startsWith("$")) {
        // `$` names are the front end's hidden variables
        pendingTrace.push({
          kind: "assign",
          line: span.line,
          variable: name,
          value: formatValue(value, program.format),
        });
      }
    },
    random: (max) => Math.floor(nextRandom() * (max + 1)),
    randomReal: () => nextRandom(),
    today: () => {
      if (options.today !== undefined) return options.today;
      const now = new Date();
      return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
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

  /** The program ran off its end: a file still open is an error (CIE-96). */
  const end = (): void => {
    const open = machine.leftOpen();
    if (open === null) finish("finished");
    else fail(new RunError("E-RUN-FILE-LEFT-OPEN", open.span, { file: open.file }));
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
      variables: [...(f.locals ?? machine.globals)]
        .filter(([name]) => !name.startsWith("$"))
        .map(([name, value]) => ({
          name,
          type: typeName(value, program.format),
          value: formatValue(value, program.format),
        })),
    }));

  const pause = (reason: PauseReason): void => {
    state = "paused";
    stepDepth = null;
    flush();
    const top = frames[frames.length - 1];
    emit({ type: "paused", reason, line: top?.line ?? 1, column: top?.column ?? 1, stack: stack() });
  };

  const call = (callee: string, args: Value[], span: Span): void => {
    const sub = program.subprograms[callee];
    if (sub === undefined) throw new Error(`No subprogram called ${callee}`);
    if (frames.length - 1 >= maxCallDepth) {
      raise =
        program.format === "python"
          ? new RunError("E-PY-RecursionError", span, { detail: "maximum recursion depth exceeded" })
          : new RunError("E-RUN-RECURSION-LIMIT", span, { name: callee });
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
          end();
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
            end();
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
        } else if (breakpoints.has(request.span.line)) {
          pause("breakpoint");
        } else if (stepDepth !== null && frames.length <= stepDepth) {
          pause("step");
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
        case "continue":
        case "stepOver":
        case "stepInto":
        case "stepOut": {
          if (state !== "paused") return;
          const depth = { continue: null, stepOver: frames.length, stepInto: Infinity, stepOut: frames.length - 1 };
          stepDepth = depth[command.type];
          state = "running";
          schedule(slice);
          return;
        }
        case "setBreakpoints":
          breakpoints = new Set(command.lines);
          return;
        default: {
          const unreachable: never = command;
          throw new Error(`Unknown command ${JSON.stringify(unreachable)}`);
        }
      }
    },
  };
}

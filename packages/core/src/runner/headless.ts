// Runs a program to the end without a UI: typed input comes from a list, and everything the program does is
// collected. The golden test runner uses this; a command-line runner could too.
import type { Diagnostic } from "../diagnostics.ts";
import type { Runner, RunRequest, RunStatus, TraceRow, VirtualFiles } from "../protocol.ts";

export interface HeadlessResult {
  stdout: string;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  info: Diagnostic[];
  /** The virtual files after the run: the starting files plus every write. */
  files: VirtualFiles;
  trace: TraceRow[];
  status: RunStatus;
  /** Set when the program asked for more input than `inputs` had (the run was stopped there). */
  inputStarved: boolean;
  /** Set when the run paused for the step limit (SH-14) and was stopped. */
  stepLimitReached: boolean;
}

export function runHeadless(runner: Runner, request: RunRequest, inputs: readonly string[]): Promise<HeadlessResult> {
  const result: HeadlessResult = {
    stdout: "",
    errors: [],
    warnings: [],
    info: [],
    files: { ...request.files },
    trace: [],
    status: "finished",
    inputStarved: false,
    stepLimitReached: false,
  };
  const queue = [...inputs];
  const sort = (d: Diagnostic): void => {
    const list = { error: result.errors, warning: result.warnings, info: result.info }[d.severity];
    list.push(d);
  };

  return new Promise((resolve) => {
    const unsubscribe = runner.subscribe((event) => {
      switch (event.type) {
        case "output":
          result.stdout += event.text;
          break;
        // The prompt itself arrives as an `output` event (protocol.ts), so it is already in stdout.
        case "inputRequest": {
          const next = queue.shift();
          if (next === undefined) {
            result.inputStarved = true;
            runner.send({ type: "stop" });
          } else {
            runner.send({ type: "input", text: next });
          }
          break;
        }
        case "paused":
          // Headless runs have no breakpoints; the only pause is SH-14's step limit, which ends the run here.
          if (event.reason === "stepLimit") result.stepLimitReached = true;
          runner.send(event.reason === "stepLimit" ? { type: "stop" } : { type: "continue" });
          break;
        case "traceRows":
          result.trace.push(...event.rows);
          break;
        case "fileWrite":
          result.files[event.name] = event.contents;
          break;
        case "diagnostics":
          event.diagnostics.forEach(sort);
          break;
        case "error":
          sort(event.diagnostic);
          break;
        case "done":
          result.status = event.status;
          unsubscribe();
          runner.dispose();
          resolve(result);
          break;
        default: {
          const unreachable: never = event;
          throw new Error(`Unknown runner event ${JSON.stringify(unreachable)}`);
        }
      }
    });
    runner.send({ type: "run", request });
  });
}

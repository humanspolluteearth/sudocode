// The debugger session harness (docs/TEST-PLAN.md, M4): runs a program through the Runner the way the IDE does,
// with breakpoints, and plays a script of debugger commands. Each pause is checked against the script (reason,
// line, the main program's variables, the trace rows so far), then the script's command is sent.
//
// A session is `tests/debugger/<ID>-<name>.epc` plus `<ID>-<name>.session.json`; its pending.json ID is
// `debugger/<ID>-<name>`, as for golden programs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Diagnostic } from "../../src/diagnostics.ts";
import type { Language } from "../../src/language.ts";
import type { PauseReason, Runner, RunnerCommand, RunStatus, TraceRow } from "../../src/protocol.ts";
import { TESTS_DIR, type ExpectedDiagnostic } from "./golden.ts";

export const DEBUGGER_DIR = join(TESTS_DIR, "debugger");

/** What one pause must look like. Fields left out are not checked. */
export interface PauseExpectation {
  reason: PauseReason;
  line?: number;
  /** Every variable of the main program, name to value as the debugger shows it (exact set). */
  variables?: Record<string, string>;
  /** Types of some variables, name to the language's type name. */
  types?: Record<string, string>;
  /** Every trace row received before this pause, in order. */
  trace?: TraceRow[];
}

export interface ScriptStep {
  expect: PauseExpectation;
  /** Breakpoints to set while paused, before `then` is sent. */
  setBreakpoints?: number[];
  then: "continue" | "stepOver" | "pause" | "stop";
}

export interface SessionFile {
  spec: string[];
  language: Language;
  breakpoints: number[];
  inputs?: string[];
  trace: boolean;
  /** Send `pause` straight after `run`, as the IDE's "Step" button does before a run has started. */
  pauseAtStart?: boolean;
  script: ScriptStep[];
  expect: {
    stdout: string;
    status: RunStatus;
    errors?: ExpectedDiagnostic[];
    /** Every input request, in order (prompt and device). */
    inputRequests?: { prompt: string; device?: string }[];
    /** The whole trace (needs `trace: true`). */
    trace?: TraceRow[];
  };
  notes?: string;
}

export interface SessionCase {
  id: string;
  name: string;
  source: string;
  session: SessionFile;
}

export function discoverSessions(dir: string = DEBUGGER_DIR): SessionCase[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".epc"))
    .sort()
    .map((f) => {
      const name = f.replace(/\.epc$/, "");
      return {
        id: `debugger/${name}`,
        name,
        source: readFileSync(join(dir, f), "utf8"),
        session: JSON.parse(readFileSync(join(dir, `${name}.session.json`), "utf8")) as SessionFile,
      };
    });
}

/** Plays the session; returns every way it differs from the file (empty means it passes). */
export function playSession(runner: Runner, source: string, session: SessionFile): Promise<string[]> {
  const problems: string[] = [];
  const inputs = [...(session.inputs ?? [])];
  const inputRequests: { prompt: string; device?: string }[] = [];
  const trace: TraceRow[] = [];
  const errors: Diagnostic[] = [];
  let stdout = "";
  let step = 0;

  const send = (c: RunnerCommand): void => {
    runner.send(c);
  };

  return new Promise((resolve) => {
    const unsubscribe = runner.subscribe((event) => {
      switch (event.type) {
        case "output":
          stdout += event.text;
          break;
        case "inputRequest": {
          inputRequests.push(
            event.device === undefined ? { prompt: event.prompt } : { prompt: event.prompt, device: event.device },
          );
          const next = inputs.shift();
          send(next === undefined ? { type: "stop" } : { type: "input", text: next });
          break;
        }
        case "paused": {
          const scripted = session.script[step];
          step += 1;
          if (scripted === undefined) {
            problems.push(`unexpected pause #${String(step)} (${event.reason} at line ${String(event.line)})`);
            send({ type: "stop" });
            break;
          }
          const where = `pause #${String(step)}`;
          const want = scripted.expect;
          if (event.reason !== want.reason) problems.push(`${where}: reason ${event.reason}, expected ${want.reason}`);
          if (want.line !== undefined && event.line !== want.line) {
            problems.push(`${where}: line ${String(event.line)}, expected ${String(want.line)}`);
          }
          const main = event.stack[event.stack.length - 1]?.variables ?? [];
          if (want.variables !== undefined) {
            const got = Object.fromEntries(main.map((v) => [v.name, v.value]));
            if (!isDeepStrictEqual(got, want.variables)) {
              problems.push(`${where}: variables ${JSON.stringify(got)}, expected ${JSON.stringify(want.variables)}`);
            }
          }
          for (const [name, type] of Object.entries(want.types ?? {})) {
            const got = main.find((v) => v.name === name)?.type;
            if (got !== type) problems.push(`${where}: ${name} has type ${String(got)}, expected ${type}`);
          }
          if (want.trace !== undefined && !isDeepStrictEqual(trace, want.trace)) {
            problems.push(`${where}: trace so far ${JSON.stringify(trace)}, expected ${JSON.stringify(want.trace)}`);
          }
          if (scripted.setBreakpoints !== undefined) send({ type: "setBreakpoints", lines: scripted.setBreakpoints });
          send({ type: scripted.then });
          break;
        }
        case "traceRows":
          trace.push(...event.rows);
          break;
        case "fileWrite":
          break;
        case "diagnostics":
          errors.push(...event.diagnostics.filter((d) => d.severity === "error"));
          break;
        case "error":
          if (event.diagnostic.severity === "error") errors.push(event.diagnostic);
          break;
        case "done": {
          unsubscribe();
          runner.dispose();
          const want = session.expect;
          if (inputs.length > 0)
            problems.push(`${String(inputs.length)} input line(s) never read: ${JSON.stringify(inputs)}`);
          if (step < session.script.length) {
            problems.push(`the run ended after ${String(step)} of ${String(session.script.length)} scripted pauses`);
          }
          if (stdout !== want.stdout)
            problems.push(`stdout ${JSON.stringify(stdout)}, expected ${JSON.stringify(want.stdout)}`);
          if (event.status !== want.status) problems.push(`status ${event.status}, expected ${want.status}`);
          const pos = (d: { code: string; line: number; column: number }): string =>
            `${d.code} ${String(d.line)}:${String(d.column)}`;
          const gotErrors = errors.map(pos);
          const wantErrors = (want.errors ?? []).map(pos);
          if (!isDeepStrictEqual(gotErrors, wantErrors)) {
            problems.push(`errors [${gotErrors.join(", ")}], expected [${wantErrors.join(", ")}]`);
          }
          if (want.inputRequests !== undefined && !isDeepStrictEqual(inputRequests, want.inputRequests)) {
            problems.push(
              `input requests ${JSON.stringify(inputRequests)}, expected ${JSON.stringify(want.inputRequests)}`,
            );
          }
          if (want.trace !== undefined && !isDeepStrictEqual(trace, want.trace)) {
            problems.push(`trace ${JSON.stringify(trace)}, expected ${JSON.stringify(want.trace)}`);
          }
          resolve(problems);
          break;
        }
        default: {
          const unreachable: never = event;
          throw new Error(`Unknown runner event ${JSON.stringify(unreachable)}`);
        }
      }
    });
    send({
      type: "run",
      request: {
        language: session.language,
        source,
        files: {},
        seed: 1,
        breakpoints: session.breakpoints,
        trace: session.trace,
      },
    });
    if (session.pauseAtStart === true) send({ type: "pause" });
  });
}

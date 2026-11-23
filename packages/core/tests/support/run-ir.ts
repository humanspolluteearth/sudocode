// Runs hand-written core IR through the driver and collects what happened (runtime unit tests).
import type { Program } from "../../src/ir/ir.ts";
import type { RunnerCommand, RunnerEvent } from "../../src/protocol.ts";
import { runProgram, type DriverOptions } from "../../src/runtime/driver.ts";

export interface Outcome {
  events: RunnerEvent[];
  stdout: string;
  status: string | undefined;
  errors: string[];
}

/** Runs a program to its `done` event. `react` may answer events (e.g. continue after a pause). */
export function run(
  prog: Program,
  options: Partial<DriverOptions> = {},
  react: (event: RunnerEvent, send: (c: Exclude<RunnerCommand, { type: "run" }>) => void) => void = () => undefined,
): Promise<Outcome> {
  return new Promise((resolve) => {
    const events: RunnerEvent[] = [];
    const engine = runProgram({
      language: "edexcel",
      program: prog,
      ...options,
      emit: (event) => {
        events.push(event);
        if (event.type === "done") {
          resolve({
            events,
            stdout: events.map((e) => (e.type === "output" ? e.text : "")).join(""),
            status: event.status,
            errors: events.flatMap((e) =>
              e.type === "error" ? [`${e.diagnostic.code} ${String(e.diagnostic.line)}`] : [],
            ),
          });
        } else {
          setTimeout(() => {
            react(event, (c) => {
              engine.command(c);
            });
          }, 0);
        }
      },
    });
  });
}

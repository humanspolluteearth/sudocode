// Test helper: sends commands to a Runner and collects every event up to and including `done`.
import type { Runner, RunnerCommand, RunnerEvent } from "../../src/protocol.ts";

export function runToDone(runner: Runner, commands: RunnerCommand[]): Promise<RunnerEvent[]> {
  return new Promise((resolve) => {
    const events: RunnerEvent[] = [];
    runner.subscribe((e) => {
      events.push(e);
      if (e.type === "done") resolve(events);
    });
    for (const c of commands) runner.send(c);
  });
}

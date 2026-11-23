import type { RunnerEvent, StackFrame } from "@sudocode/core";
import { describe, expect, it } from "vitest";
import { initialRunView, runReducer, type RunAction, type RunView } from "./run-state.ts";

const frame = (vars: Record<string, string>, name = "(main program)"): StackFrame => ({
  name,
  line: 1,
  variables: Object.entries(vars).map(([n, value]) => ({ name: n, type: "INTEGER", value })),
});
const ev = (event: RunnerEvent): RunAction => ({ type: "event", event });
const play = (...actions: RunAction[]): RunView => actions.reduce(runReducer, initialRunView);

describe("MISC run state", () => {
  it("MISC start clears the last run and remembers whether the trace is recorded", () => {
    const before = play({ type: "start", trace: false }, ev({ type: "output", text: "old\n" }));
    const view = runReducer(before, { type: "start", trace: true });
    expect(view.output).toBe("");
    expect(view.state).toBe("running");
    expect(view.traceRecorded).toBe(true);
  });

  it("SH-05 an input request waits with the device; the typed line is echoed and the run goes on", () => {
    const waiting = play({ type: "start", trace: false }, ev({ type: "inputRequest", prompt: "", device: "SENSOR" }));
    expect(waiting.state).toBe("waiting");
    expect(waiting.waiting).toEqual({ prompt: "", device: "SENSOR" });
    const typed = runReducer(waiting, { type: "typed", text: "42" });
    expect(typed.output).toBe("42\n");
    expect(typed.waiting).toBeNull();
    expect(typed.state).toBe("running");
  });

  it("MISC a pause shows its frame; the next pause in the same frame knows the old values", () => {
    const first = play(
      { type: "start", trace: false },
      ev({ type: "paused", reason: "breakpoint", line: 2, column: 1, stack: [frame({ x: "1" })] }),
    );
    expect(first.state).toBe("paused");
    expect(first.previous).toBeNull();
    const second = play(
      { type: "start", trace: false },
      ev({ type: "paused", reason: "breakpoint", line: 2, column: 1, stack: [frame({ x: "1" })] }),
      { type: "resumed" },
      ev({ type: "paused", reason: "step", line: 3, column: 1, stack: [frame({ x: "2", y: "5" })] }),
    );
    expect(second.paused?.line).toBe(3);
    expect(second.previous).toEqual(new Map([["x", "1"]]));
  });

  it("MISC a pause in a different frame has nothing to compare with", () => {
    const view = play(
      { type: "start", trace: false },
      ev({ type: "paused", reason: "step", line: 5, column: 1, stack: [frame({ x: "1" })] }),
      { type: "resumed" },
      ev({ type: "paused", reason: "step", line: 2, column: 1, stack: [frame({ n: "1" }, "Double")] }),
    );
    expect(view.previous).toBeNull();
  });

  it("MISC resuming clears the pause", () => {
    const view = play(
      { type: "start", trace: false },
      ev({ type: "paused", reason: "pause", line: 4, column: 1, stack: [frame({})] }),
      { type: "resumed" },
    );
    expect(view.paused).toBeNull();
    expect(view.state).toBe("running");
  });

  it("SH-17 trace rows arrive in batches and are kept in order", () => {
    const view = play(
      { type: "start", trace: true },
      ev({ type: "traceRows", rows: [{ kind: "assign", line: 1, variable: "x", value: "1" }] }),
      ev({ type: "traceRows", rows: [{ kind: "output", line: 2, text: "1" }] }),
    );
    expect(view.trace).toEqual([
      { kind: "assign", line: 1, variable: "x", value: "1" },
      { kind: "output", line: 2, text: "1" },
    ]);
  });

  it.each([
    ["finished", "Finished."],
    ["stopped", "Stopped."],
    ["error", null],
  ] as const)("MISC done with %s ends any wait or pause and notes %s", (status, note) => {
    const view = play(
      { type: "start", trace: false },
      ev({ type: "inputRequest", prompt: "" }),
      ev({ type: "done", status }),
    );
    expect(view.state).toBe(status);
    expect(view.note).toBe(note);
    expect(view.waiting).toBeNull();
    expect(view.paused).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { Runner, RunnerCommand, RunnerEvent, RunnerListener } from "../../src/protocol.ts";
import { playSession, type SessionFile } from "./session.ts";

// Self-tests for the debugger session harness: a fake Runner plays back fixed events, so each test shows that
// playSession reports a session that doesn't match. A harness that could not fail would let pending sessions "pass".

/** Plays `script` in reply to commands: `run` gets the first batch, then each other command gets the next one. */
function fakeRunner(batches: RunnerEvent[][]): Runner & { sent: RunnerCommand[] } {
  const listeners = new Set<RunnerListener>();
  const sent: RunnerCommand[] = [];
  let next = 0;
  const emit = (): void => {
    const batch = batches[next];
    next += 1;
    for (const e of batch ?? []) for (const l of [...listeners]) l(e);
  };
  return {
    sent,
    send(command) {
      sent.push(command);
      if (command.type === "setBreakpoints") return;
      queueMicrotask(emit);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
  };
}

const paused = (line: number, vars: Record<string, string> = {}): RunnerEvent => ({
  type: "paused",
  reason: "breakpoint",
  line,
  column: 1,
  stack: [
    {
      name: "(main program)",
      line,
      variables: Object.entries(vars).map(([name, value]) => ({ name, type: "INTEGER", value })),
    },
  ],
});
const done: RunnerEvent = { type: "done", status: "finished" };

const base = (over: Partial<SessionFile> = {}): SessionFile => ({
  spec: [],
  language: "edexcel",
  breakpoints: [2],
  trace: false,
  script: [{ expect: { reason: "breakpoint", line: 2, variables: { a: "1" } }, then: "continue" }],
  expect: { stdout: "", status: "finished" },
  ...over,
});

describe("debugger session harness", () => {
  it("MISC passes a session that matches", async () => {
    expect(await playSession(fakeRunner([[paused(2, { a: "1" })], [done]]), "", base())).toEqual([]);
  });

  it("MISC reports a pause on the wrong line", async () => {
    const problems = await playSession(fakeRunner([[paused(3, { a: "1" })], [done]]), "", base());
    expect(problems.join("\n")).toContain("line 3, expected 2");
  });

  it("MISC reports wrong variables", async () => {
    const problems = await playSession(fakeRunner([[paused(2, { a: "2" })], [done]]), "", base());
    expect(problems.join("\n")).toContain("variables");
  });

  it("MISC reports a pause the script didn't expect", async () => {
    const problems = await playSession(
      fakeRunner([[paused(2, { a: "1" })], [paused(2, { a: "1" })], [done]]),
      "",
      base(),
    );
    expect(problems.join("\n")).toContain("unexpected pause #2");
  });

  it("MISC reports a scripted pause that never came", async () => {
    const problems = await playSession(fakeRunner([[done]]), "", base());
    expect(problems.join("\n")).toContain("ended after 0 of 1 scripted pauses");
  });

  it("MISC reports trace rows that differ", async () => {
    const run: RunnerEvent[] = [{ type: "traceRows", rows: [{ kind: "output", line: 1, text: "x" }] }, done];
    const problems = await playSession(
      fakeRunner([run]),
      "",
      base({ breakpoints: [], script: [], trace: true, expect: { stdout: "", status: "finished", trace: [] } }),
    );
    expect(problems.join("\n")).toContain("trace");
  });

  it("MISC reports a wrong input request and unread input", async () => {
    const run: RunnerEvent[] = [{ type: "inputRequest", prompt: "", device: "KEYBOARD" }];
    const problems = await playSession(
      fakeRunner([run, [done]]),
      "",
      base({
        breakpoints: [],
        script: [],
        inputs: ["1", "2"],
        expect: { stdout: "", status: "finished", inputRequests: [{ prompt: "" }] },
      }),
    );
    const text = problems.join("\n");
    expect(text).toContain("input requests");
    expect(text).toContain("never read");
  });

  it("MISC sends the scripted breakpoints before the command", async () => {
    const runner = fakeRunner([[paused(2, { a: "1" })], [done]]);
    const script = [
      { expect: { reason: "breakpoint" as const, line: 2 }, setBreakpoints: [], then: "continue" as const },
    ];
    await playSession(runner, "", base({ script }));
    expect(runner.sent.map((c) => c.type)).toEqual(["run", "setBreakpoints", "continue"]);
  });
});

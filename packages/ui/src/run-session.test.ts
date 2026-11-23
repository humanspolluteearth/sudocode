import type { RunnerEvent } from "@sudocode/core";
import { describe, expect, it } from "vitest";
import { FakeWorker } from "./fake-worker.ts";
import { startRun } from "./run-session.ts";

function start() {
  const workers: FakeWorker[] = [];
  const events: RunnerEvent[] = [];
  let ended = 0;
  const session = startRun(
    () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    "edexcel",
    "SEND 1 TO DISPLAY",
    (e) => events.push(e),
    () => ended++,
  );
  return { workers, events, session, ended: () => ended };
}

describe("MISC one fresh run worker per run", () => {
  it("MISC posts the run request to a new worker", () => {
    const { workers } = start();
    expect(workers).toHaveLength(1);
    expect(workers[0]?.posted[0]).toMatchObject({
      type: "run",
      request: { language: "edexcel", source: "SEND 1 TO DISPLAY" },
    });
  });
  it("MISC relays events and terminates the worker when the run is done", () => {
    const { workers, events, ended } = start();
    workers[0]?.reply({ type: "output", text: "1\n" });
    workers[0]?.reply({ type: "done", status: "finished" });
    expect(events.map((e) => e.type)).toEqual(["output", "done"]);
    expect(workers[0]?.terminated).toBe(true);
    expect(ended()).toBe(1);
  });
  it("MISC Stop terminates the worker and reports a stopped run", () => {
    const { workers, events, session, ended } = start();
    session.stop();
    session.stop();
    expect(workers[0]?.terminated).toBe(true);
    expect(events).toEqual([{ type: "done", status: "stopped" }]);
    expect(ended()).toBe(1);
  });
});

describe("MISC debugger commands reach the run worker", () => {
  it("MISC the run request carries the breakpoints and the trace switch", () => {
    const workers: FakeWorker[] = [];
    startRun(
      () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
      "edexcel",
      "SEND 1 TO DISPLAY",
      () => undefined,
      () => undefined,
      { breakpoints: [3, 5], trace: true },
    );
    expect(workers[0]?.posted[0]).toMatchObject({ type: "run", request: { breakpoints: [3, 5], trace: true } });
  });
  it("MISC send posts a command while running and nothing after the run ends", () => {
    const { workers, session } = start();
    session.send({ type: "input", text: "42" });
    session.send({ type: "stepOver" });
    workers[0]?.reply({ type: "done", status: "finished" });
    session.send({ type: "continue" });
    expect(workers[0]?.posted.slice(1)).toEqual([{ type: "input", text: "42" }, { type: "stepOver" }]);
  });
});

describe("SH-11 the run request carries the student's files", () => {
  it("MISC passes the files option to the worker", () => {
    const workers: FakeWorker[] = [];
    startRun(
      () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
      "edexcel",
      "READ Scores.txt Line",
      () => undefined,
      () => undefined,
      { files: { "Scores.txt": "5\n" } },
    );
    expect(workers[0]?.posted[0]).toMatchObject({ request: { files: { "Scores.txt": "5\n" } } });
  });
});

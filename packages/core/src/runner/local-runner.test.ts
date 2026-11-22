import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../diagnostics.ts";
import type { RunnerEvent, RunRequest } from "../protocol.ts";
import { runToDone } from "../../tests/support/run-to-done.ts";
import type { Engine } from "./engine.ts";
import { createLocalRunner } from "./local-runner.ts";

const request = (language: RunRequest["language"] = "edexcel"): RunRequest => ({
  language,
  source: "SEND 1 TO DISPLAY",
  files: {},
  seed: 1,
  breakpoints: [],
  trace: false,
});

/** An engine that echoes what it is told, to show the runner relays both ways. */
function echoEngine(log: string[]): Engine {
  return {
    check: () => [],
    start(req, emit) {
      emit({ type: "output", text: `running ${req.language}\n` });
      emit({ type: "inputRequest", prompt: "" });
      return {
        command(c) {
          log.push(c.type);
          if (c.type === "input") emit({ type: "output", text: `got ${c.text}\n` });
          if (c.type === "stop") emit({ type: "done", status: "stopped" });
        },
      };
    },
  };
}

describe("MISC local runner without an engine", () => {
  it.each([
    ["edexcel", "Edexcel pseudocode"],
    ["cie", "Cambridge pseudocode"],
    ["python", "Python"],
  ] as const)("MISC %s: reports that nothing can run it yet, then finishes with an error", async (language, name) => {
    const events = await runToDone(createLocalRunner(), [{ type: "run", request: request(language) }]);
    expect(events).toEqual([
      {
        type: "error",
        diagnostic: {
          code: "E-INTERNAL-NO-ENGINE",
          line: 1,
          column: 1,
          message: `Sudocode can't run ${name} programs yet`,
          hint: "This language is still being built. Try again in a later version.",
          severity: "error",
          span: { line: 1, column: 1, start: 0, end: 0 },
        } satisfies Diagnostic,
      },
      { type: "done", status: "error" },
    ]);
  });

  it("MISC delivers events asynchronously, so a listener added right after send still hears them", async () => {
    const runner = createLocalRunner();
    runner.send({ type: "run", request: request() });
    const events = await runToDone(runner, []);
    expect(events.map((e) => e.type)).toEqual(["error", "done"]);
  });
});

describe("MISC local runner with an engine", () => {
  it("MISC relays engine events and later commands in order", async () => {
    const log: string[] = [];
    const runner = createLocalRunner({ edexcel: echoEngine(log) });
    const events = await runToDone(runner, [
      { type: "run", request: request() },
      { type: "input", text: "42" },
      { type: "stepOver" },
      { type: "stop" },
    ]);
    expect(events).toEqual([
      { type: "output", text: "running edexcel\n" },
      { type: "inputRequest", prompt: "" },
      { type: "output", text: "got 42\n" },
      { type: "done", status: "stopped" },
    ]);
    expect(log).toEqual(["input", "stepOver", "stop"]);
  });

  it("MISC is one run only: a second run command and commands after done are ignored", async () => {
    const log: string[] = [];
    const runner = createLocalRunner({ edexcel: echoEngine(log) });
    await runToDone(runner, [{ type: "run", request: request() }, { type: "stop" }]);
    runner.send({ type: "run", request: request() });
    runner.send({ type: "input", text: "late" });
    await Promise.resolve();
    expect(log).toEqual(["stop"]);
  });

  it("MISC ignores commands that arrive before run", async () => {
    const log: string[] = [];
    const runner = createLocalRunner({ edexcel: echoEngine(log) });
    runner.send({ type: "input", text: "early" });
    await runToDone(runner, [{ type: "run", request: request() }, { type: "stop" }]);
    expect(log).toEqual(["stop"]);
  });

  it("MISC stops delivering to a listener after it unsubscribes", async () => {
    const heard: string[] = [];
    const runner = createLocalRunner({ edexcel: echoEngine([]) });
    const unsubscribe = runner.subscribe((e) => heard.push(`a:${e.type}`));
    unsubscribe();
    const events = await runToDone(runner, [{ type: "run", request: request() }, { type: "stop" }]);
    expect(events.map((e) => e.type)).toEqual(["output", "inputRequest", "done"]);
    expect(heard).toEqual([]);
  });

  it("MISC stops delivering and ignores commands after dispose", async () => {
    const heard: string[] = [];
    const log: string[] = [];
    const runner = createLocalRunner({ edexcel: echoEngine(log) });
    runner.subscribe((e) => heard.push(e.type));
    runner.send({ type: "run", request: request() });
    runner.dispose();
    runner.send({ type: "stop" });
    await new Promise((r) => setTimeout(r, 0));
    expect(heard).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe("MISC local runner when the engine itself fails", () => {
  const internalError = (detail: string): RunnerEvent => ({
    type: "error",
    diagnostic: {
      code: "E-INTERNAL-ENGINE",
      line: 1,
      column: 1,
      message: `Sudocode itself went wrong while running this program (${detail})`,
      hint: "This is a bug in Sudocode, not in your program. Please report it with the program you ran.",
      severity: "error",
      span: { line: 1, column: 1, start: 0, end: 0 },
    },
  });

  it("MISC a crash while starting still ends the run with an error and done", async () => {
    const broken: Engine = {
      check: () => [],
      start: () => {
        throw new Error("boom");
      },
    };
    const events = await runToDone(createLocalRunner({ cie: broken }), [{ type: "run", request: request("cie") }]);
    expect(events).toEqual([internalError("boom"), { type: "done", status: "error" }]);
  });

  it("MISC a crash while handling a command still ends the run with an error and done", async () => {
    const broken: Engine = {
      check: () => [],
      start: (_r, emit) => {
        emit({ type: "inputRequest", prompt: "" });
        return {
          command: () => {
            throw new TypeError("bad state");
          },
        };
      },
    };
    const events = await runToDone(createLocalRunner({ python: broken }), [
      { type: "run", request: request("python") },
      { type: "input", text: "1" },
    ]);
    expect(events).toEqual([
      { type: "inputRequest", prompt: "" },
      internalError("bad state"),
      { type: "done", status: "error" },
    ]);
  });
});

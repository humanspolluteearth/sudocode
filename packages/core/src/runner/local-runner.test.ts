import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../diagnostics.ts";
import type { RunRequest } from "../protocol.ts";
import { runToDone } from "../../tests/support/run-to-done.ts";
import type { Engine } from "./engine.ts";
import { createLocalRunner } from "./local-runner.ts";

const request = (language: RunRequest["language"] = "edexcel"): RunRequest => ({
  language,
  source: "SEND 1 TO DISPLAY",
  files: {},
  seed: 1,
  breakpoints: [],
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

  it("MISC stops delivering after unsubscribe or dispose", async () => {
    const heard: string[] = [];
    const runner = createLocalRunner({ edexcel: echoEngine([]) });
    const unsubscribe = runner.subscribe((e) => heard.push(`a:${e.type}`));
    runner.subscribe((e) => heard.push(`b:${e.type}`));
    unsubscribe();
    runner.send({ type: "run", request: request() });
    runner.dispose();
    runner.send({ type: "stop" });
    await new Promise((r) => setTimeout(r, 0));
    expect(heard).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../diagnostics.ts";
import type { CheckResponse, RunRequest } from "../protocol.ts";
import { createLocalRunner } from "../runner/local-runner.ts";
import { fakeChannel } from "../../tests/support/fake-channel.ts";
import { runToDone } from "../../tests/support/run-to-done.ts";
import { serveChecker, serveRunner } from "./serve.ts";
import { createWorkerRunner } from "./worker-runner.ts";

const request: RunRequest = { language: "cie", source: "OUTPUT 1", files: {}, seed: 7, breakpoints: [], trace: false };
const warning: Diagnostic = {
  code: "W-LOWERCASE-KEYWORD",
  line: 1,
  column: 1,
  message: "m",
  hint: "h.",
  severity: "warning",
};

describe("MISC run worker across the worker boundary", () => {
  it("MISC gives the same events as running in the same thread", async () => {
    const channel = fakeChannel();
    serveRunner(channel.worker, createLocalRunner());
    const viaWorker = await runToDone(createWorkerRunner(channel.ui), [{ type: "run", request }]);
    const direct = await runToDone(createLocalRunner(), [{ type: "run", request }]);
    expect(viaWorker).toEqual(direct);
    expect(viaWorker.map((e) => e.type)).toEqual(["error", "done"]);
  });

  it("MISC the worker ignores messages that are not commands", async () => {
    const channel = fakeChannel();
    const seen: unknown[] = [];
    serveRunner(channel.worker, {
      send: (c) => seen.push(c),
      subscribe: () => () => undefined,
      dispose: () => undefined,
    });
    channel.ui.postMessage({ type: "launch" });
    channel.ui.postMessage("stop");
    channel.ui.postMessage({ type: "stop" });
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([{ type: "stop" }]);
  });

  it("MISC the UI ignores messages that are not events", async () => {
    const channel = fakeChannel();
    const runner = createWorkerRunner(channel.ui);
    const heard: unknown[] = [];
    runner.subscribe((e) => heard.push(e));
    channel.worker.postMessage({ type: "output" }); // no text
    channel.worker.postMessage({ type: "output", text: "ok\n" });
    await new Promise((r) => setTimeout(r, 0));
    expect(heard).toEqual([{ type: "output", text: "ok\n" }]);
  });

  it("MISC dispose terminates the worker and stops sending", () => {
    const channel = fakeChannel();
    const posted: unknown[] = [];
    const runner = createWorkerRunner({ ...channel.ui, postMessage: (m) => posted.push(m) });
    runner.send({ type: "pause" });
    runner.dispose();
    runner.send({ type: "stop" });
    expect(channel.terminated()).toBe(true);
    expect(posted).toEqual([{ type: "pause" }]);
  });
});

describe("MISC check worker", () => {
  async function check(engines: Parameters<typeof serveChecker>[1], messages: unknown[]): Promise<unknown[]> {
    const channel = fakeChannel();
    serveChecker(channel.worker, engines);
    const answers: unknown[] = [];
    channel.ui.addEventListener("message", ({ data }) => answers.push(data));
    for (const m of messages) channel.ui.postMessage(m);
    await new Promise((r) => setTimeout(r, 0));
    return answers;
  }

  it("MISC answers every request with its id; no engine means no diagnostics", async () => {
    const answers = await check({}, [
      { type: "check", id: 1, language: "edexcel", source: "SEND 1 TO DISPLAY" },
      { type: "check", id: 2, language: "python", source: "print(1)" },
    ]);
    expect(answers).toEqual([
      { type: "checked", id: 1, diagnostics: [] },
      { type: "checked", id: 2, diagnostics: [] },
    ] satisfies CheckResponse[]);
  });

  it("MISC returns the engine's diagnostics for its language", async () => {
    const engine = {
      check: (source: string) => (source.startsWith("output") ? [warning] : []),
      start: () => ({ command: () => undefined }),
    };
    const answers = await check({ cie: engine }, [{ type: "check", id: 3, language: "cie", source: "output 1" }]);
    expect(answers).toEqual([{ type: "checked", id: 3, diagnostics: [warning] }]);
  });

  it("MISC ignores malformed requests", async () => {
    expect(await check({}, [{ type: "check", id: -1, language: "cie", source: "" }, { type: "run" }])).toEqual([]);
  });
});

// Worker-side message handling, kept apart from the worker entry files so it can be tested in Node.
import { isCheckRequest, isRunnerCommand, type CheckResponse, type Runner } from "../protocol.ts";
import type { EngineRegistry } from "../runner/engine.ts";
import type { WorkerScope } from "./scope.ts";

/** Run worker: forwards valid commands to the runner and posts every event back. Invalid messages are ignored. */
export function serveRunner(scope: WorkerScope, runner: Runner): void {
  runner.subscribe((event) => {
    scope.postMessage(event);
  });
  scope.addEventListener("message", ({ data }) => {
    if (isRunnerCommand(data)) runner.send(data);
  });
}

/** Check worker: answers each check request with the engine's diagnostics (none while a language has no engine). */
export function serveChecker(scope: WorkerScope, engines: EngineRegistry): void {
  scope.addEventListener("message", ({ data }) => {
    if (!isCheckRequest(data)) return;
    const response: CheckResponse = {
      type: "checked",
      id: data.id,
      diagnostics: engines[data.language]?.check(data.source) ?? [],
    };
    scope.postMessage(response);
  });
}

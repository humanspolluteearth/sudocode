// A Runner that drives an engine in the same thread. The run worker wraps one; tests use one directly.
import { makeDiagnostic } from "../messages/index.ts";
import type { Runner, RunnerCommand, RunnerEvent, RunnerListener, RunRequest } from "../protocol.ts";
import type { EngineRegistry, EngineRun } from "./engine.ts";

const LANGUAGE_NAMES = { edexcel: "Edexcel pseudocode", cie: "Cambridge pseudocode", python: "Python" } as const;

/**
 * One Runner is one run (the UI makes a fresh run worker per run). Events are delivered asynchronously, in
 * order, as they would be from a worker. A second `run` command, or anything after `dispose`, is ignored.
 */
export function createLocalRunner(engines: EngineRegistry = {}): Runner {
  const listeners = new Set<RunnerListener>();
  let run: EngineRun | undefined;
  let language: RunRequest["language"] = "edexcel";
  let started = false;
  let finished = false;
  let disposed = false;

  const emit = (event: RunnerEvent): void => {
    if (event.type === "done") finished = true;
    queueMicrotask(() => {
      if (disposed) return;
      for (const listener of listeners) listener(event);
    });
  };

  const start = (request: RunRequest): void => {
    const engine = engines[request.language];
    if (engine === undefined) {
      // Nothing can run this language yet: say so plainly instead of failing silently.
      const span = { line: 1, column: 1, start: 0, end: 0 };
      const args = { language: LANGUAGE_NAMES[request.language] };
      emit({
        type: "error",
        diagnostic: makeDiagnostic({ code: "E-INTERNAL-NO-ENGINE", language: request.language, span, args }),
      });
      emit({ type: "done", status: "error" });
      return;
    }
    try {
      run = engine.start(request, emit);
    } catch (error) {
      crashed(error, request.language);
    }
  };

  // An engine bug must never leave the UI waiting: report it plainly and end the run.
  const crashed = (error: unknown, language: RunRequest["language"]): void => {
    if (finished) return;
    const detail = error instanceof Error ? error.message : String(error);
    const span = { line: 1, column: 1, start: 0, end: 0 };
    emit({
      type: "error",
      diagnostic: makeDiagnostic({ code: "E-INTERNAL-ENGINE", language, span, args: { detail } }),
    });
    emit({ type: "done", status: "error" });
  };

  return {
    send(command: RunnerCommand): void {
      if (disposed) return;
      if (command.type === "run") {
        if (started) return;
        started = true;
        language = command.request.language;
        start(command.request);
        return;
      }
      if (finished) return;
      if (run !== undefined) {
        try {
          run.command(command);
        } catch (error) {
          crashed(error, language);
        }
      } else if (command.type === "stop" && started) {
        emit({ type: "done", status: "stopped" });
      }
    },
    subscribe(listener: RunnerListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      disposed = true;
      listeners.clear();
    },
  };
}

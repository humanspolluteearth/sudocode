// The UI side of the run worker: a Runner that posts commands to a worker and relays its events.
import { isRunnerEvent, type Runner, type RunnerCommand, type RunnerListener } from "../protocol.ts";
import type { WorkerHandle } from "./scope.ts";

/** Wraps a freshly started run worker. `dispose` terminates it, which is how Stop always works (SH-14). */
export function createWorkerRunner(worker: WorkerHandle): Runner {
  const listeners = new Set<RunnerListener>();
  let disposed = false;
  worker.addEventListener("message", ({ data }) => {
    if (disposed || !isRunnerEvent(data)) return;
    for (const listener of listeners) listener(data);
  });
  return {
    send(command: RunnerCommand): void {
      if (!disposed) worker.postMessage(command);
    },
    subscribe(listener: RunnerListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      worker.terminate();
    },
  };
}

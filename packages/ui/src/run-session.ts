// One run: a FRESH run worker is started for every run and terminated when it ends or the student presses Stop,
// so a program stuck in WHILE TRUE can always be stopped (SH-05).
import {
  createWorkerRunner,
  type Language,
  type RunRequest,
  type Runner,
  type RunnerEvent,
  type WorkerHandle,
} from "@sudocode/core";

/** Supplied by the app shell (apps/web), which owns the bundler-specific `new Worker(...)` calls. */
export interface WorkerFactories {
  createRunWorker: () => WorkerHandle;
  createCheckWorker: () => WorkerHandle;
}

export interface RunSession {
  stop: () => void;
}

export function startRun(
  createRunWorker: () => WorkerHandle,
  language: Language,
  source: string,
  onEvent: (event: RunnerEvent) => void,
  onEnded: () => void,
): RunSession {
  const runner: Runner = createWorkerRunner(createRunWorker());
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    runner.dispose(); // terminates the worker
    onEnded();
  };
  runner.subscribe((event) => {
    onEvent(event);
    if (event.type === "done") end();
  });
  const request: RunRequest = {
    language,
    source,
    files: {},
    seed: Math.floor(Math.random() * 0x7fffffff),
    breakpoints: [],
    trace: false,
  };
  runner.send({ type: "run", request });
  return {
    stop() {
      if (ended) return;
      onEvent({ type: "done", status: "stopped" });
      end();
    },
  };
}

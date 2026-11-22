// Entry file for the RUN worker. The UI starts a fresh one for every run and terminates it afterwards.
import { createLocalRunner } from "../runner/local-runner.ts";
import { ENGINES } from "../runner/engines.ts";
import type { WorkerScope } from "./scope.ts";
import { serveRunner } from "./serve.ts";

serveRunner(globalThis as unknown as WorkerScope, createLocalRunner(ENGINES));

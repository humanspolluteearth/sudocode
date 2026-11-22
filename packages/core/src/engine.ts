// @sudocode/core/engine: the engine side of the Runner, for engines, workers and tests. The UI never imports
// this (ESLint enforces it): it uses the Runner interface from "@sudocode/core" and starts the workers with
// "@sudocode/core/run-worker" and "@sudocode/core/check-worker".
export type { Engine, EngineRegistry, EngineRun } from "./runner/engine.ts";
export { createLocalRunner } from "./runner/local-runner.ts";
export { ENGINES } from "./runner/engines.ts";
export type { WorkerScope } from "./worker/scope.ts";
export { serveChecker, serveRunner } from "./worker/serve.ts";

// @sudocode/core: lexers, parsers, checker, core IR, runtime, debugger and converter.
// Rule for this package: no DOM, React or browser APIs. It must run in Node and in a Web Worker.
//
// This entry is what the UI may use: plain types, the protocol, the message catalogue and the UI side of the
// run worker. Engine-side code lives in "@sudocode/core/engine"; the workers are "@sudocode/core/run-worker"
// and "@sudocode/core/check-worker".
export * from "./language.ts";
export * from "./diagnostics.ts";
export * from "./protocol.ts";
export * from "./messages/index.ts";
export type { WorkerHandle } from "./worker/scope.ts";
export { createWorkerRunner } from "./worker/worker-runner.ts";
export { runHeadless, type HeadlessResult } from "./runner/headless.ts";
export { CIE_GUIDE, type GuideSection } from "./examples/cie-guide.ts";
export { PYTHON_GUIDE } from "./examples/python-guide.ts";

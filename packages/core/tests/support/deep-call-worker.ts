// Runs a deep chain of interpreted calls inside a worker thread and reports what happened (deep-calls.test.ts).
import { parentPort, workerData } from "node:worker_threads";
import { runProgram } from "../../src/runtime/driver.ts";
import { deepChain } from "./ir.ts";

const { depth, maxCallDepth } = workerData as { depth: number; maxCallDepth?: number };
let stdout = "";
const errors: string[] = [];
runProgram({
  language: "edexcel",
  program: deepChain(depth),
  ...(maxCallDepth === undefined ? {} : { maxCallDepth }),
  emit: (event) => {
    if (event.type === "output") stdout += event.text;
    if (event.type === "error") errors.push(event.diagnostic.code);
    if (event.type === "done") parentPort?.postMessage({ stdout, errors, status: event.status });
  },
});

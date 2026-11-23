import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";

// docs/AUDIT.md (Performance): a test must prove 1,000-deep recursion works inside a worker. Browsers give Web
// Workers a small stack, so this runs the driver in a worker thread limited to 1 MB of stack.
function runInWorker(
  depth: number,
  maxCallDepth?: number,
): Promise<{ stdout: string; errors: string[]; status: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../tests/support/deep-call-worker.ts", import.meta.url), {
      workerData: { depth, maxCallDepth },
      resourceLimits: { stackSizeMb: 1 },
    });
    worker.once("message", (result: { stdout: string; errors: string[]; status: string }) => {
      void worker.terminate();
      resolve(result);
    });
    worker.once("error", reject);
  });
}

describe("SH-13 deep recursion inside a worker with a small stack", () => {
  it("SH-13 1,000 nested interpreted calls run in a worker thread with a 1 MB stack", async () => {
    expect(await runInWorker(999)).toEqual({ stdout: "999\n", errors: [], status: "finished" });
  });

  it("SH-13 the 1,001st nested call is still the friendly recursion error there, not a stack overflow", async () => {
    expect(await runInWorker(1000)).toEqual({ stdout: "", errors: ["E-RUN-RECURSION-LIMIT"], status: "error" });
  });

  it("MISC 100,000 nested calls (limit raised) fit in the same 1 MB stack: calls never nest JavaScript frames", async () => {
    // Nested generators overflow 1 MB at about 3,000 calls even with only 4 frames per call; the trampoline doesn't.
    expect(await runInWorker(100_000, 200_000)).toEqual({ stdout: "100000\n", errors: [], status: "finished" });
  });
});

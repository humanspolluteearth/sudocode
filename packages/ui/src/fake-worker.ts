// A fake Web Worker for tests: records what the UI posts and lets the test answer.
import type { WorkerHandle } from "@sudocode/core";

export class FakeWorker implements WorkerHandle {
  posted: unknown[] = [];
  terminated = false;
  private listeners: ((event: { data: unknown }) => void)[] = [];
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  addEventListener(_type: "message", listener: (event: { data: unknown }) => void): void {
    this.listeners.push(listener);
  }
  terminate(): void {
    this.terminated = true;
  }
  /** Pretend the worker sent a message to the UI. */
  reply(data: unknown): void {
    for (const l of this.listeners) l({ data });
  }
}

// Test helper: connects a WorkerHandle (UI side) to a WorkerScope (worker side) in memory. Messages are copied
// with structuredClone and delivered asynchronously, as postMessage does.
import type { WorkerHandle, WorkerScope } from "../../src/worker/scope.ts";

type Listener = (event: { data: unknown }) => void;

export interface FakeChannel {
  ui: WorkerHandle;
  worker: WorkerScope;
  terminated: () => boolean;
}

export function fakeChannel(): FakeChannel {
  const toWorker: Listener[] = [];
  const toUi: Listener[] = [];
  let terminated = false;
  const deliver = (listeners: Listener[], message: unknown): void => {
    const data = structuredClone(message);
    queueMicrotask(() => {
      if (!terminated) for (const l of listeners) l({ data });
    });
  };
  return {
    ui: {
      postMessage: (m) => {
        deliver(toWorker, m);
      },
      addEventListener: (_type, l) => toUi.push(l),
      terminate: () => {
        terminated = true;
      },
    },
    worker: {
      postMessage: (m) => {
        deliver(toUi, m);
      },
      addEventListener: (_type, l) => toWorker.push(l),
    },
    terminated: () => terminated,
  };
}

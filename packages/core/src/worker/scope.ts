// The small part of the Web Worker API the workers use. Declared here because core compiles without the DOM
// and WebWorker libraries (it must also run in Node), and so tests can pass a fake.
export interface WorkerScope {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

/** The UI side of a worker: a `Worker` in the browser, a fake in tests. */
export interface WorkerHandle {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  terminate(): void;
}

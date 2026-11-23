// The UI side of the long-lived CHECK worker: asks it to check the source ~300 ms after the student stops typing
// (debounce: restart a timer on every keystroke so only the last one fires) and ignores answers to old source.
import { isCheckResponse, type CheckRequest, type Diagnostic, type Language, type WorkerHandle } from "@sudocode/core";

export const CHECK_DELAY_MS = 300;

export interface CheckClient {
  /** Schedule a check of this source; replaces any check still waiting. */
  request: (source: string) => void;
  dispose: () => void;
}

export function createCheckClient(
  worker: WorkerHandle,
  language: Language,
  onDiagnostics: (diagnostics: readonly Diagnostic[]) => void,
  delayMs: number = CHECK_DELAY_MS,
): CheckClient {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latestId = 0;
  let disposed = false;
  worker.addEventListener("message", ({ data }) => {
    // Answers to older requests are out of date: only the newest id counts.
    if (disposed || !isCheckResponse(data) || data.id !== latestId) return;
    onDiagnostics(data.diagnostics);
  });
  return {
    request(source) {
      if (disposed) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const message: CheckRequest = { type: "check", id: ++latestId, language, source };
        worker.postMessage(message);
      }, delayMs);
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      worker.terminate();
    },
  };
}

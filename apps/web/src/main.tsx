// The web shell: mounts the IDE from @sudocode/ui. Shells stay thin (CLAUDE.md). It owns the `?worker` imports,
// the only bundler-specific part, and hands them to the UI as factories.
import { App, type WorkerFactories } from "@sudocode/ui";
import CheckWorker from "@sudocode/core/check-worker?worker";
import RunWorker from "@sudocode/core/run-worker?worker";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const workers: WorkerFactories = {
  createRunWorker: () => new RunWorker(),
  createCheckWorker: () => new CheckWorker(),
};

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <App workers={workers} />
  </StrictMode>,
);

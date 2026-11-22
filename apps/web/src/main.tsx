// The web shell: mounts the IDE from @sudocode/ui. Shells stay thin (CLAUDE.md).
import { App } from "@sudocode/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

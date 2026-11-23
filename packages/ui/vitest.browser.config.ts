import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Vitest Browser Mode: component tests run in real headless Chromium, so CodeMirror, focus and axe see a real DOM.
export default defineConfig({
  test: {
    name: "ui-browser",
    include: ["src/**/*.browser.test.tsx"],
    retry: 0,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "ui",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Component tests need a real browser; they run with `pnpm --filter @sudocode/ui test:browser` (vitest.browser.config.ts).
    exclude: ["src/**/*.browser.test.tsx"],
    retry: 0,
  },
});

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "core",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Vitest never retries core tests (docs/TEST-PLAN.md section 7).
    retry: 0,
  },
});

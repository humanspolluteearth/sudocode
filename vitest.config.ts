import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*",
      {
        test: {
          name: "tooling",
          include: ["scripts/**/*.test.ts"],
          retry: 0,
        },
      },
    ],
  },
});

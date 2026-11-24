import { defineConfig, devices } from "@playwright/test";

// E2E runs against the production build served by `vite preview`, the closest thing to what Cloudflare serves
// (docs/TEST-PLAN.md section 3). Chromium on every PR; Firefox and WebKit run nightly (set E2E_BROWSERS).
const all = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
};
const wanted = (process.env["E2E_BROWSERS"] ?? "chromium").split(",") as (keyof typeof all)[];

export default defineConfig({
  testDir: "e2e",
  retries: process.env["CI"] === undefined ? 0 : 2,
  reporter: process.env["CI"] === undefined ? "dot" : "github",
  // The startup dialog shows on every launch until its box is ticked; the tests start with it already dismissed
  // (welcome.spec.ts clears this to test the dialog itself).
  use: {
    baseURL: "http://localhost:4173",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:4173",
          localStorage: [{ name: "sudocode.preferences", value: JSON.stringify({ welcomeDone: true }) }],
        },
      ],
    },
  },
  projects: wanted.map((name) => ({ name, use: all[name] })),
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: process.env["CI"] === undefined,
    timeout: 120_000,
  },
});

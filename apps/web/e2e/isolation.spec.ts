import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The COOP/COEP headers (public/_headers on Cloudflare, the same two in vite.config.ts for dev and preview)
// make the page cross-origin isolated, which later milestones need for SharedArrayBuffer.
test("the page is cross-origin isolated", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
});

// Cloudflare serves public/_headers, not vite.config.ts, so check that file says the same thing.
test("public/_headers sets COOP and COEP for every path", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  expect(headers).toMatch(/^\/\*\s*$/m);
  expect(headers).toContain("Cross-Origin-Opener-Policy: same-origin");
  expect(headers).toContain("Cross-Origin-Embedder-Policy: require-corp");
});

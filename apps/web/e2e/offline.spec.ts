import { expect, test } from "@playwright/test";

// The hand-written service worker (src/sw-template.js) stores the app after the first visit.
test("the page stays cross-origin isolated when the service worker serves it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Reload so the worker, not the network, answers the navigation.
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
});

test("the app loads and runs a program offline after the first visit", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  const editor = page.getByRole("textbox", { name: "Program editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText("SEND 'offline ok' TO DISPLAY");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("log")).toContainText("offline ok");
});

test("the web manifest makes the app installable", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const response = await page.request.get("/manifest.webmanifest");
  const manifest = (await response.json()) as { display: string; icons: unknown[]; start_url: string };
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThan(0);
});

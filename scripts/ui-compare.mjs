// Renders the original design (reference/prototype/design-standalone.html) and the running app at 1440x900,
// light and dark, and writes the four PNGs to one folder so a person can compare them side by side.
// Usage: node scripts/ui-compare.mjs [--url http://localhost:4173] [--out ui-compare-out]
// Start the app first (`pnpm --filter @sudocode/web build && pnpm --filter @sudocode/web preview --port 4173`).
// The design is only used for looking at, never for pixel comparison: fonts differ per machine.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const appUrl = arg("url", "http://localhost:4173");
const out = resolve(arg("out", "ui-compare-out"));
const designFile = resolve("reference/prototype/design-standalone.html");

// Playwright is a dependency of apps/web only, so resolve it from there.
const require = createRequire(resolve("apps/web/package.json"));
const { chromium } = require("@playwright/test");

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const design = await context.newPage();
    await design.goto(pathToFileURL(designFile).href);
    // The standalone file is a canvas of artboards, each in an iframe; the first is the 1440x900 desktop IDE.
    const board = design.locator("iframe[title='IDE']");
    await board.waitFor({ timeout: 30_000 });
    const frame = await (await board.elementHandle()).contentFrame();
    await frame.waitForSelector('nav[aria-label="Menu bar"]', { timeout: 30_000 });
    await frame.evaluate(() => globalThis.document.fonts.ready);
    await board.screenshot({ path: `${out}/design-${scheme}.png` });
    const app = await context.newPage();
    await app.goto(appUrl);
    await app.waitForSelector(".sc-root");
    await app.evaluate(() => globalThis.document.fonts.ready);
    await app.screenshot({ path: `${out}/app-${scheme}.png` });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`wrote design-{light,dark}.png and app-{light,dark}.png to ${out}`);

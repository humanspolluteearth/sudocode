// Screenshots the running app in the states the mobile and tablet fidelity pass cares about, so a person (or Claude)
// can look at them before and after a change. Not a test: nothing is compared.
// Usage: node scripts/ui-mobile-shots.mjs [--url http://localhost:4173] [--out ui-mobile-shots] [--only 390x844]
// Start the app first (`pnpm --filter @sudocode/web build && pnpm --filter @sudocode/web preview --port 4173`).
// Files are named <size>-<scheme>-<state>.png, for example 390x844-light-after-run.png.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const appUrl = arg("url", "http://localhost:4173");
const out = resolve(arg("out", "ui-mobile-shots"));
const only = arg("only", "");

// Playwright is a dependency of apps/web only, so resolve it from there.
const require = createRequire(resolve("apps/web/package.json"));
const { chromium } = require("@playwright/test");

const SIZES = [
  [360, 740],
  [390, 844],
  [834, 1194],
  [1194, 834],
];
const BROKEN = "SET total TO 1\nDISPLAY nothing";

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];
try {
  for (const [width, height] of SIZES) {
    if (only !== "" && only !== `${String(width)}x${String(height)}`) continue;
    for (const scheme of ["light", "dark"]) {
      const touch = width < 1100;
      const phone = width < 700; // phones have the bottom views; tablets show every panel at once
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: scheme,
        reducedMotion: "reduce",
        hasTouch: touch,
        isMobile: touch,
      });
      const open = async () => {
        const page = await context.newPage();
        // Web fonts are blocked so the fallback font is the same on every run.
        await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
        await page.goto(appUrl);
        await page.getByRole("button", { name: "Run", exact: true }).waitFor();
        await page.waitForTimeout(400);
        return page;
      };
      const base = `${String(width)}x${String(height)}-${scheme}`;
      const shot = async (page, state) => {
        await page.screenshot({ path: `${out}/${base}-${state}.png` });
      };
      const attempt = async (state, fn) => {
        const page = await open();
        try {
          await fn(page);
          await shot(page, state);
        } catch (e) {
          problems.push(`${base}-${state}: ${String(e.message).split("\n")[0]}`);
          await shot(page, `${state}-FAILED`).catch(() => undefined);
        } finally {
          await page.close();
        }
      };
      const view = (page, name) => page.getByRole("button", { name, exact: true }).first().click();
      const replaceCode = async (page, text) => {
        await page.locator(".cm-content").click();
        await page.keyboard.press("Control+a");
        await page.keyboard.insertText(text);
      };

      await attempt("idle", async () => {});
      await attempt("after-run", async (page) => {
        await page.getByRole("button", { name: "Run", exact: true }).click();
        await page.waitForTimeout(300);
        // The sample waits for input; answer it so the run finishes.
        const input = page.getByRole("textbox", { name: /input/i }).first();
        for (let i = 0; i < 3 && (await input.count()) > 0; i++) {
          await input.fill("64");
          await input.press("Enter");
          await page.waitForTimeout(200);
        }
        await page.waitForTimeout(400);
      });
      await attempt("error", async (page) => {
        await replaceCode(page, BROKEN);
        await page.getByRole("button", { name: "Run", exact: true }).click();
        await page.waitForTimeout(700);
      });
      await attempt("error-console", async (page) => {
        await replaceCode(page, BROKEN);
        await page.getByRole("button", { name: "Run", exact: true }).click();
        await page.waitForTimeout(700);
        if (phone) await view(page, "Console");
      });
      await attempt("five-tabs", async (page) => {
        for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "New tab" }).click();
        await page.waitForTimeout(200);
      });
      if (touch) {
        await attempt("overflow-menu", async (page) => {
          await page.getByRole("button", { name: "File and convert actions" }).click();
        });
        for (const name of phone ? ["Console", "Debug", "Guide"] : []) {
          await attempt(`view-${name.toLowerCase()}`, async (page) => {
            await view(page, name);
            await page.waitForTimeout(300);
          });
        }
      }
      await attempt("paused", async (page) => {
        await page.getByRole("button", { name: "Step over" }).click();
        await page.waitForTimeout(500);
      });
      if (phone) {
        await attempt("paused-debug", async (page) => {
          await page.getByRole("button", { name: "Step over" }).click();
          await page.waitForTimeout(500);
          await view(page, "Debug");
        });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`screenshots written to ${out}`);
if (problems.length > 0) console.log(`${String(problems.length)} state(s) failed:\n${problems.join("\n")}`);

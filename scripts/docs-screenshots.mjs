// Regenerates the screenshots used in README.md and docs/ (docs/images/*.png).
// Usage: node scripts/docs-screenshots.mjs [--url http://localhost:4173] [--out docs/images]
// Start the app first: `pnpm --filter @sudocode/web build && pnpm --filter @sudocode/web preview --port 4173`.
// Uses only Playwright, which apps/web already installs. Nothing is compared; look at the pictures afterwards.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const appUrl = arg("url", "http://localhost:4173");
const out = resolve(arg("out", "docs/images"));

const require = createRequire(resolve("apps/web/package.json"));
const { chromium } = require("@playwright/test");

const SAMPLE = [
  "# Times table",
  "SET n TO 7",
  "FOR i FROM 1 TO 5 DO",
  "    SEND i & ' x ' & n & ' = ' & i * n TO DISPLAY",
  "END FOR",
  "",
].join("\n");

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];

// One fresh page per picture, so each starts from the same place.
// Web fonts are blocked so the fallback font is the same on every machine.
async function open(size, { welcome = false, touch = false } = {}) {
  const context = await browser.newContext({
    viewport: size,
    reducedMotion: "reduce",
    colorScheme: "light",
    hasTouch: touch,
    isMobile: touch,
  });
  // The startup dialog is skipped unless a picture is of the dialog itself.
  if (!welcome) {
    await context.addInitScript(() => {
      localStorage.setItem("sudocode.preferences", JSON.stringify({ welcomeDone: true }));
    });
  }
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Run", exact: true }).first().waitFor();
  await page.waitForTimeout(400);
  return { page, context };
}
const type = async (page, text) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(text);
  await page.waitForTimeout(250);
};
const menu = (page, name) => page.getByRole("menuitem", { name, exact: true }).first();
const advanced = async (page) => {
  await page.getByLabel("Advanced").first().check();
  await page.waitForTimeout(300);
};

async function picture(name, size, fn, options) {
  const { page, context } = await open(size, options);
  try {
    await fn(page);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(`wrote ${name}.png`);
  } catch (e) {
    problems.push(`${name}: ${String(e.message).split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

const DESKTOP = { width: 1280, height: 800 };
const run = async (page) => {
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  await page.waitForTimeout(900);
};

try {
  await picture("01-editor-sample", DESKTOP, (page) => type(page, SAMPLE));
  await picture("02-run-output", DESKTOP, async (page) => {
    await type(page, SAMPLE);
    await run(page);
  });
  await picture("03-debugger-trace-table", DESKTOP, async (page) => {
    await advanced(page);
    await type(page, SAMPLE);
    await page.getByRole("button", { name: "Step over" }).first().click();
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(250);
      await page.getByRole("button", { name: "Step over" }).first().click();
    }
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: /Trace table/ })
      .first()
      .click();
    await page.waitForTimeout(300);
  });
  await picture("04-language-picker", DESKTOP, async (page) => {
    await type(page, SAMPLE);
    await page.getByRole("menuitem", { name: "Language", exact: true }).first().click();
    await page.waitForTimeout(250);
  });
  await picture("05-convert-to-python", DESKTOP, async (page) => {
    await advanced(page);
    await type(page, SAMPLE);
    await page.getByRole("menuitem", { name: "Convert", exact: true }).first().click();
    await menu(page, "Convert to Python").click();
    await page.waitForTimeout(1500);
  });
  await picture("06-quick-reference", DESKTOP, async (page) => {
    await type(page, SAMPLE);
    await page.getByRole("button", { name: "Quick reference", exact: true }).first().click();
    await page.waitForTimeout(300);
  });
  await picture(
    "07-welcome-not-official",
    { width: 1280, height: 800 },
    async (page) => {
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(250);
    },
    { welcome: true },
  );
  await picture(
    "08-tablet",
    { width: 834, height: 1112 },
    async (page) => {
      await type(page, SAMPLE);
      await run(page);
    },
    { touch: true },
  );
  await picture(
    "09-phone",
    { width: 390, height: 844 },
    async (page) => {
      await type(page, SAMPLE);
    },
    { touch: true },
  );
  await picture(
    "10-phone-console",
    { width: 390, height: 844 },
    async (page) => {
      await type(page, SAMPLE);
      await run(page);
      await page.getByRole("button", { name: "Console", exact: true }).first().click();
      await page.waitForTimeout(300);
    },
    { touch: true },
  );
} finally {
  await browser.close();
}
console.log(`screenshots are in ${out}`);
if (problems.length > 0) {
  console.log(`${String(problems.length)} picture(s) failed:\n${problems.join("\n")}`);
  process.exitCode = 1;
}

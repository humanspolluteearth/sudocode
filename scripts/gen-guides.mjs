/* global document */
// Turns the three design guide pages (reference/prototype/design/*Guide.dc.html) into JSON element trees in
// packages/ui/src/guides/. Run by hand when the design changes: `node scripts/gen-guides.mjs`.
// A real browser (Playwright, already a dev dependency of apps/web) does the HTML parsing, so no parser is added.
// Every element keeps its inline style string, so spacing and widths are copied, not re-typed.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(resolve("apps/web/package.json"));
const { chromium } = require("@playwright/test");

const PAGES = [
  ["edexcel", "Guide.dc.html"],
  ["cie", "CambridgeGuide.dc.html"],
  ["python", "PythonGuide.dc.html"],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [id, file] of PAGES) {
    const html = readFileSync(`reference/prototype/design/${file}`, "utf8");
    await page.setContent(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, ""));
    const tree = await page.evaluate(() => {
      const walk = (node) => {
        if (node.nodeType === 3) return node.textContent;
        if (node.nodeType !== 1) return null;
        const out = { t: node.tagName.toLowerCase() };
        const attrs = {};
        for (const a of node.attributes) attrs[a.name] = a.value;
        if (Object.keys(attrs).length > 0) out.a = attrs;
        const c = [...node.childNodes].map(walk).filter((x) => x !== null && x !== "");
        if (c.length > 0) out.c = c;
        return out;
      };
      // The page's outer div holds the breadcrumb bar and the body; the theme class is set by the app.
      const root = document.querySelector("div.th");
      return { title: document.title, root: walk(root) };
    });
    writeFileSync(`packages/ui/src/guides/${id}.json`, JSON.stringify(tree.root) + "\n");
    console.log(id, tree.title);
  }
} finally {
  await browser.close();
}

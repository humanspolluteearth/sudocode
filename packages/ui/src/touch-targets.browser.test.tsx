import "./styles.css";
import { beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

beforeEach(() => {
  localStorage.clear();
});

const SELECTOR =
  'button, a[href], input, select, textarea, [role="tab"], [role="menuitem"], [role="checkbox"], [role="button"]';

/** Every visible control that is too small or has no accessible name. File tabs keep the design's 34/30px height. */
function offenders(min: number, tabHeight: number): string[] {
  const bad: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
    // A checkbox is tapped through its label.
    const wrapper = el instanceof HTMLInputElement ? el.closest("label") : null;
    const box = wrapper === null ? rect : wrapper.getBoundingClientRect();
    const isTab = el.className.startsWith("sc-tab");
    const name = el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.textContent.trim();
    const label = `${el.tagName.toLowerCase()}.${el.className.split(" ")[0] ?? ""} "${name}"`;
    if (box.width < min - 0.5 || box.height < (isTab ? tabHeight : min) - 0.5) {
      bad.push(`${label} is ${String(Math.round(box.width))}x${String(Math.round(box.height))}`);
    }
    const labelled =
      name !== "" ||
      (el instanceof HTMLInputElement && (el.labels?.length ?? 0) > 0) ||
      el.getAttribute("aria-labelledby") !== null;
    if (!labelled) bad.push(`${label} has no accessible name`);
  }
  return bad;
}

for (const [width, min, tabHeight] of [
  [390, 44, 33],
  [360, 44, 33],
  [834, 40, 29],
] as const) {
  describe(`MISC touch targets at ${String(width)}px are at least ${String(min)}px with accessible names`, () => {
    it("MISC code view with two tabs, and the overflow menu", async () => {
      await page.viewport(width, 800);
      const screen = await render(<App />);
      await screen.getByRole("button", { name: "New tab" }).click();
      expect(offenders(min, tabHeight)).toEqual([]);
      await screen.getByRole("button", { name: "File and convert actions" }).click();
      expect(offenders(min, tabHeight)).toEqual([]);
      expect(await axeViolations(screen.container)).toEqual([]);
    });

    it("MISC the Console and Debug views", async () => {
      await page.viewport(width, 800);
      const screen = await render(<App />);
      // A tablet shows every panel at once; a phone has one view at a time.
      for (const view of width < 700 ? ["Console", "Debug"] : []) {
        await screen.getByRole("button", { name: view, exact: true }).click();
        expect(offenders(min, tabHeight)).toEqual([]);
      }
      expect(offenders(min, tabHeight)).toEqual([]);
    });
  });
}

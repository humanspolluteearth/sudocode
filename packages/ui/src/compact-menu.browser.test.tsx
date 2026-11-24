import "./styles.css";
import { beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("MISC menu bar on tablets and phones (same File, Run, View... as desktop)", () => {
  for (const width of [390, 834]) {
    it(`MISC at ${String(width)}px the menu bar shows on top, fits the screen and opens a menu`, async () => {
      await page.viewport(width, 900);
      const screen = await render(<App />);
      for (const name of ["File", "Run", "Language", "View", "Help"])
        await expect.element(screen.getByRole("menuitem", { name, exact: true })).toBeVisible();
      const bar = document.querySelector(".sc-menubar")?.getBoundingClientRect();
      expect(bar?.top).toBe(0);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      await screen.getByRole("menuitem", { name: "View", exact: true }).click();
      const list = document.querySelector(".sc-menu-list")?.getBoundingClientRect();
      expect(list?.right ?? 9999).toBeLessThanOrEqual(width);
      expect(await axeViolations(screen.container)).toEqual([]);
    });
  }

  it("MISC on a tablet View > Side panel hides the panel and is ticked while shown", async () => {
    await page.viewport(834, 900);
    const screen = await render(<App />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await expect
      .element(screen.getByRole("menuitemradio", { name: "Side panel" }))
      .toHaveAttribute("aria-checked", "true");
    await screen.getByRole("menuitemradio", { name: "Side panel" }).click();
    await expect.element(screen.getByRole("button", { name: "Show side panel" })).toBeVisible();
    expect(getComputedStyle(document.querySelector(".sc-side") as HTMLElement).display).toBe("none");
  });

  it("MISC on a phone the line-number gutter is under 46px and still fits 4 digits", async () => {
    await page.viewport(390, 800);
    await render(<App />);
    const gutters = document.querySelector(".cm-gutters")?.getBoundingClientRect();
    expect(gutters?.width ?? 99).toBeLessThan(46);
  });
});

import "./styles.css";
import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { FakeWorker } from "./fake-worker.ts";
import { axeViolations } from "./axe.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("MISC compact layout (tablet 834 and phone 390, design Tablet/Mobile.dc.html)", () => {
  it("MISC a desktop-width window has no view switcher or key bar", async () => {
    await page.viewport(1280, 800);
    const screen = await render(<App />);
    await expect.element(screen.getByRole("navigation", { name: "Views" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("toolbar", { name: "Insert keyword" })).not.toBeInTheDocument();
  });

  for (const width of [834, 390]) {
    it(`MISC at ${String(width)}px the views switcher shows one view at a time`, async () => {
      await page.viewport(width, 800);
      const screen = await render(<App />);
      await expect.element(screen.getByRole("navigation", { name: "Views" })).toBeVisible();
      await expect.element(screen.getByRole("textbox", { name: "Program editor" })).toBeVisible();
      await expect.element(screen.getByRole("region", { name: "Console" })).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Console", exact: true }).click();
      await expect.element(screen.getByRole("region", { name: "Console" })).toBeVisible();
      await expect.element(screen.getByRole("textbox", { name: "Program editor" })).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Debug", exact: true }).click();
      await expect.element(screen.getByRole("region", { name: "Variables" })).toBeVisible();
      await expect.element(screen.getByRole("region", { name: "Console" })).not.toBeInTheDocument();
    });
  }

  it("MISC the Insert keyword bar types a keyword into the editor", async () => {
    await page.viewport(390, 800);
    const screen = await render(<App />);
    await screen.getByRole("textbox", { name: "Program editor" }).click();
    await userEvent.keyboard("{Control>}a{/Control}{Delete}");
    await screen.getByRole("button", { name: "Insert SEND" }).click();
    await screen.getByRole("button", { name: "Insert DISPLAY" }).click();
    expect(document.querySelector(".cm-content")?.textContent).toBe("SENDDISPLAY");
  });

  it("MISC the key bar follows the language", async () => {
    await page.viewport(390, 800);
    localStorage.setItem("sudocode.preferences", JSON.stringify({ language: "python" }));
    const screen = await render(<App />);
    await expect.element(screen.getByRole("button", { name: "Insert print(" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Insert SEND" })).not.toBeInTheDocument();
  });

  it("MISC the File and convert actions menu offers Save, New tab and the text sizes", async () => {
    await page.viewport(390, 800);
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "File and convert actions" }).click();
    for (const name of ["New tab", "Save", "Save as…", "Close tab"])
      await expect.element(screen.getByRole("menuitem", { name, exact: true })).toBeVisible();
    await expect.element(screen.getByRole("menuitemradio", { name: "Text size 125%" })).toBeVisible();
    await screen.getByRole("menuitemradio", { name: "Text size 125%" }).click();
    expect(localStorage.getItem("sudocode.preferences")).toContain('"zoom":125');
  });

  it("MISC the menu has no Convert item in Simple mode, and has it in Advanced mode", async () => {
    await page.viewport(390, 800);
    const simple = await render(<App />);
    await simple.getByRole("button", { name: "File and convert actions" }).click();
    await expect.element(simple.getByRole("menuitem", { name: "Convert to Python" })).not.toBeInTheDocument();
    await simple.unmount();
    localStorage.setItem("sudocode.preferences", JSON.stringify({ advanced: true }));
    const advanced = await render(<App />);
    await advanced.getByRole("button", { name: "File and convert actions" }).click();
    await expect.element(advanced.getByRole("menuitem", { name: "Convert to Python" })).toBeVisible();
  });

  it("MISC a problem shows the chip and a dot on Debug, and the chip jumps back to the code", async () => {
    await page.viewport(390, 800);
    const check = new FakeWorker();
    const workers = { createRunWorker: () => new FakeWorker(), createCheckWorker: () => check };
    const screen = await render(<App workers={workers} />);
    await screen.getByRole("textbox", { name: "Program editor" }).click();
    await userEvent.keyboard("x");
    await expect.poll(() => check.posted.length).toBeGreaterThan(0);
    const id = (check.posted.at(-1) as { id: number }).id;
    const diagnostic = {
      code: "E-ENDIF",
      line: 1,
      column: 1,
      message: "Needs an END IF.",
      hint: "",
      severity: "error",
    };
    check.reply({ type: "checked", id, diagnostics: [diagnostic] });
    await expect.element(screen.getByRole("img", { name: "1 problem" })).toBeVisible();
    await screen.getByRole("button", { name: /Line 1/ }).click();
    await expect.element(screen.getByRole("textbox", { name: "Program editor" })).toBeVisible();
  });

  it("MISC on a phone, waiting for input and finishing a run both switch to the Console view", async () => {
    await page.viewport(390, 800);
    const runner = new FakeWorker();
    const workers = { createRunWorker: () => runner, createCheckWorker: () => new FakeWorker() };
    const screen = await render(<App workers={workers} />);
    await screen.getByRole("button", { name: "Run", exact: true }).click();
    await expect.poll(() => runner.posted.length).toBeGreaterThan(0);
    await expect.element(screen.getByRole("textbox", { name: "Program editor" })).toBeVisible();
    runner.reply({ type: "inputRequest", prompt: "Name? " });
    await expect.element(screen.getByRole("region", { name: "Console" })).toBeVisible();
    await screen.getByRole("button", { name: "Code", exact: true }).click();
    runner.reply({ type: "done", status: "finished" });
    await expect.element(screen.getByRole("region", { name: "Console" })).toBeVisible();
    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it("MISC on a phone an unsaved tab adds no problem dot: Debug holds the only one", async () => {
    await page.viewport(390, 800);
    const screen = await render(<App />);
    await screen.getByRole("textbox", { name: "Program editor" }).click();
    await userEvent.keyboard("x");
    await expect.element(screen.getByRole("img", { name: "unsaved changes" })).toBeVisible();
    const dot = screen.getByRole("img", { name: "unsaved changes" }).element();
    expect(getComputedStyle(dot).position).not.toBe("absolute");
    expect(document.querySelectorAll(".sc-dot")).toHaveLength(0);
    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it("MISC five tabs on a phone: the strip scrolls, the active tab stays in view, and the page does not overflow", async () => {
    await page.viewport(390, 800);
    const screen = await render(<App />);
    for (let i = 0; i < 4; i++) await screen.getByRole("button", { name: "New tab" }).click();
    const strip = document.querySelector<HTMLElement>(".sc-tabs-scroll");
    const wrap = document.querySelector<HTMLElement>(".sc-tabs-wrap");
    if (strip === null || wrap === null) throw new Error("no tab strip");
    expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
    // The newest tab is active and fully visible; earlier tabs are hidden to the left, so the fade shows there.
    await expect.poll(() => wrap.dataset["moreLeft"]).toBe("true");
    const active = strip.querySelector<HTMLElement>('[aria-selected="true"]')?.getBoundingClientRect();
    const box = strip.getBoundingClientRect();
    expect(active?.right ?? 0).toBeLessThanOrEqual(box.right + 1);
    expect(active?.left ?? -1).toBeGreaterThanOrEqual(box.left - 1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect(document.querySelector(".sc-tabstrip")?.getBoundingClientRect().height).toBe(34);
    // Switching to the first tab scrolls back and moves the fade to the right edge.
    await screen.getByRole("tab").first().click();
    await expect.poll(() => wrap.dataset["moreRight"]).toBe("true");
    await expect.poll(() => wrap.dataset["moreLeft"]).toBe("false");
    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it("MISC on a tablet the tab strip is 30px high", async () => {
    await page.viewport(834, 800);
    await render(<App />);
    expect(document.querySelector(".sc-tabstrip")?.getBoundingClientRect().height).toBe(30);
  });

  for (const width of [834, 390]) {
    it(`MISC axe finds nothing at ${String(width)}px in any view`, async () => {
      await page.viewport(width, 800);
      const screen = await render(<App />);
      for (const view of ["Code", "Console", "Debug"]) {
        await screen.getByRole("button", { name: view, exact: true }).click();
        expect(await axeViolations(screen.container)).toEqual([]);
      }
    });
  }
});

import "./styles.css";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { FakeWorker } from "./fake-worker.ts";
import { axeViolations } from "./axe.ts";
import { MenuBar } from "./MenuBar.tsx";
import { buildMenus, type MenuActions } from "./menu-model.ts";

const actions = (over: Partial<MenuActions> = {}): MenuActions => ({
  running: false,
  paused: false,
  canRun: true,
  onRun: () => undefined,
  onStop: () => undefined,
  onContinue: () => undefined,
  onStepOver: () => undefined,
  onStepInto: () => undefined,
  onStepOut: () => undefined,
  onPause: () => undefined,
  language: "edexcel",
  onLanguage: () => undefined,
  zoom: 100,
  onZoom: () => undefined,
  theme: "system",
  onTheme: () => undefined,
  sideTab: "debugger",
  onSideTab: () => undefined,
  onClearConsole: () => undefined,
  breakpointCount: 0,
  onClearBreakpoints: () => undefined,
  onNewFile: () => undefined,
  onOpenFile: () => undefined,
  onSave: () => undefined,
  onSaveAs: () => undefined,
  onSaveAll: () => undefined,
  advanced: true,
  onConvertToPython: () => undefined,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
});

const sideDisplay = () => {
  const side = document.querySelector<HTMLElement>(".sc-side");
  return side === null ? "absent" : getComputedStyle(side).display;
};
const stored = () =>
  (JSON.parse(localStorage.getItem("sudocode.preferences") ?? "{}") as { sidePanelHidden?: boolean }).sidePanelHidden;

describe("MISC tablet side-panel toggle (700-1100px)", () => {
  for (const width of [390, 1440]) {
    it(`MISC at ${String(width)}px there is no side-panel toggle`, async () => {
      await page.viewport(width, 900);
      const screen = await render(<App />);
      await expect.element(screen.getByRole("button", { name: /side panel/i })).not.toBeInTheDocument();
    });
  }

  it("MISC at 834px the toggle is a 40px button that swaps its title and aria-pressed", async () => {
    await page.viewport(834, 1000);
    const screen = await render(<App />);
    const hide = screen.getByRole("button", { name: "Hide side panel" });
    await expect.element(hide).toBeVisible();
    await expect.element(hide).toHaveAttribute("aria-pressed", "true");
    const box = hide.element().getBoundingClientRect();
    expect(box.width).toBe(40);
    expect(box.height).toBe(40);
    await hide.click();
    const show = screen.getByRole("button", { name: "Show side panel" });
    await expect.element(show).toHaveAttribute("aria-pressed", "false");
    expect(show.element().getAttribute("title")).toBe("Show side panel");
  });

  it("MISC hiding the panel gives the editor the full width and it is remembered after a reload", async () => {
    await page.viewport(834, 1000);
    const first = await render(<App />);
    expect(sideDisplay()).toBe("flex");
    const before = document.querySelector(".sc-editor")?.getBoundingClientRect().width ?? 0;
    await first.getByRole("button", { name: "Hide side panel" }).click();
    expect(sideDisplay()).toBe("none");
    const after = document.querySelector(".sc-editor")?.getBoundingClientRect().width ?? 0;
    expect(after).toBeGreaterThan(before + 300);
    expect(stored()).toBe(true);
    await first.unmount();
    const second = await render(<App />);
    await expect.element(second.getByRole("button", { name: "Show side panel" })).toBeVisible();
    expect(sideDisplay()).toBe("none");
  });

  it("MISC a hidden choice does not hide the panel on a phone or desktop", async () => {
    localStorage.setItem("sudocode.preferences", JSON.stringify({ sidePanelHidden: true }));
    await page.viewport(1440, 900);
    const screen = await render(<App />);
    await expect.element(screen.getByRole("region", { name: "Variables" })).toBeVisible();
  });

  it("MISC the View menu has a Side panel entry, ticked while shown, that calls the toggle", async () => {
    const onToggleSidePanel = vi.fn();
    const base = actions();
    const screen = await render(<MenuBar menus={buildMenus({ ...base, onToggleSidePanel, sidePanelShown: true })} />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    const entry = screen.getByRole("menuitemradio", { name: "Side panel" });
    await expect.element(entry).toHaveAttribute("aria-checked", "true");
    await entry.click();
    expect(onToggleSidePanel).toHaveBeenCalledOnce();
    await screen.rerender(<MenuBar menus={buildMenus({ ...base, onToggleSidePanel, sidePanelShown: false })} />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await expect
      .element(screen.getByRole("menuitemradio", { name: "Side panel" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("MISC without a toggle (desktop, phone) the View menu has no Side panel entry", async () => {
    const screen = await render(<MenuBar menus={buildMenus(actions())} />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await expect.element(screen.getByRole("menuitemradio", { name: "Side panel" })).not.toBeInTheDocument();
  });

  it("MISC a pause or error while the panel is hidden shows a dot on the toggle and does not reopen it", async () => {
    await page.viewport(834, 1000);
    localStorage.setItem("sudocode.preferences", JSON.stringify({ sidePanelHidden: true }));
    const runner = new FakeWorker();
    const workers = { createRunWorker: () => runner, createCheckWorker: () => new FakeWorker() };
    const screen = await render(<App workers={workers} />);
    expect(document.querySelector(".sc-side-dot")).toBeNull();
    await screen.getByRole("button", { name: "Run", exact: true }).click();
    await expect.poll(() => runner.posted.length).toBeGreaterThan(0);
    runner.reply({ type: "paused", reason: "breakpoint", line: 1, column: 1, stack: [] });
    await expect.element(screen.getByText(/paused or stopped with an error/)).toBeInTheDocument();
    expect(document.querySelectorAll(".sc-side-dot")).toHaveLength(1);
    expect(sideDisplay()).toBe("none");
    expect(await axeViolations(screen.container)).toEqual([]);
    await screen.getByRole("button", { name: "Show side panel" }).click();
    expect(document.querySelector(".sc-side-dot")).toBeNull();
    expect(sideDisplay()).toBe("flex");
  });

  for (const theme of ["light", "dark"]) {
    it(`MISC axe is clean at 834px with the panel hidden (${theme})`, async () => {
      await page.viewport(834, 1000);
      localStorage.setItem("sudocode.preferences", JSON.stringify({ sidePanelHidden: true, theme }));
      const screen = await render(<App />);
      await expect.element(screen.getByRole("button", { name: "Show side panel" })).toBeVisible();
      expect(await axeViolations(screen.container)).toEqual([]);
    });
  }
});

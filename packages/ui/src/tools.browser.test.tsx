import "./styles.css";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";
import { toolFlags, TOOLS, type ToolId } from "./tools.ts";

const prefs = (advanced: boolean, toolsOff: ToolId[] = []) => {
  localStorage.setItem("sudocode.preferences", JSON.stringify({ advanced, toolsOff }));
};
beforeEach(() => {
  localStorage.clear();
});

describe("MISC tool switches (docs/PRODUCT.md)", () => {
  it("MISC Simple mode turns the Advanced-only tools off whatever the switches say", () => {
    const flags = toolFlags(false, []);
    for (const t of TOOLS) expect(flags[t.id]).toBe(!t.advancedOnly);
  });
  it("MISC Advanced mode turns everything on except what the student switched off", () => {
    const flags = toolFlags(true, ["traceTable"]);
    expect(Object.entries(flags).filter(([, on]) => !on)).toEqual([["traceTable", false]]);
  });

  it("MISC Simple mode shows no Files tab, Call stack, Convert menu or Convert to select", async () => {
    prefs(false);
    const screen = await render(<App />);
    await expect.element(screen.getByRole("button", { name: "Files", exact: true })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("region", { name: "Call stack" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("menuitem", { name: "Convert", exact: true })).not.toBeInTheDocument();
    await expect.element(screen.getByLabelText("Convert to")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("region", { name: "Trace table" })).toBeVisible();
  });
  it("MISC Advanced mode shows the Files tab, Call stack, Convert menu and Convert to select", async () => {
    prefs(true);
    const screen = await render(<App />);
    await expect.element(screen.getByRole("button", { name: "Files", exact: true })).toBeVisible();
    await expect.element(screen.getByRole("region", { name: "Call stack" })).toBeVisible();
    await expect.element(screen.getByRole("menuitem", { name: "Convert", exact: true })).toBeVisible();
    await expect.element(screen.getByLabelText("Convert to")).toBeVisible();
  });

  const gone: [ToolId, (s: Awaited<ReturnType<typeof render>>) => Promise<void>][] = [
    [
      "problems",
      async (s) => {
        await expect.element(s.getByRole("region", { name: "Problems" })).not.toBeInTheDocument();
      },
    ],
    [
      "variables",
      async (s) => {
        await expect.element(s.getByRole("region", { name: "Variables" })).not.toBeInTheDocument();
      },
    ],
    [
      "breakpoints",
      async (s) => {
        await expect.element(s.getByRole("region", { name: "Breakpoints" })).not.toBeInTheDocument();
        await expect.element(s.getByRole("button", { name: /Clear breakpoints/ })).not.toBeInTheDocument();
        await expect.element(s.getByRole("button", { name: "Step over" })).not.toBeInTheDocument();
        expect(s.container.querySelector(".sc-bp-off")).not.toBeNull();
      },
    ],
    [
      "traceTable",
      async (s) => {
        await expect.element(s.getByRole("region", { name: "Trace table" })).not.toBeInTheDocument();
      },
    ],
    [
      "reference",
      async (s) => {
        await expect.element(s.getByRole("button", { name: "Quick reference" })).not.toBeInTheDocument();
      },
    ],
    [
      "examples",
      async (s) => {
        await expect.element(s.getByLabelText("Example")).not.toBeInTheDocument();
      },
    ],
    [
      "stepInto",
      async (s) => {
        await expect.element(s.getByRole("region", { name: "Call stack" })).not.toBeInTheDocument();
      },
    ],
    [
      "files",
      async (s) => {
        await expect.element(s.getByRole("button", { name: "Files", exact: true })).not.toBeInTheDocument();
      },
    ],
    [
      "converter",
      async (s) => {
        await expect.element(s.getByRole("menuitem", { name: "Convert", exact: true })).not.toBeInTheDocument();
      },
    ],
  ];
  it.each(gone)("MISC switching %s off really removes it", async (id, check) => {
    prefs(true, [id]);
    const screen = await render(<App />);
    await check(screen);
  });

  it("MISC Settings in Simple mode has theme and text size but no tool switches", async () => {
    prefs(false);
    const screen = await render(<App />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await screen.getByRole("menuitem", { name: /Settings/ }).click();
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    await expect.element(dialog.getByRole("combobox", { name: /Theme/ })).toBeVisible();
    await expect.element(dialog.getByRole("combobox", { name: /Text size/ })).toBeVisible();
    await expect.element(dialog.getByRole("group", { name: /Tools/ })).not.toBeInTheDocument();
  });
  it("MISC unticking a tool in Settings removes it at once and it is remembered", async () => {
    prefs(true);
    const screen = await render(<App />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await screen.getByRole("menuitem", { name: /Settings/ }).click();
    expect(await axeViolations(screen.getByRole("dialog").element() as HTMLElement)).toEqual([]);
    await screen.getByRole("checkbox", { name: "Trace table" }).click();
    await screen.getByRole("button", { name: "Close" }).click();
    await expect.element(screen.getByRole("region", { name: "Trace table" })).not.toBeInTheDocument();
    expect(
      (JSON.parse(localStorage.getItem("sudocode.preferences") ?? "{}") as { toolsOff: ToolId[] }).toolsOff,
    ).toEqual(["traceTable"]);
  });
});

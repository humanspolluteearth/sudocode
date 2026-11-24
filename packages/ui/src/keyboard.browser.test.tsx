import "./styles.css";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

// M10 accessibility pass: the IDE can be used without a mouse, and every control has a name a screen reader reads.
const focusedName = (): string => {
  const el = document.activeElement;
  return el === null ? "" : (el.getAttribute("aria-label") ?? el.textContent).trim();
};

describe("MISC keyboard-only use", () => {
  it("MISC Tab reaches the menus, the Run button and the editor, each with a name", async () => {
    localStorage.clear();
    await render(<App />);
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await userEvent.tab();
      seen.push(focusedName());
      if (document.activeElement?.classList.contains("cm-content")) break;
    }
    expect(seen).toContain("File");
    expect(seen).toContain("Run");
    expect(document.activeElement?.classList.contains("cm-content")).toBe(true);
    expect(seen.every((n) => n !== "")).toBe(true);
  });

  it("MISC a menu opens from the keyboard, arrows move through it and Escape closes it", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    screen.getByRole("menuitem", { name: "File", exact: true }).element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("menuitem", { name: /^New file/ })).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("role")).toMatch(/^menuitem/);
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menuitem", { name: /^New file/ })).not.toBeInTheDocument();
  });

  it("MISC the whole app has no axe violations and every button, tab and field has a name", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    expect(await axeViolations(screen.container)).toEqual([]);
    for (const el of screen.container.querySelectorAll("button, [role=tab], input, select")) {
      const name = (el.getAttribute("aria-label") || el.textContent || el.closest("label")?.textContent || "").trim();
      expect(name, el.outerHTML.slice(0, 80)).not.toBe("");
    }
  });
});

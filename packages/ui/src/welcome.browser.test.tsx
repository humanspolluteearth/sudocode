import "./styles.css";
import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

// The startup dialog. The shared test setup (test-setup.ts) reads a missing `welcomeDone` as true; these tests store
// `welcomeDone: false` themselves so the dialog shows.
const SHOW = JSON.stringify({ welcomeDone: false });
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("sudocode.preferences", SHOW);
});

const dialog = (screen: Awaited<ReturnType<typeof render>>) => screen.getByRole("dialog");

describe("MISC startup dialog", () => {
  it("MISC shows on launch as a labelled modal dialog with focus inside and a step indicator", async () => {
    await page.viewport(1280, 800);
    const screen = await render(<App />);
    await expect.element(dialog(screen)).toBeVisible();
    await expect.element(dialog(screen)).toHaveAttribute("aria-modal", "true");
    await expect.element(screen.getByRole("dialog", { name: "Welcome to Sudocode" })).toBeVisible();
    await expect.element(screen.getByText("Step 1 of 3")).toBeVisible();
    expect(dialog(screen).element().contains(document.activeElement)).toBe(true);
  });

  it("MISC walks through the three steps with Back and Next, using the exact wording", async () => {
    const screen = await render(<App />);
    await expect.element(screen.getByText(/Run it, step through it, watch the variables change\./)).toBeVisible();
    await screen.getByRole("button", { name: "Next" }).click();
    await expect.element(screen.getByRole("dialog", { name: "This is not an official program" })).toBeVisible();
    await expect.element(screen.getByText("Step 2 of 3")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "saysayeem.edu@gmail.com" }))
      .toHaveAttribute("href", "mailto:saysayeem.edu@gmail.com");
    await expect.element(screen.getByText(/trust the mark scheme\./)).toBeVisible();
    await screen.getByRole("button", { name: "Back" }).click();
    await expect.element(screen.getByText("Step 1 of 3")).toBeVisible();
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("button", { name: "Next" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Don't let typing become a habit" })).toBeVisible();
    await expect.element(screen.getByText("Good luck, programmers.")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Start coding" })).toBeVisible();
  });

  it("MISC Start coding without the box closes it, and it shows again next launch", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("button", { name: "Start coding" }).click();
    await expect.element(dialog(screen)).not.toBeInTheDocument();
    await screen.unmount();
    const again = await render(<App />);
    await expect.element(dialog(again)).toBeVisible();
  });

  it("MISC Start coding with the box ticked remembers it in the preferences", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("checkbox", { name: /Don.t show this again/ }).click();
    await screen.getByRole("button", { name: "Start coding" }).click();
    expect(localStorage.getItem("sudocode.preferences")).toContain('"welcomeDone":true');
    await screen.unmount();
    const again = await render(<App />);
    await expect.element(again.getByRole("textbox", { name: "Program editor" })).toBeVisible();
    await expect.element(dialog(again)).not.toBeInTheDocument();
  });

  it("MISC Escape closes it without ticking the box, even when the box was ticked", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("button", { name: "Next" }).click();
    await screen.getByRole("checkbox", { name: /Don.t show this again/ }).click();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog(screen)).not.toBeInTheDocument();
    expect(localStorage.getItem("sudocode.preferences")).not.toContain('"welcomeDone":true');
  });

  it("MISC Tab stays inside the dialog (forwards and backwards) and focus returns to the editor on close", async () => {
    const screen = await render(<App />);
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog(screen).element().contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog(screen).element().contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog(screen)).not.toBeInTheDocument();
    expect(document.activeElement?.closest(".cm-editor")).not.toBeNull();
  });

  it("MISC Help > Welcome and disclaimer reopens it after it was dismissed for good", async () => {
    localStorage.setItem("sudocode.preferences", JSON.stringify({ welcomeDone: true }));
    const screen = await render(<App />);
    await expect.element(dialog(screen)).not.toBeInTheDocument();
    await screen.getByRole("menuitem", { name: "Help", exact: true }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Report a bug" })).toBeVisible();
    await screen.getByRole("menuitem", { name: "Welcome and disclaimer" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Welcome to Sudocode" })).toBeVisible();
  });

  for (const [width, height, name] of [
    [360, 640, "a 360px phone"],
    [834, 1112, "the 834px tablet layout"],
    [1280, 800, "desktop"],
  ] as const) {
    for (const theme of ["light", "dark"]) {
      it(`MISC on ${name} in ${theme}: fits the screen, buttons are 44px on touch layouts, axe is clean on every step`, async () => {
        await page.viewport(width, height);
        localStorage.setItem("sudocode.preferences", JSON.stringify({ welcomeDone: false, theme }));
        const screen = await render(<App />);
        for (let step = 1; step <= 3; step++) {
          const box = dialog(screen).element().querySelector(".sc-dialog");
          const rect = box?.getBoundingClientRect();
          expect(rect?.left).toBeGreaterThanOrEqual(0);
          expect(rect?.right).toBeLessThanOrEqual(width);
          expect(rect?.bottom).toBeLessThanOrEqual(height);
          if (width <= 1100) {
            for (const b of box?.querySelectorAll("button") ?? []) {
              expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(43.5);
            }
          }
          expect(await axeViolations(dialog(screen).element())).toEqual([]);
          if (step < 3) await screen.getByRole("button", { name: "Next" }).click();
        }
      });
    }
  }
});

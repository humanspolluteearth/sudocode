import "./styles.css";
import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("sudocode.preferences", JSON.stringify({ welcomeDone: true }));
});

type Screen = Awaited<ReturnType<typeof render>>;

async function openAuthor(screen: Screen): Promise<void> {
  await screen.getByRole("menuitem", { name: "Help", exact: true }).click();
  await screen.getByRole("menuitem", { name: "Author" }).click();
}

describe("MISC Help > Author dialog", () => {
  it("MISC Help keeps its other items and has Author", async () => {
    const screen = await render(<App />);
    await screen.getByRole("menuitem", { name: "Help", exact: true }).click();
    for (const name of ["Welcome and disclaimer", "Report a bug", "Author"]) {
      await expect.element(screen.getByRole("menuitem", { name })).toBeVisible();
    }
  });

  it("MISC Author shows the name, the mailto email and the unofficial notice, and axe is clean", async () => {
    const screen = await render(<App />);
    await openAuthor(screen);
    const dialog = screen.getByRole("dialog", { name: "Author" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText("Mahmudul Hasan Sayeem")).toBeVisible();
    await expect
      .element(dialog.getByRole("link", { name: "saysayeem.edu@gmail.com" }))
      .toHaveAttribute("href", "mailto:saysayeem.edu@gmail.com");
    await expect.element(dialog.getByText(/not made by Cambridge \(CIE\) or Edexcel/)).toBeVisible();
    await expect.element(dialog.getByText(/Mark schemes are the source of truth/)).toBeVisible();
    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it("MISC Author moves focus in, keeps Tab inside, and Esc returns focus to the Help menu", async () => {
    const screen = await render(<App />);
    await openAuthor(screen);
    const box = document.querySelector(".sc-author") as HTMLElement;
    expect(box.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard("{Tab}");
      expect(box.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
      expect(box.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("dialog", { name: "Author" })).not.toBeInTheDocument();
    expect(document.activeElement?.textContent).toBe("Help");
  });

  it("MISC the Close button closes Author and returns focus to Help", async () => {
    const screen = await render(<App />);
    await openAuthor(screen);
    await screen.getByRole("button", { name: "Close" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Author" })).not.toBeInTheDocument();
    expect(document.activeElement?.textContent).toBe("Help");
  });

  for (const [width, height, min] of [
    [390, 700, 44],
    [834, 1000, 40],
  ] as const) {
    it(`MISC at ${String(width)}px Help > Author is in the compact menu and fits with touch-size controls`, async () => {
      await page.viewport(width, height);
      const screen = await render(<App />);
      await openAuthor(screen);
      const rect = (document.querySelector(".sc-author") as HTMLElement).getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.bottom).toBeLessThanOrEqual(height);
      for (const el of document.querySelectorAll<HTMLElement>(".sc-author button, .sc-author a")) {
        expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(min - 0.5);
      }
      expect(await axeViolations(screen.container)).toEqual([]);
    });
  }
});

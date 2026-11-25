import "./styles.css";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

const menu = async (screen: Awaited<ReturnType<typeof render>>, bar: string, item: string | RegExp) => {
  await screen.getByRole("menuitem", { name: bar, exact: true }).click();
  await screen.getByRole("menuitem", { name: item }).click();
};

// The converter is an Advanced tool (docs/PRODUCT.md), so these tests switch Advanced on first.
const advanced = () => {
  localStorage.setItem("sudocode.preferences", JSON.stringify({ advanced: true }));
};

describe("MISC files in the app: tabs and Convert", () => {
  it("MISC File > New file opens a second tab and closing it returns to the first", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    await menu(screen, "File", /^New file/);
    await expect.element(screen.getByRole("tab", { name: /untitled 2\.epc/ })).toHaveAttribute("aria-selected", "true");
    await screen.getByRole("button", { name: "Close untitled 2.epc" }).click();
    await expect.element(screen.getByRole("tab", { name: /untitled\.epc/ })).toHaveAttribute("aria-selected", "true");
  });

  it("MISC Convert to Python opens the converted program in a new tab with a note", async () => {
    advanced();
    const screen = await render(<App />);
    // The app starts blank, so type a one-line program to convert.
    await screen.getByRole("textbox").first().click();
    await userEvent.keyboard("SEND 1 TO DISPLAY");
    await menu(screen, "Convert", "Convert to Python");
    await expect.element(screen.getByRole("tab", { name: /untitled\.py/ })).toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("main").getByRole("status"))
      .toHaveTextContent(
        "Converted from Edexcel pseudocode to Python. Arrays are lists, and SEND/RECEIVE became print/input. Your original is still open in its own tab. Run it to check it does the same.Dismiss",
      );
    // The new tab holds Python, not the original pseudocode.
    await expect.poll(() => screen.getByRole("textbox").first().element().textContent).toContain("print(");
    // The original is still there, in its own tab.
    await expect.element(screen.getByRole("tab", { name: /untitled\.epc/ })).toBeVisible();
  });

  it("MISC Convert to Cambridge opens a .cpc tab with a note, and a refusal opens no tab", async () => {
    advanced();
    const screen = await render(<App />);
    await screen.getByRole("textbox").first().click();
    await userEvent.keyboard("SEND 1 TO DISPLAY");
    await menu(screen, "Convert", "Convert to Cambridge 9618 pseudocode");
    await expect.element(screen.getByRole("tab", { name: /untitled\.cpc/ })).toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("main").getByRole("status"))
      .toHaveTextContent(
        "Converted from Edexcel pseudocode to Cambridge 9618 pseudocode. Variables are now declared with their type, arrays start at 0 with a fixed size, and SEND/RECEIVE became OUTPUT/INPUT. Your original is still open in its own tab. Run it to check it does the same.Dismiss",
      );
    await expect.poll(() => screen.getByRole("textbox").first().element().textContent).toContain("OUTPUT 1");
  });

  it("MISC a refused conversion shows the message and opens no new tab", async () => {
    advanced();
    const screen = await render(<App />);
    await screen.getByRole("textbox").first().click();
    await userEvent.keyboard("SET a TO [[1, 2]{Enter}SET a[[5] TO 9");
    await menu(screen, "Convert", "Convert to Cambridge 9618 pseudocode");
    await expect.element(screen.getByRole("main").getByRole("status")).toBeVisible();
    await expect.element(screen.getByRole("tab", { name: /untitled\.cpc/ })).not.toBeInTheDocument();
  });

  it("MISC Simple mode has no Convert menu", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    await expect.element(screen.getByRole("menuitem", { name: "Convert", exact: true })).not.toBeInTheDocument();
  });

  it("MISC Save as asks for a name and type, and Escape cancels", async () => {
    const screen = await render(<App />);
    await menu(screen, "File", /^Save as/);
    await expect.element(screen.getByRole("dialog", { name: "Save file" })).toBeVisible();
    expect(await axeViolations(screen.getByRole("dialog").element() as HTMLElement)).toEqual([]);
    await screen.getByLabelText("File name").click();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("MISC Save as with a new name renames the tab", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    await menu(screen, "File", /^Save as/);
    await screen.getByLabelText("File name").fill("mine");
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
    await expect.poll(() => screen.getByRole("tab", { selected: true }).element().textContent).toContain("mine.epc");
  });
});

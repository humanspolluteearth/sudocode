import { expect, test, type Page } from "@playwright/test";

// Replace the editor's text the way a student would: focus it, select all, type.
async function typeProgram(page: Page, code: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: "Program editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

test("a program runs and its output shows in the console", async ({ page }) => {
  await page.goto("/");
  await typeProgram(page, "SEND 'Hello, world' TO DISPLAY");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("log")).toContainText("Hello, world");
  await expect(page.getByRole("log")).toContainText("Finished.");
});

test("Stop ends a WHILE TRUE loop", async ({ page }) => {
  await page.goto("/");
  await typeProgram(page, "WHILE TRUE DO\nSET x TO 1\nEND WHILE");
  await page.getByRole("button", { name: "Run" }).click();
  const stop = page.getByRole("button", { name: "Reset" });
  await expect(stop).toBeEnabled();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
  await stop.click();
  await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
  await expect(stop).toBeDisabled();
  await expect(page.getByRole("log")).toContainText("Stopped.");
  // A fresh worker per run: running again after a Stop works.
  await typeProgram(page, "SEND 'again' TO DISPLAY");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("log")).toContainText("again");
});

test("a syntax error shows in Problems", async ({ page }) => {
  await page.goto("/");
  await typeProgram(page, "IF TRUE THEN\nSEND 'x' TO DISPLAY");
  const problems = page.getByRole("region", { name: "Problems" });
  await expect(problems.getByRole("button").first()).toBeVisible({ timeout: 5000 });
  await expect(problems).not.toContainText("No problems.");
});

test("switching to Cambridge pseudocode runs a CIE program and shows the Quick reference", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /Language/ }).selectOption("cie");
  await typeProgram(page, 'OUTPUT "Hello, Cambridge"');
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("log")).toContainText("Hello, Cambridge");
  await page.getByRole("button", { name: "Quick reference" }).click();
  await expect(page.getByRole("region", { name: "Quick reference" })).toContainText("Variables and constants");
  await expect(page.getByRole("status", { name: "Status bar" })).toContainText("Cambridge");
});

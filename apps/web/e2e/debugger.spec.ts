import { expect, test, type Page } from "@playwright/test";

// M4 debugger, end to end: a breakpoint pauses the real worker, the Variables panel shows the paused frame, and
// the trace table matches SH-17 (one row per assignment and per output line, in order).

const PROGRAM = [
  "SET total TO 0",
  "FOR i FROM 1 TO 2 DO",
  "    SET total TO total + i",
  "END FOR",
  "SEND total TO DISPLAY",
].join("\n");

async function typeProgram(page: Page, code: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: "Program editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

/** Clicks the breakpoint gutter beside line `n`. */
async function clickGutter(page: Page, n: number): Promise<void> {
  const number = page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: new RegExp(`^${String(n)}$`) });
  const box = await number.boundingBox();
  const gutter = await page.locator(".sc-bp-gutter").boundingBox();
  if (box === null || gutter === null) throw new Error(`No gutter for line ${String(n)}`);
  await page.mouse.click(gutter.x + gutter.width / 2, box.y + box.height / 2);
}

async function cells(page: Page, table: string): Promise<string[][]> {
  return page
    .getByRole("table", { name: table })
    .locator("tr")
    .evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent.trim())));
}

test("MISC Run pauses at a breakpoint and the Variables panel shows the values there", async ({ page }) => {
  await page.goto("/");
  await typeProgram(page, PROGRAM);
  await clickGutter(page, 3);
  await page.getByRole("button", { name: "Run" }).click();

  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  const vars = page.getByRole("table", { name: /^Variables in/ });
  await expect(vars.getByRole("row", { name: /total/ })).toContainText("0");
  await expect(vars.getByRole("row", { name: /\bi\b/ })).toContainText("1");

  // Continue: the next pause is the same line in the next iteration, with total changed.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(vars.getByRole("row", { name: /total/ })).toContainText("1");
  await expect(vars.getByRole("row", { name: /\bi\b/ })).toContainText("2");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("log")).toContainText("Finished.");
  await expect(page.getByRole("log")).toContainText("3");
});

test("SH-17 the trace table of a run matches the program", async ({ page }) => {
  await page.goto("/");
  await typeProgram(page, PROGRAM);
  await page.getByRole("button", { name: "Debugger" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("log")).toContainText("Finished.");
  expect(await cells(page, "Trace table")).toEqual([
    ["Line", "total", "i", "Output"],
    ["1", "0", "", ""],
    ["2", "", "1", ""],
    ["3", "1", "", ""],
    ["2", "", "2", ""],
    ["3", "3", "", ""],
    ["5", "", "", "3"],
  ]);
});

test("SH-05 RECEIVE waits for a line typed in the console input box", async ({ page }) => {
  await page.goto("/");
  await typeProgram(page, "RECEIVE n FROM (INTEGER) KEYBOARD\nSEND n * 2 TO DISPLAY");
  await page.getByRole("button", { name: "Run" }).click();
  const input = page.getByRole("textbox", { name: "Input" });
  await expect(input).toBeFocused();
  await input.fill("21");
  await input.press("Enter");
  await expect(page.getByRole("log")).toContainText("42");
  await expect(page.getByRole("log")).toContainText("Finished.");
});

import { expect, test } from "@playwright/test";

// The startup dialog, end to end and as screenshot baselines (step 2 has the most text) at the three sizes the
// design covers. These tests start with empty storage, so the dialog shows (the other specs start with it dismissed).
test.use({ storageState: { cookies: [], origins: [] } });

test("the startup dialog shows, is remembered once its box is ticked, and Help reopens it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Welcome to Sudocode" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("checkbox", { name: /Don.t show this again/ }).check();
  await page.getByRole("button", { name: "Start coding" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: "Welcome and disclaimer" }).click();
  await expect(page.getByRole("dialog", { name: "Welcome to Sudocode" })).toBeVisible();
});

for (const [name, width, height] of [
  ["phone", 390, 844],
  ["tablet", 834, 1112],
  ["desktop", 1440, 900],
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`the startup dialog looks the same on ${name} in ${scheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByRole("dialog", { name: "This is not an official program" })).toBeVisible();
      await expect(page).toHaveScreenshot(`welcome-${name}-${scheme}.png`, {
        maxDiffPixelRatio: 0.05,
        animations: "disabled",
      });
    });
  }
}

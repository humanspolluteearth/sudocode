import { expect, test } from "@playwright/test";

// Screenshot baselines of the app's own UI at 1440x900, light and dark. They catch accidental layout changes; they
// are not compared with the design (scripts/ui-compare.mjs does that by eye). Web fonts are blocked so the fallback
// font is the same on every run, and the tolerance absorbs small differences between machines' fallback fonts.
test.use({ viewport: { width: 1440, height: 900 } });

for (const scheme of ["light", "dark"] as const) {
  test(`the IDE looks the same in ${scheme} mode`, async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
    await expect(page.getByText("No problems.")).toBeVisible();
    await expect(page).toHaveScreenshot(`ide-${scheme}.png`, { maxDiffPixelRatio: 0.05, animations: "disabled" });
  });
}

// The compact layouts (design Tablet.dc.html at 834 wide, Mobile.dc.html at 390 wide), same rules as above.
for (const [name, width, height] of [
  ["tablet", 834, 1112],
  ["mobile", 390, 844],
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`the ${name} layout looks the same in ${scheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
      await expect(page.getByRole("toolbar", { name: "Insert keyword" })).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}-${scheme}.png`, { maxDiffPixelRatio: 0.05, animations: "disabled" });
    });
  }
}

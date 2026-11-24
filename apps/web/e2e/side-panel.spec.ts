import { expect, test, type Page } from "@playwright/test";

// The tablet side-panel toggle, end to end and as screenshot baselines: hidden on a tablet (834), the indicator dot
// after an error while hidden, and the phone (390) and desktop (1440x900) layouts, which have no toggle.
const setPrefs = (page: Page, extra: Record<string, unknown>) =>
  page.addInitScript((more) => {
    const key = "sudocode.preferences";
    const old = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(key, JSON.stringify({ ...old, ...more }));
  }, extra);

const prepare = async (page: Page, width: number, height: number, scheme: "light" | "dark") => {
  await page.setViewportSize({ width, height });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
};
const shot = { maxDiffPixelRatio: 0.05, animations: "disabled" } as const;

test("on a tablet the toggle hides the side panel and the choice survives a reload", async ({ page }) => {
  await prepare(page, 834, 1112, "light");
  await page.goto("/");
  await page.getByRole("button", { name: "Hide side panel" }).click();
  await expect(page.getByRole("region", { name: "Variables" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Show side panel" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Variables" })).toBeHidden();
});

for (const scheme of ["light", "dark"] as const) {
  test(`tablet with the side panel hidden looks the same in ${scheme} mode`, async ({ page }) => {
    await prepare(page, 834, 1112, scheme);
    await setPrefs(page, { sidePanelHidden: true });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Show side panel" })).toBeVisible();
    await expect(page).toHaveScreenshot(`side-hidden-tablet-${scheme}.png`, shot);
  });

  test(`tablet toggle shows the indicator dot after an error while hidden, ${scheme} mode`, async ({ page }) => {
    await prepare(page, 834, 1112, scheme);
    await setPrefs(page, { sidePanelHidden: true });
    await page.goto("/");
    await page.getByRole("textbox", { name: "Program editor" }).click();
    await page.keyboard.type("OUTPUT 1 DIV 0");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.locator(".sc-side-dot")).toBeVisible();
    await expect(page.getByRole("region", { name: "Variables" })).toBeHidden();
    await expect(page).toHaveScreenshot(`side-hidden-dot-tablet-${scheme}.png`, shot);
  });

  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["desktop", 1440, 900],
  ] as const) {
    test(`${name} has no side-panel toggle and looks the same in ${scheme} mode`, async ({ page }) => {
      await prepare(page, width, height, scheme);
      await setPrefs(page, { sidePanelHidden: true });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Run", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: /side panel/i })).toHaveCount(0);
      await expect(page).toHaveScreenshot(`side-${name}-${scheme}.png`, shot);
    });
  }
}

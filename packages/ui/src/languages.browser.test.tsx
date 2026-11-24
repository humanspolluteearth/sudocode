import "./styles.css";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

// M10: a language picker. The app starts with a blank file, so choosing a language gives a blank file of that
// language (its extension on the tab); there are no example programs to load.
const cases = [
  { name: /Edexcel/, tab: ".epc" },
  { name: /Cambridge/, tab: ".cpc" },
  { name: "Python", tab: ".py" },
] as const;

describe("MISC language picker", () => {
  for (const c of cases) {
    it(`MISC ${String(c.name)}: picker switches language and the editor stays blank`, async () => {
      localStorage.clear();
      const screen = await render(<App />);
      await screen.getByRole("menuitem", { name: "Language", exact: true }).click();
      await screen.getByRole("menuitemradio", { name: c.name }).click();
      await expect.poll(() => screen.getByRole("tab", { selected: true }).element().textContent).toContain(c.tab);
      await expect.poll(() => screen.getByRole("textbox").first().element().textContent.trim()).toBe("");
      await screen.getByRole("menuitem", { name: "File", exact: true }).click();
      await expect.element(screen.getByRole("menuitemradio")).not.toBeInTheDocument();
      await screen.getByRole("menuitem", { name: "File", exact: true }).click();
      expect((await axeViolations(screen.container)).length).toBe(0);
    });
  }
});

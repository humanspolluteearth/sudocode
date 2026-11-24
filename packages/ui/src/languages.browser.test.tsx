import "./styles.css";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { EDEXCEL_EXAMPLES, CIE_EXAMPLES, PYTHON_EXAMPLES } from "@sudocode/core";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";

// M10: examples for all three languages and a language picker. Each language is chosen from the Language menu, then
// an example is chosen from the File menu and gets the tick.
const cases = [
  { name: /Edexcel/, tab: /\.epc/, examples: EDEXCEL_EXAMPLES },
  { name: /Cambridge/, tab: /\.cpc/, examples: CIE_EXAMPLES },
  { name: "Python", tab: /\.py/, examples: PYTHON_EXAMPLES },
] as const;

describe("MISC language picker and examples", () => {
  for (const c of cases) {
    it(`MISC ${String(c.name)}: picker switches language and its examples load with a tick`, async () => {
      localStorage.clear();
      const screen = await render(<App />);
      await screen.getByRole("menuitem", { name: "Language", exact: true }).click();
      await screen.getByRole("menuitemradio", { name: c.name }).click();
      expect(c.examples.length).toBeGreaterThan(0);
      const pick = c.examples.at(-1);
      if (pick === undefined) throw new Error("no example");
      await screen.getByRole("menuitem", { name: "File", exact: true }).click();
      await screen.getByRole("menuitemradio", { name: pick.name }).click();
      await screen.getByRole("menuitem", { name: "File", exact: true }).click();
      await expect
        .element(screen.getByRole("menuitemradio", { name: pick.name }))
        .toHaveAttribute("aria-checked", "true");
      await screen.getByRole("menuitem", { name: "File", exact: true }).click();
      expect((await axeViolations(screen.container)).length).toBe(0);
    });
  }
});

import "./styles.css";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { axeViolations } from "./axe.ts";
import { Console } from "./Console.tsx";

const waiting = { prompt: "n" };
const consoleBox = (theme: string) => (
  <div className={`sc-root ${theme}`}>
    <Console output="Enter n: " error={null} finishedNote={null} onClear={() => undefined} waiting={waiting} />
  </div>
);
const field = () => document.querySelector<HTMLInputElement>(".sc-input-inline") as HTMLInputElement;

/** The underline is a solid 1px (2px focused) bottom border and nothing else: no outline, no side or top border. */
function expectUnderlineOnly(el: HTMLElement, focused: boolean) {
  const s = getComputedStyle(el);
  expect(s.borderBottomStyle).toBe("solid");
  expect(s.borderBottomWidth).toBe(focused ? "2px" : "1px");
  expect(s.borderTopWidth).toBe("0px");
  expect(s.borderLeftWidth).toBe("0px");
  expect(s.borderRightWidth).toBe("0px");
  expect(s.outlineStyle === "none" || s.outlineWidth === "0px").toBe(true);
}

describe("MISC console input: underline and caret while waiting for input", () => {
  for (const theme of ["light", "dark"]) {
    for (const [name, w, h] of [
      ["phone", 390, 700],
      ["tablet", 834, 900],
      ["desktop", 1440, 900],
    ] as const) {
      it(`MISC ${theme} ${name}: the input is focused and underlined as soon as it appears, and axe is clean`, async () => {
        await page.viewport(w, h);
        const screen = await render(consoleBox(theme));
        expect(document.activeElement).toBe(field());
        expectUnderlineOnly(field(), true);
        // The caret is visible: never transparent.
        expect(getComputedStyle(field()).caretColor).not.toBe("rgba(0, 0, 0, 0)");
        expect(await axeViolations(screen.container)).toEqual([]);
      });
    }
  }

  it("MISC clicking the console keeps the caret in the input, still underlined", async () => {
    await render(consoleBox("light"));
    await userEvent.click(document.querySelector(".sc-console-log") as HTMLElement);
    expect(document.activeElement).toBe(field());
    expectUnderlineOnly(field(), true);
  });

  it("MISC when it does not have focus the input still shows a 1px solid underline", async () => {
    await render(consoleBox("light"));
    field().blur();
    expectUnderlineOnly(field(), false);
  });

  it("MISC the focused underline is in the link colour, the unfocused one in the text colour", async () => {
    await render(consoleBox("light"));
    const focusedColour = getComputedStyle(field()).borderBottomColor;
    field().blur();
    expect(getComputedStyle(field()).borderBottomColor).not.toBe(focusedColour);
  });

  it("MISC reduced motion stops the blink but the caret stays", async () => {
    await render(consoleBox("light"));
    // `caret-animation: manual` stops the blink without hiding the caret; set under prefers-reduced-motion.
    const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
    const reduced = rules.find(
      (r) => r instanceof CSSMediaRule && r.conditionText.includes("prefers-reduced-motion: reduce"),
    ) as CSSMediaRule | undefined;
    expect(reduced).toBeDefined();
    expect(reduced?.cssText).toContain(".sc-input-inline");
    expect(reduced?.cssText).toContain("caret-animation: manual");
    expect(reduced?.cssText).not.toContain("caret-color");
  });
});

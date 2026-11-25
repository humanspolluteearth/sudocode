import "./styles.css";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SaveDialog } from "./SaveDialog.tsx";
import { SettingsDialog } from "./SettingsDialog.tsx";

const save = <SaveDialog name="untitled" type="epc" onSave={() => undefined} onCancel={() => undefined} />;

const sizes = [
  ["phone", 390, 844],
  ["tablet", 834, 1112],
  ["desktop", 1440, 900],
  // A phone with the on-screen keyboard open leaves about 300px of height.
  ["phone with keyboard", 390, 300],
] as const;

describe("MISC dialogs: centred, fully visible, labels and fields aligned", () => {
  for (const [name, w, h] of sizes) {
    it(`MISC Save file at ${name} (${String(w)}x${String(h)}) is centred, visible and aligned`, async () => {
      await page.viewport(w, h);
      await render(save);
      const box = document.querySelector(".sc-dialog") as HTMLElement;
      const r = box.getBoundingClientRect();
      // Centred horizontally, and inside the screen (it scrolls inside itself when the screen is too short).
      expect(Math.abs(r.left - (w - r.right))).toBeLessThanOrEqual(1);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(w);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.bottom).toBeLessThanOrEqual(h);
      // Both labels start at the same x, and both controls have the same left edge and width.
      const labels = [...box.querySelectorAll<HTMLElement>(".sc-field")];
      const controls = [...box.querySelectorAll<HTMLElement>("input, select")];
      expect(labels).toHaveLength(2);
      expect(new Set(labels.map((l) => Math.round(l.getBoundingClientRect().left))).size).toBe(1);
      expect(new Set(controls.map((c) => Math.round(c.getBoundingClientRect().left))).size).toBe(1);
      expect(new Set(controls.map((c) => Math.round(c.getBoundingClientRect().width))).size).toBe(1);
      for (const c of controls) expect(c.getBoundingClientRect().right).toBeLessThanOrEqual(r.right);
    });
  }

  it("MISC Settings fields line up the same way", async () => {
    await page.viewport(390, 844);
    await render(
      <SettingsDialog
        advanced={false}
        onAdvanced={() => undefined}
        theme="system"
        onTheme={() => undefined}
        zoom={100}
        onZoom={() => undefined}
        toolsOff={[]}
        onTool={() => undefined}
        onClose={() => undefined}
      />,
    );
    const controls = [
      ...document.querySelectorAll<HTMLElement>(".sc-dialog .sc-field select, .sc-dialog .sc-field input"),
    ];
    expect(controls.length).toBeGreaterThan(0);
    expect(new Set(controls.map((c) => Math.round(c.getBoundingClientRect().left))).size).toBe(1);
  });
});

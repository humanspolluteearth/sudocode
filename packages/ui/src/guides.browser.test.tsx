import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "./App.tsx";
import { axeViolations } from "./axe.ts";
import { GuidePage, GUIDE_IDS, guideFromSearch, parseStyle } from "./GuidePage.tsx";

const TITLES = {
  edexcel: "Edexcel pseudocode reference",
  cie: "Cambridge pseudocode reference",
  python: "Python reference",
} as const;

describe("MISC the full guide pages", () => {
  it.each(GUIDE_IDS)("MISC %s guide shows its contents, every section heading and passes axe", async (id) => {
    const screen = await render(<GuidePage guide={id} onNavigate={() => undefined} themeClass="light" />);
    await expect.element(screen.getByRole("navigation", { name: "Contents" })).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent(TITLES[id], { normalizeWhitespace: true });
    const container = screen.container;
    const links = [...container.querySelectorAll('nav[aria-label="Contents"] a')];
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      const target = link.getAttribute("href")?.slice(1) ?? "";
      expect(container.querySelector(`section[id="${target}"] h2`), target).not.toBeNull();
    }
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });

  it("MISC the Guide language switch marks the current guide and opens the others", async () => {
    const go = vi.fn();
    const screen = await render(<GuidePage guide="edexcel" onNavigate={go} themeClass="light" />);
    const nav = screen.getByRole("navigation", { name: "Guide language" });
    await expect.element(nav).toBeVisible();
    await expect.element(nav.getByText("Edexcel")).toHaveAttribute("aria-current", "page");
    await userEvent.click(nav.getByRole("link", { name: "Cambridge" }));
    expect(go).toHaveBeenLastCalledWith("cie");
    await userEvent.click(nav.getByRole("link", { name: "Python" }));
    expect(go).toHaveBeenLastCalledWith("python");
    await userEvent.click(screen.getByRole("link", { name: "IDE" }));
    expect(go).toHaveBeenLastCalledWith("ide");
  });

  it("MISC the Quick reference links to the full guide, and Back returns to the editor", async () => {
    globalThis.localStorage.setItem("sudocode.preferences", JSON.stringify({ language: "python" }));
    try {
      const screen = await render(<App />);
      await userEvent.click(screen.getByRole("button", { name: "Quick reference" }));
      await userEvent.click(screen.getByRole("link", { name: "Full Python guide and error reference" }));
      await expect.element(screen.getByRole("navigation", { name: "Guide language" })).toBeVisible();
      expect(globalThis.location.search).toBe("?guide=python");
      await userEvent.click(screen.getByRole("link", { name: "Cambridge" }));
      await expect
        .element(screen.getByRole("heading", { level: 1 }))
        .toHaveTextContent("Cambridge pseudocode reference");
      globalThis.history.back();
      await expect.element(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Python reference");
      await userEvent.click(screen.getByRole("link", { name: "IDE" }));
      await expect.element(screen.getByRole("navigation", { name: "Menu bar" })).toBeVisible();
      expect(globalThis.location.search).toBe("");
    } finally {
      globalThis.localStorage.removeItem("sudocode.preferences");
      globalThis.history.replaceState(null, "", globalThis.location.pathname);
    }
  });

  it("MISC guide addresses and styles are read correctly", () => {
    expect(guideFromSearch("?guide=cie")).toBe("cie");
    expect(guideFromSearch("?guide=nope")).toBeNull();
    expect(guideFromSearch("")).toBeNull();
    expect(parseStyle("margin: 0; --x: 1px; font-size: 13px")).toEqual({ margin: "0", "--x": "1px", fontSize: "13px" });
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";

describe("MISC the app shell", () => {
  it("MISC renders the toolbar, console, problems list and status bar", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aria-label="Run controls"');
    expect(html).toContain('aria-label="Console"');
    expect(html).toContain("No problems.");
    expect(html).toContain('aria-label="Status bar"');
  });
});
